-- =============================================================================
-- Fleet Arena — 05: Tournaments, entries, rounds & tournament matches
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tournaments
-- -----------------------------------------------------------------------------
create table if not exists public.tournaments (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  format           public.tournament_format not null default 'single_elimination',
  status           public.tournament_status not null default 'draft',
  mode             public.match_mode not null default 'tournament',
  max_players      integer not null default 16,
  min_players      integer not null default 2,
  board_size       smallint not null default 10,
  entry_fee_coins  integer not null default 0,
  prize_pool       jsonb not null default '{}'::jsonb,
  created_by       uuid references public.profiles (id) on delete set null,
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint tournaments_players_chk check (max_players >= min_players and min_players >= 2),
  constraint tournaments_board_chk check (board_size between 8 and 16),
  constraint tournaments_fee_chk check (entry_fee_coins >= 0)
);

create index if not exists tournaments_status_idx on public.tournaments (status);
create index if not exists tournaments_starts_idx on public.tournaments (starts_at);

drop trigger if exists trg_tournaments_updated_at on public.tournaments;
create trigger trg_tournaments_updated_at before update on public.tournaments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- tournament_entries — registered players
-- -----------------------------------------------------------------------------
create table if not exists public.tournament_entries (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  player_id      uuid not null references public.profiles (id) on delete cascade,
  seed           integer,
  final_rank     integer,
  wins           integer not null default 0,
  losses         integer not null default 0,
  eliminated     boolean not null default false,
  registered_at  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists tournament_entries_key
  on public.tournament_entries (tournament_id, player_id);
create index if not exists tournament_entries_tournament_idx
  on public.tournament_entries (tournament_id);

drop trigger if exists trg_tournament_entries_updated_at on public.tournament_entries;
create trigger trg_tournament_entries_updated_at before update on public.tournament_entries
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- tournament_rounds
-- -----------------------------------------------------------------------------
create table if not exists public.tournament_rounds (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  round_number   integer not null,
  name           text,
  status         public.tournament_status not null default 'upcoming',
  starts_at      timestamptz,
  ends_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint tournament_rounds_number_chk check (round_number >= 1)
);

create unique index if not exists tournament_rounds_key
  on public.tournament_rounds (tournament_id, round_number);

drop trigger if exists trg_tournament_rounds_updated_at on public.tournament_rounds;
create trigger trg_tournament_rounds_updated_at before update on public.tournament_rounds
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- tournament_matches — bracket slots (each maps to a real match once played)
-- -----------------------------------------------------------------------------
create table if not exists public.tournament_matches (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid not null references public.tournaments (id) on delete cascade,
  round_id         uuid not null references public.tournament_rounds (id) on delete cascade,
  bracket_position integer not null,
  match_id         uuid references public.matches (id) on delete set null,
  player_one_id    uuid references public.profiles (id) on delete set null,
  player_two_id    uuid references public.profiles (id) on delete set null,
  winner_id        uuid references public.profiles (id) on delete set null,
  -- for bracket advancement: the next slot the winner flows into
  next_match_id    uuid references public.tournament_matches (id) on delete set null,
  next_slot        smallint,   -- 1 => player_one, 2 => player_two of next match
  status           public.match_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint tm_bracket_pos_chk check (bracket_position >= 1),
  constraint tm_next_slot_chk check (next_slot is null or next_slot in (1, 2))
);

create unique index if not exists tournament_matches_slot_key
  on public.tournament_matches (round_id, bracket_position);
create index if not exists tournament_matches_tournament_idx
  on public.tournament_matches (tournament_id);
create index if not exists tournament_matches_match_idx
  on public.tournament_matches (match_id);

drop trigger if exists trg_tournament_matches_updated_at on public.tournament_matches;
create trigger trg_tournament_matches_updated_at before update on public.tournament_matches
  for each row execute function public.set_updated_at();

-- Deferred FK: matches.tournament_match_id -> tournament_matches.id
alter table public.matches
  drop constraint if exists matches_tournament_match_fk;
alter table public.matches
  add constraint matches_tournament_match_fk
  foreign key (tournament_match_id) references public.tournament_matches (id) on delete set null;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.tournaments         enable row level security;
alter table public.tournament_entries  enable row level security;
alter table public.tournament_rounds   enable row level security;
alter table public.tournament_matches  enable row level security;

-- tournaments: public read (except drafts); admins/creators manage.
drop policy if exists tournaments_public_read on public.tournaments;
create policy tournaments_public_read on public.tournaments
  for select using (deleted_at is null and status <> 'draft');
drop policy if exists tournaments_owner_read on public.tournaments;
create policy tournaments_owner_read on public.tournaments
  for select using (created_by = auth.uid());
drop policy if exists tournaments_admin on public.tournaments;
create policy tournaments_admin on public.tournaments
  for all using (public.is_admin()) with check (public.is_admin());

-- tournament_entries: public read; players may self-register (insert own row).
drop policy if exists tournament_entries_read on public.tournament_entries;
create policy tournament_entries_read on public.tournament_entries
  for select using (true);
drop policy if exists tournament_entries_register on public.tournament_entries;
create policy tournament_entries_register on public.tournament_entries
  for insert with check (player_id = auth.uid());
drop policy if exists tournament_entries_withdraw on public.tournament_entries;
create policy tournament_entries_withdraw on public.tournament_entries
  for delete using (player_id = auth.uid());
drop policy if exists tournament_entries_admin on public.tournament_entries;
create policy tournament_entries_admin on public.tournament_entries
  for all using (public.is_admin()) with check (public.is_admin());

-- tournament_rounds & matches: public read; admin/server manage.
drop policy if exists tournament_rounds_read on public.tournament_rounds;
create policy tournament_rounds_read on public.tournament_rounds
  for select using (true);
drop policy if exists tournament_rounds_admin on public.tournament_rounds;
create policy tournament_rounds_admin on public.tournament_rounds
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists tournament_matches_read on public.tournament_matches;
create policy tournament_matches_read on public.tournament_matches
  for select using (true);
drop policy if exists tournament_matches_admin on public.tournament_matches;
create policy tournament_matches_admin on public.tournament_matches
  for all using (public.is_admin()) with check (public.is_admin());
