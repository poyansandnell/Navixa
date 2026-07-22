-- =============================================================================
-- Navixa — 10: Edge Function support (private codes, clocks, bots)
-- =============================================================================
-- Adds the columns and SQL helper functions the trusted Edge Functions rely on
-- that were not present in the base schema:
--   * matches.invite_code        -> private-match join code (deep-linkable)
--   * matches.turn_deadline      -> server-authoritative per-turn clock deadline
--   * match_players.time_left_ms -> remaining bank per player (blitz/classic)
--   * match_players.is_bot       -> marks a bot seat (training matches)
--   * match_players.bot_difficulty
--   * private_game_states.fleet_submitted
--   * create_private_match(...)  -> creates a private match + unique code
--   * join_private_match(...)    -> seats a second player by code
--   * create_bot_match(...)      -> creates a training match vs a bot
--   * touch_turn_clock(...)      -> deducts elapsed time + sets next deadline
--   * create_tournament_bracket(...) -> generates a single-elim bracket
--
-- Everything here is intended to be called by Edge Functions using the
-- service_role key. Functions that must bypass RLS are SECURITY DEFINER with a
-- pinned search_path. DO NOT apply this migration by hand — the platform / CLI
-- applies migrations in timestamp order.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema additions
-- -----------------------------------------------------------------------------
alter table public.matches
  add column if not exists invite_code       text,
  add column if not exists turn_deadline     timestamptz,
  add column if not exists current_turn_seat smallint;

alter table public.matches
  drop constraint if exists matches_current_turn_seat_chk;
alter table public.matches
  add constraint matches_current_turn_seat_chk
  check (current_turn_seat is null or current_turn_seat in (0, 1));

create unique index if not exists matches_invite_code_key
  on public.matches (invite_code)
  where invite_code is not null and status in ('pending', 'placing');

alter table public.match_moves
  add column if not exists idempotency_key text;

create unique index if not exists match_moves_idem_key
  on public.match_moves (match_id, idempotency_key)
  where idempotency_key is not null;

alter table public.match_players
  add column if not exists time_left_ms   integer,
  add column if not exists is_bot         boolean not null default false,
  add column if not exists bot_difficulty text,
  add column if not exists last_seen_at   timestamptz;

alter table public.match_players
  drop constraint if exists match_players_bot_difficulty_chk;
alter table public.match_players
  add constraint match_players_bot_difficulty_chk
  check (bot_difficulty is null or bot_difficulty in ('beginner', 'normal', 'expert'));

alter table public.private_game_states
  add column if not exists fleet_submitted boolean not null default true,
  add column if not exists seat            smallint,
  add column if not exists is_bot          boolean not null default false;

-- Bot seats have no profile row, so player_id must be nullable for them. The
-- original NOT NULL is relaxed here; the unique (match_id, player_id) index
-- still applies to human rows (nulls are distinct in a partial-free btree, so
-- add a partial unique on (match_id, seat) to keep bot rows unambiguous).
alter table public.private_game_states
  alter column player_id drop not null;

create unique index if not exists private_game_states_seat_key
  on public.private_game_states (match_id, seat)
  where seat is not null;

-- -----------------------------------------------------------------------------
-- gen_invite_code — short, unambiguous, uppercase code (no 0/O/1/I).
-- -----------------------------------------------------------------------------
create or replace function public.gen_invite_code(p_len integer default 6)
returns text
language plpgsql
volatile
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
  i integer;
begin
  for i in 1..p_len loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_private_match — create a private match with a unique join code.
