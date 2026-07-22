-- =============================================================================
-- Navixa — 04: Matchmaking queue, ratings, rating history, leaderboards
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ratings — current rating per player per mode
-- -----------------------------------------------------------------------------
create table if not exists public.ratings (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.profiles (id) on delete cascade,
  mode          public.match_mode not null default 'ranked',
  rating        integer not null default 1200,
  rd            integer not null default 350,        -- rating deviation (Glicko-ish)
  volatility    numeric(6,5) not null default 0.06000,
  games_played  integer not null default 0,
  wins          integer not null default 0,
  losses        integer not null default 0,
  draws         integer not null default 0,
  win_streak    integer not null default 0,
  best_rating   integer not null default 1200,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ratings_rating_chk check (rating between 0 and 4000),
  constraint ratings_counts_chk check (games_played >= 0 and wins >= 0 and losses >= 0 and draws >= 0)
);

create unique index if not exists ratings_player_mode_key on public.ratings (player_id, mode);
create index if not exists ratings_mode_rating_idx on public.ratings (mode, rating desc);

drop trigger if exists trg_ratings_updated_at on public.ratings;
create trigger trg_ratings_updated_at before update on public.ratings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- rating_history — one row per rating change (for graphs / audit)
-- -----------------------------------------------------------------------------
create table if not exists public.rating_history (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.profiles (id) on delete cascade,
  mode          public.match_mode not null default 'ranked',
  match_id      uuid references public.matches (id) on delete set null,
  rating_before integer not null,
  rating_after  integer not null,
  rating_delta  integer not null,
  result        public.match_result,
  created_at    timestamptz not null default now()
);

create index if not exists rating_history_player_idx on public.rating_history (player_id, created_at desc);
create index if not exists rating_history_match_idx on public.rating_history (match_id);

-- -----------------------------------------------------------------------------
-- matchmaking_queue — pending players looking for a game
-- -----------------------------------------------------------------------------
create table if not exists public.matchmaking_queue (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.profiles (id) on delete cascade,
  mode          public.match_mode not null default 'ranked',
  rating        integer not null default 1200,
  region        text,
  board_size    smallint not null default 10,
  status        public.queue_status not null default 'searching',
  matched_match_id uuid references public.matches (id) on delete set null,
  enqueued_at   timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '5 minutes'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint mmq_board_size_chk check (board_size between 8 and 16)
);

-- A player can only sit in the queue once per mode while searching.
create unique index if not exists mmq_active_player_key
  on public.matchmaking_queue (player_id, mode)
  where status = 'searching';
create index if not exists mmq_search_idx
  on public.matchmaking_queue (mode, status, rating)
  where status = 'searching';

drop trigger if exists trg_mmq_updated_at on public.matchmaking_queue;
create trigger trg_mmq_updated_at before update on public.matchmaking_queue
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- leaderboard_snapshots — periodic frozen rankings
-- -----------------------------------------------------------------------------
create table if not exists public.leaderboard_snapshots (
  id             uuid primary key default gen_random_uuid(),
  scope          text not null default 'global',   -- 'global' or a country code
  mode           public.match_mode not null default 'ranked',
  player_id      uuid not null references public.profiles (id) on delete cascade,
  rank           integer not null,
  rating         integer not null,
  games_played   integer not null default 0,
  snapshot_date  date not null default current_date,
  created_at     timestamptz not null default now(),
  constraint leaderboard_rank_chk check (rank >= 1)
);

create unique index if not exists leaderboard_snapshot_key
  on public.leaderboard_snapshots (snapshot_date, scope, mode, player_id);
create index if not exists leaderboard_snapshot_rank_idx
  on public.leaderboard_snapshots (snapshot_date, scope, mode, rank);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.ratings               enable row level security;
alter table public.rating_history         enable row level security;
alter table public.matchmaking_queue      enable row level security;
alter table public.leaderboard_snapshots  enable row level security;

-- ratings: public read (for leaderboards / profiles); writes server-side only.
drop policy if exists ratings_public_read on public.ratings;
create policy ratings_public_read on public.ratings for select using (true);
drop policy if exists ratings_admin on public.ratings;
create policy ratings_admin on public.ratings
  for all using (public.is_admin()) with check (public.is_admin());

-- rating_history: owner reads own; public reads only for finished-match rows.
drop policy if exists rating_history_owner on public.rating_history;
create policy rating_history_owner on public.rating_history
  for select using (player_id = auth.uid());
drop policy if exists rating_history_public_finished on public.rating_history;
create policy rating_history_public_finished on public.rating_history
  for select using (match_id is not null and public.is_match_finished(match_id));
drop policy if exists rating_history_admin on public.rating_history;
create policy rating_history_admin on public.rating_history
  for all using (public.is_admin()) with check (public.is_admin());

-- matchmaking_queue: player sees & manages own row; matching done server-side.
drop policy if exists mmq_owner on public.matchmaking_queue;
create policy mmq_owner on public.matchmaking_queue
  for select using (player_id = auth.uid());
drop policy if exists mmq_owner_cancel on public.matchmaking_queue;
create policy mmq_owner_cancel on public.matchmaking_queue
  for delete using (player_id = auth.uid());
drop policy if exists mmq_admin on public.matchmaking_queue;
create policy mmq_admin on public.matchmaking_queue
  for all using (public.is_admin()) with check (public.is_admin());

-- leaderboard_snapshots: public read; writes server-side only.
drop policy if exists leaderboard_public_read on public.leaderboard_snapshots;
create policy leaderboard_public_read on public.leaderboard_snapshots
  for select using (true);
drop policy if exists leaderboard_admin on public.leaderboard_snapshots;
create policy leaderboard_admin on public.leaderboard_snapshots
  for all using (public.is_admin()) with check (public.is_admin());
