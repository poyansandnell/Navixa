-- =============================================================================
-- Navixa — 08: Business-logic SQL functions
-- =============================================================================
-- All functions here are intended to be called by Edge Functions using the
-- service_role key, OR directly by authenticated clients where noted. Functions
-- that must bypass RLS or touch private_game_states are SECURITY DEFINER and
-- pin search_path for safety.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- update_rating — Elo update for a single player after a match.
--   result: 1.0 win, 0.5 draw, 0.0 loss.
-- Returns the new rating. Updates ratings + rating_history.
-- -----------------------------------------------------------------------------
create or replace function public.update_rating(
  p_player_id uuid,
  p_mode      public.match_mode,
  p_opponent_rating integer,
  p_result    numeric,          -- 1 win / 0.5 draw / 0 loss
  p_match_id  uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rating   integer;
  v_games    integer;
  v_k        numeric;
  v_expected numeric;
  v_new      integer;
  v_delta    integer;
  v_result_enum public.match_result;
begin
  if p_result not in (0, 0.5, 1) then
    raise exception 'p_result must be 0, 0.5 or 1';
  end if;

  -- Fetch or lazily create the rating row.
  insert into public.ratings (player_id, mode)
    values (p_player_id, p_mode)
    on conflict (player_id, mode) do nothing;

  select rating, games_played into v_rating, v_games
    from public.ratings
    where player_id = p_player_id and mode = p_mode
    for update;

  -- K-factor: higher for provisional players, lower for veterans.
  v_k := case
           when v_games < 15 then 40
           when v_rating >= 2100 then 16
           else 24
         end;

  v_expected := 1.0 / (1.0 + power(10.0, (p_opponent_rating - v_rating) / 400.0));
  v_new := round(v_rating + v_k * (p_result - v_expected))::integer;
  v_new := greatest(0, least(4000, v_new));
  v_delta := v_new - v_rating;

  v_result_enum := case
                     when p_result = 1 then 'win'::public.match_result
                     when p_result = 0 then 'loss'::public.match_result
                     else 'draw'::public.match_result
                   end;

  update public.ratings set
    rating       = v_new,
    games_played = games_played + 1,
    wins         = wins   + (case when p_result = 1 then 1 else 0 end),
    losses       = losses + (case when p_result = 0 then 1 else 0 end),
    draws        = draws  + (case when p_result = 0.5 then 1 else 0 end),
    win_streak   = case when p_result = 1 then win_streak + 1 else 0 end,
    best_rating  = greatest(best_rating, v_new)
  where player_id = p_player_id and mode = p_mode;

  insert into public.rating_history
    (player_id, mode, match_id, rating_before, rating_after, rating_delta, result)
  values
    (p_player_id, p_mode, p_match_id, v_rating, v_new, v_delta, v_result_enum);

  return v_new;
end;
$$;

comment on function public.update_rating(uuid, public.match_mode, integer, numeric, uuid) is
  'Applies an Elo update for one player and appends a rating_history row. SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- matchmaking_find_or_queue — transactional matchmaker.
--   * Cannot match self.
--   * Widening rating window based on how long the caller has waited.
--   * Skips blocked users.
--   * Prevents double-matching via FOR UPDATE SKIP LOCKED.
-- Returns the matched match_id, or NULL if the caller was enqueued to wait.
-- -----------------------------------------------------------------------------
create or replace function public.matchmaking_find_or_queue(
  p_player_id  uuid,
  p_mode       public.match_mode default 'ranked',
  p_rating     integer default 1200,
  p_region     text default null,
  p_board_size smallint default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opponent public.matchmaking_queue;
  v_match_id uuid;
  v_window   integer;
  v_waited   numeric;
  v_self     public.matchmaking_queue;
  v_mp1      uuid := gen_random_uuid();
begin
  if p_player_id is null then
    raise exception 'p_player_id is required';
  end if;

  -- Upsert the caller into the queue (idempotent while searching).
  insert into public.matchmaking_queue
    (player_id, mode, rating, region, board_size, status)
  values
    (p_player_id, p_mode, p_rating, p_region, p_board_size, 'searching')
  on conflict (player_id, mode) where status = 'searching'
    do update set rating = excluded.rating,
                  region = excluded.region,
                  board_size = excluded.board_size,
                  updated_at = now()
  returning * into v_self;

  -- How long has the caller been waiting? Widen the window over time.
  v_waited := extract(epoch from (now() - v_self.enqueued_at));
  v_window := 50 + floor(v_waited / 5.0)::integer * 25;   -- +25 every 5s
  v_window := least(v_window, 1000);

  -- Look for a suitable opponent and lock the row so no one else grabs them.
  select q.* into v_opponent
  from public.matchmaking_queue q
  where q.status = 'searching'
    and q.mode = p_mode
    and q.board_size = p_board_size
    and q.player_id <> p_player_id                       -- can't match self
    and (p_region is null or q.region is null or q.region = p_region)
    and abs(q.rating - p_rating) <= v_window
    and not public.is_blocked_between(p_player_id, q.player_id)  -- skip blocked
    and q.expires_at > now()
  order by abs(q.rating - p_rating) asc, q.enqueued_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;   -- caller stays queued; poll again later
  end if;

  -- Re-lock the caller's own row to avoid a race where they get matched twice.
  perform 1 from public.matchmaking_queue
    where id = v_self.id and status = 'searching'
    for update skip locked;
  if not found then
    return null;
  end if;

  -- Create the match + both player seats.
  insert into public.matches (mode, status, board_size, is_rated)
    values (p_mode, 'placing', p_board_size, (p_mode = 'ranked'))
    returning id into v_match_id;

  insert into public.match_players (match_id, player_id, seat, rating_before)
    values (v_match_id, p_player_id, 0, p_rating),
           (v_match_id, v_opponent.player_id, 1, v_opponent.rating);

  -- Mark both queue rows as matched.
  update public.matchmaking_queue
    set status = 'matched', matched_match_id = v_match_id, updated_at = now()
    where id in (v_self.id, v_opponent.id);

  insert into public.match_events (match_id, event_type, payload)
    values (v_match_id, 'match_created',
            jsonb_build_object('mode', p_mode, 'source', 'matchmaking'));

  return v_match_id;
end;
$$;

comment on function public.matchmaking_find_or_queue(uuid, public.match_mode, integer, text, smallint) is
  'Transactional matchmaker with widening window, self/blocked exclusion and '
  'FOR UPDATE SKIP LOCKED to prevent duplicate matches. SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- finalize_match — idempotent match finalisation.
--   Guards on status so it can only finalise an 'active'/'placing' match once.
--   Sets result rows, applies ratings (when rated), updates win/loss stats.
-- -----------------------------------------------------------------------------
create or replace function public.finalize_match(
  p_match_id uuid,
  p_winner_id uuid,           -- null => draw
  p_abandoned boolean default false
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match   public.matches;
  v_p0      public.match_players;
  v_p1      public.match_players;
  v_r0      integer;
  v_r1      integer;
  v_res0    numeric;
  v_res1    numeric;
begin
  -- Lock the match row and guard on status (idempotency).
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;

  if v_match.status in ('finished', 'abandoned', 'cancelled') then
    -- Already finalised: return current state without side effects.
    return v_match;
  end if;

  select * into v_p0 from public.match_players
    where match_id = p_match_id and seat = 0 for update;
  select * into v_p1 from public.match_players
    where match_id = p_match_id and seat = 1 for update;

  if v_p0.id is null or v_p1.id is null then
    raise exception 'match % is missing a player seat', p_match_id;
  end if;

  -- Determine per-player numeric results.
  if p_winner_id is null then
    v_res0 := 0.5; v_res1 := 0.5;
  elsif p_winner_id = v_p0.player_id then
    v_res0 := 1;   v_res1 := 0;
  elsif p_winner_id = v_p1.player_id then
    v_res0 := 0;   v_res1 := 1;
  else
    raise exception 'winner % is not a participant of match %', p_winner_id, p_match_id;
  end if;

  -- Update the match row.
  update public.matches set
    status      = (case when p_abandoned then 'abandoned' else 'finished' end)::public.match_status,
    winner_id   = p_winner_id,
    finished_at = now()
  where id = p_match_id
  returning * into v_match;

  -- Apply ratings only for rated matches (and only when both are humans).
  if v_match.is_rated and v_p0.player_id is not null and v_p1.player_id is not null then
    v_r1 := coalesce(v_p1.rating_before, 1200);
    v_r0 := coalesce(v_p0.rating_before, 1200);

    perform public.update_rating(v_p0.player_id, v_match.mode, v_r1, v_res0, p_match_id);
    perform public.update_rating(v_p1.player_id, v_match.mode, v_r0, v_res1, p_match_id);

    update public.match_players mp set
      rating_after = r.rating,
      rating_delta = r.rating - coalesce(mp.rating_before, r.rating),
      result = case
                 when mp.player_id = p_winner_id then 'win'::public.match_result
                 when p_winner_id is null then 'draw'::public.match_result
                 else 'loss'::public.match_result
               end
    from public.ratings r
    where mp.match_id = p_match_id
      and r.player_id = mp.player_id
      and r.mode = v_match.mode;
  else
    update public.match_players set
      result = case
                 when player_id = p_winner_id then 'win'::public.match_result
                 when p_winner_id is null then 'draw'::public.match_result
                 else 'loss'::public.match_result
               end
    where match_id = p_match_id;
  end if;

  insert into public.match_events (match_id, event_type, payload)
    values (p_match_id, 'match_finalized',
            jsonb_build_object('winner_id', p_winner_id, 'abandoned', p_abandoned));

  return v_match;
end;
$$;

comment on function public.finalize_match(uuid, uuid, boolean) is
  'Idempotent match finalisation guarded on status; applies ratings for rated '
  'matches and records results. SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- player_stats — aggregate a player's stats across matches.
-- -----------------------------------------------------------------------------
create or replace function public.player_stats(p_player_id uuid)
returns table (
  matches_played integer,
  wins           integer,
  losses         integer,
  draws          integer,
  win_rate       numeric,
  total_shots    bigint,
  total_hits     bigint,
  accuracy       numeric,
  ships_sunk     bigint,
  current_rating integer,
  best_rating    integer
)
language sql
stable
security definer
set search_path = public
as $$
  with mp as (
    select * from public.match_players
    where player_id = p_player_id and result is not null
  )
  select
    count(*)::integer,
    count(*) filter (where result = 'win')::integer,
    count(*) filter (where result = 'loss')::integer,
    count(*) filter (where result = 'draw')::integer,
    case when count(*) = 0 then 0
         else round(count(*) filter (where result = 'win')::numeric / count(*), 4)
    end,
    coalesce(sum(shots_fired), 0),
    coalesce(sum(hits), 0),
    case when coalesce(sum(shots_fired), 0) = 0 then 0
         else round(sum(hits)::numeric / sum(shots_fired), 4)
    end,
    coalesce(sum(ships_sunk), 0),
    coalesce((select rating from public.ratings
              where player_id = p_player_id and mode = 'ranked'), 1200),
    coalesce((select best_rating from public.ratings
              where player_id = p_player_id and mode = 'ranked'), 1200)
  from mp;
$$;

comment on function public.player_stats(uuid) is
  'Aggregate lifetime stats for a player across finished matches.';

-- -----------------------------------------------------------------------------
-- generate_leaderboard_snapshot — freeze current rankings for a scope/mode.
--   scope = 'global' or a 2-letter country code. Idempotent per (date,scope,mode).
-- -----------------------------------------------------------------------------
create or replace function public.generate_leaderboard_snapshot(
  p_scope text default 'global',
  p_mode  public.match_mode default 'ranked',
  p_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Remove any existing snapshot for today/scope/mode so we can regenerate.
  delete from public.leaderboard_snapshots
    where snapshot_date = current_date and scope = p_scope and mode = p_mode;

  insert into public.leaderboard_snapshots
    (scope, mode, player_id, rank, rating, games_played, snapshot_date)
  select
    p_scope,
    p_mode,
    r.player_id,
    row_number() over (order by r.rating desc, r.games_played desc, p.created_at asc),
    r.rating,
    r.games_played,
    current_date
  from public.ratings r
  join public.profiles p on p.id = r.player_id
  where r.mode = p_mode
    and p.deleted_at is null
    and p.is_bot = false
    and r.games_played > 0
    and (p_scope = 'global' or p.country_code = p_scope)
  order by r.rating desc
  limit p_limit;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.generate_leaderboard_snapshot(text, public.match_mode, integer) is
  'Freezes ranked standings into leaderboard_snapshots for the given scope/mode. Idempotent per day.';

-- -----------------------------------------------------------------------------
-- tournament_advance_winner — advance a bracket winner into the next slot.
--   Idempotent: guards on the source slot already having a recorded winner.
-- -----------------------------------------------------------------------------
create or replace function public.tournament_advance_winner(
  p_tournament_match_id uuid,
  p_winner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tm   public.tournament_matches;
begin
  select * into v_tm from public.tournament_matches
    where id = p_tournament_match_id for update;
  if not found then
    raise exception 'tournament match % not found', p_tournament_match_id;
  end if;

  if v_tm.player_one_id is distinct from p_winner_id
     and v_tm.player_two_id is distinct from p_winner_id then
    raise exception 'winner % is not a participant of bracket slot %',
      p_winner_id, p_tournament_match_id;
  end if;

  -- Record the winner + mark this slot finished (idempotent).
  update public.tournament_matches
    set winner_id = p_winner_id, status = 'finished', updated_at = now()
    where id = p_tournament_match_id;

  -- Update the entry win/loss tallies for both players.
  update public.tournament_entries
    set wins = wins + 1, updated_at = now()
    where tournament_id = v_tm.tournament_id and player_id = p_winner_id;

  update public.tournament_entries
    set losses = losses + 1, eliminated = true, updated_at = now()
    where tournament_id = v_tm.tournament_id
      and player_id in (v_tm.player_one_id, v_tm.player_two_id)
      and player_id is distinct from p_winner_id;

  -- Flow the winner into the next bracket slot, if any.
  if v_tm.next_match_id is not null then
    if v_tm.next_slot = 1 then
      update public.tournament_matches
        set player_one_id = p_winner_id, updated_at = now()
        where id = v_tm.next_match_id and player_one_id is null;
    elsif v_tm.next_slot = 2 then
      update public.tournament_matches
        set player_two_id = p_winner_id, updated_at = now()
        where id = v_tm.next_match_id and player_two_id is null;
    end if;
  end if;
end;
$$;

comment on function public.tournament_advance_winner(uuid, uuid) is
  'Records a bracket winner and advances them to the next slot. Idempotent. SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- Grant EXECUTE on the client-callable RPCs to authenticated users.
-- (SECURITY DEFINER functions still enforce their own checks.)
-- -----------------------------------------------------------------------------
grant execute on function public.matchmaking_find_or_queue(uuid, public.match_mode, integer, text, smallint) to authenticated;
grant execute on function public.player_stats(uuid) to authenticated, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;

-- The following are server-only (Edge Functions via service_role); do NOT
-- grant to authenticated:
revoke execute on function public.update_rating(uuid, public.match_mode, integer, numeric, uuid) from public;
revoke execute on function public.finalize_match(uuid, uuid, boolean) from public;
revoke execute on function public.generate_leaderboard_snapshot(text, public.match_mode, integer) from public;
revoke execute on function public.tournament_advance_winner(uuid, uuid) from public;
