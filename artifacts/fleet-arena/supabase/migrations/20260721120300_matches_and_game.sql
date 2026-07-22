-- =============================================================================
-- Navixa — 03: Matches, players, private game state, moves & events
-- =============================================================================
-- SECURITY MODEL:
--   * matches               -> public metadata (spectatable lobby info)
--   * match_players         -> visible to participants; public after finish
--   * private_game_states   -> NO client-readable RLS policy. Only the
--                              service_role / Edge Functions may read. This is
--                              where each player's secret board layout lives.
--   * match_moves           -> participants during play; anyone after finish
--                              (for replay).
--   * match_events          -> participants; public after finish.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- matches — public metadata for a game
-- -----------------------------------------------------------------------------
create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  mode          public.match_mode not null default 'ranked',
  status        public.match_status not null default 'pending',
  board_size    smallint not null default 10,
  ruleset       text not null default 'classic',
  tournament_match_id uuid,   -- FK added in tournaments migration
  current_turn_player_id uuid, -- references match_players.id (soft link)
  turn_number   integer not null default 0,
  winner_id     uuid references public.profiles (id) on delete set null,
  is_rated      boolean not null default true,
  is_private    boolean not null default false,
  turn_seconds  integer not null default 60,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint matches_board_size_chk check (board_size between 8 and 16),
  constraint matches_turn_seconds_chk check (turn_seconds between 10 and 600),
  constraint matches_turn_number_chk check (turn_number >= 0)
);

create index if not exists matches_status_idx on public.matches (status);
create index if not exists matches_mode_idx on public.matches (mode);
create index if not exists matches_created_idx on public.matches (created_at desc);
create index if not exists matches_winner_idx on public.matches (winner_id);

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

comment on table public.matches is 'Public match metadata. No secret board data here.';

-- Deferred FK from reports.match_id (table created earlier).
alter table public.reports
  drop constraint if exists reports_match_fk;
alter table public.reports
  add constraint reports_match_fk
  foreign key (match_id) references public.matches (id) on delete set null;

-- -----------------------------------------------------------------------------
-- match_players — participants (2 per match, but table generalised)
-- -----------------------------------------------------------------------------
create table if not exists public.match_players (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches (id) on delete cascade,
  player_id      uuid references public.profiles (id) on delete set null,
  seat           smallint not null,            -- 0 or 1
  is_ready       boolean not null default false,
  result         public.match_result,
  rating_before  integer,
  rating_after   integer,
  rating_delta   integer,
  shots_fired    integer not null default 0,
  hits           integer not null default 0,
  ships_sunk     integer not null default 0,
  forfeited      boolean not null default false,
  joined_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint match_players_seat_chk check (seat between 0 and 1),
  constraint match_players_stats_chk check (shots_fired >= 0 and hits >= 0 and ships_sunk >= 0)
);

create unique index if not exists match_players_match_seat_key on public.match_players (match_id, seat);
create unique index if not exists match_players_match_player_key
  on public.match_players (match_id, player_id) where player_id is not null;
create index if not exists match_players_player_idx on public.match_players (player_id);