--   Seats the creator at seat 0. Returns the new match row.
-- -----------------------------------------------------------------------------
create or replace function public.create_private_match(
  p_creator_id uuid,
  p_mode       public.match_mode default 'friendly',
  p_board_size smallint default 10,
  p_turn_seconds integer default 60,
  p_is_rated   boolean default false
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_code  text;
  v_rating integer;
  v_try   integer := 0;
begin
  if p_creator_id is null then
    raise exception 'p_creator_id is required';
  end if;

  -- Generate a unique code among active private matches.
  loop
    v_try := v_try + 1;
    v_code := public.gen_invite_code(6);
    exit when not exists (
      select 1 from public.matches
      where invite_code = v_code and status in ('pending', 'placing')
    );
    if v_try > 25 then
      raise exception 'could not allocate a unique invite code';
    end if;
  end loop;

  insert into public.matches
    (mode, status, board_size, is_rated, is_private, turn_seconds, invite_code)
  values
    (p_mode, 'pending', p_board_size, p_is_rated, true, p_turn_seconds, v_code)
  returning * into v_match;

  select coalesce(r.rating, 1200) into v_rating
    from public.ratings r
    where r.player_id = p_creator_id and r.mode = p_mode;
  v_rating := coalesce(v_rating, 1200);

  insert into public.match_players
    (match_id, player_id, seat, rating_before, time_left_ms)
  values
    (v_match.id, p_creator_id, 0, v_rating, p_turn_seconds * 1000);

  insert into public.match_events (match_id, actor_id, event_type, payload)
    values (v_match.id, p_creator_id, 'match_created',
            jsonb_build_object('source', 'private', 'code', v_code));

  return v_match;
end;
$$;

comment on function public.create_private_match(uuid, public.match_mode, smallint, integer, boolean) is
  'Creates a private match with a unique invite code and seats the creator. SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- join_private_match — join an open private match by its invite code.
--   Locks the match row, guards against self-join / full / non-open matches.
--   Seats the joiner at seat 1 and moves the match into 'placing'.
-- -----------------------------------------------------------------------------
create or replace function public.join_private_match(
  p_joiner_id uuid,
  p_code      text
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match  public.matches;
  v_rating integer;
  v_seats  integer;
begin
  if p_joiner_id is null or p_code is null then
    raise exception 'p_joiner_id and p_code are required';
  end if;

  select * into v_match from public.matches
    where invite_code = upper(p_code) and is_private = true
      and status in ('pending', 'placing')
    for update;
  if not found then
    raise exception 'private match not found';
  end if;

  -- Already seated?
  if exists (
    select 1 from public.match_players
    where match_id = v_match.id and player_id = p_joiner_id
  ) then
    return v_match;
  end if;

  select count(*) into v_seats from public.match_players where match_id = v_match.id;
  if v_seats >= 2 then
    raise exception 'match is full';
  end if;

  select coalesce(r.rating, 1200) into v_rating
    from public.ratings r
    where r.player_id = p_joiner_id and r.mode = v_match.mode;
  v_rating := coalesce(v_rating, 1200);

  insert into public.match_players
    (match_id, player_id, seat, rating_before, time_left_ms)
  values
    (v_match.id, p_joiner_id, 1, v_rating, v_match.turn_seconds * 1000);

  update public.matches
    set status = 'placing', updated_at = now()
    where id = v_match.id
    returning * into v_match;

  insert into public.match_events (match_id, actor_id, event_type, payload)
    values (v_match.id, p_joiner_id, 'player_joined',
            jsonb_build_object('seat', 1, 'source', 'private'));

  return v_match;
end;
$$;

comment on function public.join_private_match(uuid, text) is
  'Seats a joining player into an open private match by code. SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- create_bot_match — create a training match vs a server-controlled bot.
--   The bot occupies seat 1 with player_id = NULL and is_bot = true.
-- -----------------------------------------------------------------------------
create or replace function public.create_bot_match(
  p_player_id   uuid,
  p_difficulty  text default 'normal',
  p_board_size  smallint default 10,
  p_turn_seconds integer default 60
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  if p_player_id is null then
    raise exception 'p_player_id is required';
  end if;
  if p_difficulty not in ('beginner', 'normal', 'expert') then
    raise exception 'invalid bot difficulty %', p_difficulty;
  end if;

  insert into public.matches
    (mode, status, board_size, is_rated, is_private, turn_seconds)
  values
    ('bot', 'placing', p_board_size, false, true, p_turn_seconds)
  returning * into v_match;

  insert into public.match_players
    (match_id, player_id, seat, is_bot, time_left_ms)
  values
    (v_match.id, p_player_id, 0, false, p_turn_seconds * 1000);

  insert into public.match_players
    (match_id, player_id, seat, is_bot, bot_difficulty, is_ready, time_left_ms)
  values
    (v_match.id, null, 1, true, p_difficulty, true, p_turn_seconds * 1000);

  insert into public.match_events (match_id, actor_id, event_type, payload)
    values (v_match.id, p_player_id, 'match_created',
            jsonb_build_object('source', 'bot', 'difficulty', p_difficulty));

  return v_match;
end;
$$;

comment on function public.create_bot_match(uuid, text, smallint, integer) is
  'Creates a training match vs a server-controlled bot (seat 1, is_bot). SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- touch_turn_clock — deduct elapsed time from the player whose turn just ended
-- and stamp a fresh per-turn deadline. Called by fire-shot after a move.
--   p_active_seat is the seat that is now ON THE CLOCK (about to move).
-- Returns the new turn_deadline.
-- -----------------------------------------------------------------------------
create or replace function public.touch_turn_clock(
  p_match_id uuid,
  p_prev_seat smallint,       -- seat whose turn just finished (null on first move)
  p_active_seat smallint      -- seat now on the clock
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match     public.matches;
  v_deadline  timestamptz;
  v_elapsed   integer;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;

  -- Deduct time from the player who just moved, based on how much of their
  -- previous deadline they consumed.
  if p_prev_seat is not null and v_match.turn_deadline is not null then
    v_elapsed := greatest(
      0,
      (v_match.turn_seconds * 1000)
        - greatest(0, floor(extract(epoch from (v_match.turn_deadline - now())) * 1000)::int)
    );
    update public.match_players
      set time_left_ms = greatest(0, coalesce(time_left_ms, v_match.turn_seconds * 1000) - v_elapsed)
      where match_id = p_match_id and seat = p_prev_seat;
  end if;

  v_deadline := now() + make_interval(secs => v_match.turn_seconds);

  update public.matches
    set turn_deadline = v_deadline,
        current_turn_seat = p_active_seat,
        updated_at = now()
    where id = p_match_id;

  return v_deadline;
end;
$$;

comment on function public.touch_turn_clock(uuid, smallint, smallint) is
  'Deducts elapsed time from the player who just moved and stamps a fresh per-turn deadline. SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- create_tournament_bracket — build a single-elimination bracket from the
-- registered entries of a tournament. Idempotent: no-op if rounds already
-- exist. Seeds by current rating desc; byes go to top seeds.
-- -----------------------------------------------------------------------------
create or replace function public.create_tournament_bracket(
  p_tournament_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t          public.tournaments;
  v_n          integer;
  v_bracket    integer;   -- next power of two >= v_n
  v_rounds     integer;
  v_round_no   integer;
  v_round_id   uuid;
  v_slots      integer;
  v_pos        integer;
  v_prev_round_ids uuid[];
  v_this_round_ids uuid[];
  v_players    uuid[];
  v_tm_id      uuid;
  v_next_id    uuid;
begin
  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'tournament % not found', p_tournament_id;
  end if;

  -- Idempotency: if a bracket already exists, do nothing.
  if exists (select 1 from public.tournament_rounds where tournament_id = p_tournament_id) then
    return 0;
  end if;

  -- Ordered, seeded participant list.
  select array_agg(te.player_id order by coalesce(r.rating, 1200) desc, te.registered_at asc)
    into v_players
    from public.tournament_entries te
    left join public.ratings r
      on r.player_id = te.player_id and r.mode = v_t.mode
    where te.tournament_id = p_tournament_id;

  v_n := coalesce(array_length(v_players, 1), 0);
  if v_n < 2 then
    raise exception 'tournament % needs at least 2 entries', p_tournament_id;
  end if;

  -- Next power of two and number of rounds.
  v_bracket := 1;
  while v_bracket < v_n loop
    v_bracket := v_bracket * 2;
  end loop;
  v_rounds := ceil(ln(v_bracket) / ln(2))::int;

  -- Persist seeds on the entries.
  for v_pos in 1..v_n loop
    update public.tournament_entries
      set seed = v_pos, updated_at = now()
      where tournament_id = p_tournament_id and player_id = v_players[v_pos];
  end loop;

  -- Build rounds from the final backwards so we can wire next_match_id.
  v_prev_round_ids := array[]::uuid[];
  for v_round_no in reverse v_rounds..1 loop
    insert into public.tournament_rounds (tournament_id, round_number, name, status)
      values (p_tournament_id, v_round_no,
              'Round ' || v_round_no,
              case when v_round_no = 1 then 'upcoming' else 'upcoming' end::public.tournament_status)
      returning id into v_round_id;

    v_slots := v_bracket / (2 ^ v_round_no)::int;  -- matches in this round
    v_this_round_ids := array[]::uuid[];

    for v_pos in 1..v_slots loop
      -- Wire this slot into the next (already-created) round.
      v_next_id := null;
      if array_length(v_prev_round_ids, 1) is not null then
        v_next_id := v_prev_round_ids[ceil(v_pos / 2.0)::int];
      end if;

      insert into public.tournament_matches
        (tournament_id, round_id, bracket_position, status, next_match_id, next_slot)
      values
        (p_tournament_id, v_round_id, v_pos, 'pending', v_next_id,
         case when v_next_id is null then null
              when v_pos % 2 = 1 then 1 else 2 end)
      returning id into v_tm_id;

      v_this_round_ids := array_append(v_this_round_ids, v_tm_id);
    end loop;

    v_prev_round_ids := v_this_round_ids;
  end loop;

  -- Seat first-round players (standard 1 vs N, 2 vs N-1 seeding with byes).
  declare
    v_first_round_id uuid;
    v_match_ids uuid[];
    v_high integer;
    v_low  integer;
    v_slot integer;
    v_p1   uuid;
    v_p2   uuid;
  begin
    select id into v_first_round_id from public.tournament_rounds
      where tournament_id = p_tournament_id and round_number = 1;

    select array_agg(id order by bracket_position) into v_match_ids
      from public.tournament_matches
      where round_id = v_first_round_id;

    v_slot := 0;
    v_high := 1;
    v_low  := v_bracket;
    while v_high < v_low loop
      v_slot := v_slot + 1;
      v_p1 := case when v_high <= v_n then v_players[v_high] else null end;
      v_p2 := case when v_low  <= v_n then v_players[v_low]  else null end;

      update public.tournament_matches
        set player_one_id = v_p1, player_two_id = v_p2, updated_at = now()
        where id = v_match_ids[v_slot];

      v_high := v_high + 1;
      v_low  := v_low - 1;
    end loop;
  end;

  update public.tournaments
    set status = 'ongoing', updated_at = now()
    where id = p_tournament_id;

  return v_rounds;
end;
$$;

comment on function public.create_tournament_bracket(uuid) is
  'Builds a seeded single-elimination bracket from tournament entries. Idempotent. SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- Grants: these are server-only (service_role) helpers. Revoke from public.
-- -----------------------------------------------------------------------------
revoke execute on function public.create_private_match(uuid, public.match_mode, smallint, integer, boolean) from public;
revoke execute on function public.join_private_match(uuid, text) from public;
revoke execute on function public.create_bot_match(uuid, text, smallint, integer) from public;
revoke execute on function public.touch_turn_clock(uuid, smallint, smallint) from public;
revoke execute on function public.create_tournament_bracket(uuid) from public;