drop trigger if exists trg_match_players_updated_at on public.match_players;
create trigger trg_match_players_updated_at before update on public.match_players
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- private_game_states — SECRET per-player board. NO client RLS policy.
-- -----------------------------------------------------------------------------
create table if not exists public.private_game_states (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches (id) on delete cascade,
  player_id      uuid not null references public.profiles (id) on delete cascade,
  board          jsonb not null,               -- ship placements (secret!)
  shots_received jsonb not null default '[]'::jsonb,
  board_hash     text,                          -- commit hash for anti-cheat
  salt           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists private_game_states_key
  on public.private_game_states (match_id, player_id);

drop trigger if exists trg_private_game_states_updated_at on public.private_game_states;
create trigger trg_private_game_states_updated_at before update on public.private_game_states
  for each row execute function public.set_updated_at();

comment on table public.private_game_states is
  'SECRET board layout per player. RLS enabled with NO permissive policy — '
  'only the service_role (Edge Functions) can read/write. Never expose to clients.';

-- -----------------------------------------------------------------------------
-- match_moves — every shot; readable by participants, public after finish
-- -----------------------------------------------------------------------------
create table if not exists public.match_moves (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches (id) on delete cascade,
  player_id    uuid references public.profiles (id) on delete set null,
  move_number  integer not null,
  target_x     smallint not null,
  target_y     smallint not null,
  is_hit       boolean not null default false,
  sunk_ship    text,
  created_at   timestamptz not null default now(),
  constraint match_moves_coords_chk check (target_x >= 0 and target_y >= 0),
  constraint match_moves_number_chk check (move_number >= 0)
);

create unique index if not exists match_moves_number_key on public.match_moves (match_id, move_number);
create index if not exists match_moves_match_idx on public.match_moves (match_id, move_number);
create index if not exists match_moves_player_idx on public.match_moves (player_id);

-- -----------------------------------------------------------------------------
-- match_events — audit/timeline (turn started, timeout, chat, forfeit, ...)
-- -----------------------------------------------------------------------------
create table if not exists public.match_events (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  event_type   text not null,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists match_events_match_idx on public.match_events (match_id, created_at);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.matches             enable row level security;
alter table public.match_players       enable row level security;
alter table public.private_game_states enable row level security; -- NO policy!
alter table public.match_moves         enable row level security;
alter table public.match_events        enable row level security;

-- Helper: is the current user a participant in a given match?
create or replace function public.is_match_participant(m_id uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.match_players mp
    where mp.match_id = m_id and mp.player_id = uid
  );
$$;

-- Helper: is a match finished (usable for public replay visibility)?
create or replace function public.is_match_finished(m_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.id = m_id and m.status in ('finished', 'abandoned')
  );
$$;

-- matches: public metadata is readable to everyone (spectating / replay).
-- Private matches only visible to participants (or after finish).
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select using (
    deleted_at is null
    and (
      is_private = false
      or public.is_match_participant(id)
      or status in ('finished', 'abandoned')
    )
  );

drop policy if exists matches_admin on public.matches;
create policy matches_admin on public.matches
  for all using (public.is_admin()) with check (public.is_admin());

-- match_players: participants at all times; anyone after the match finishes.
drop policy if exists match_players_select on public.match_players;
create policy match_players_select on public.match_players
  for select using (
    public.is_match_participant(match_id)
    or public.is_match_finished(match_id)
  );

drop policy if exists match_players_admin on public.match_players;
create policy match_players_admin on public.match_players
  for all using (public.is_admin()) with check (public.is_admin());

-- private_game_states: RLS enabled, and we intentionally define NO policy for
-- anon/authenticated. Postgres denies all access by default, so only the
-- service_role (which bypasses RLS) may touch this table.

-- match_moves: participants during play; anyone once the match is finished.
drop policy if exists match_moves_select on public.match_moves;
create policy match_moves_select on public.match_moves
  for select using (
    public.is_match_participant(match_id)
    or public.is_match_finished(match_id)
  );

drop policy if exists match_moves_admin on public.match_moves;
create policy match_moves_admin on public.match_moves
  for all using (public.is_admin()) with check (public.is_admin());

-- match_events: participants; public after finish.
drop policy if exists match_events_select on public.match_events;
create policy match_events_select on public.match_events
  for select using (
    public.is_match_participant(match_id)
    or public.is_match_finished(match_id)
  );

drop policy if exists match_events_admin on public.match_events;
create policy match_events_admin on public.match_events
  for all using (public.is_admin()) with check (public.is_admin());

-- NOTE: All writes to matches/match_players/match_moves/match_events during
-- gameplay are performed by Edge Functions using the service_role key, which
-- bypasses RLS. No INSERT/UPDATE policies are granted to clients on purpose,
-- so players cannot forge moves or results.
