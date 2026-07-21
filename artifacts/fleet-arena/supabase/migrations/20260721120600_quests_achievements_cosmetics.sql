-- =============================================================================
-- Fleet Arena — 06: Daily quests, achievements, cosmetics & inventory
-- =============================================================================

-- -----------------------------------------------------------------------------
-- daily_quests — quest catalog (definitions)
-- -----------------------------------------------------------------------------
create table if not exists public.daily_quests (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  period        public.quest_period not null default 'daily',
  title_key     text not null,           -- i18n key
  description_key text not null,         -- i18n key
  metric        text not null,           -- e.g. 'wins', 'hits', 'matches_played'
  goal          integer not null,
  reward_xp     integer not null default 0,
  reward_coins  integer not null default 0,
  reward_item_id uuid,                    -- FK added after cosmetic_items exists
  is_active     boolean not null default true,
  active_from   date,
  active_to     date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint daily_quests_goal_chk check (goal >= 1),
  constraint daily_quests_reward_chk check (reward_xp >= 0 and reward_coins >= 0)
);

create unique index if not exists daily_quests_code_key on public.daily_quests (code);
create index if not exists daily_quests_active_idx on public.daily_quests (is_active, period);

drop trigger if exists trg_daily_quests_updated_at on public.daily_quests;
create trigger trg_daily_quests_updated_at before update on public.daily_quests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- achievements — achievement catalog
-- -----------------------------------------------------------------------------
create table if not exists public.achievements (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  title_key      text not null,
  description_key text not null,
  icon           text,
  category       text not null default 'general',
  points         integer not null default 10,
  metric         text,
  goal           integer,
  is_secret      boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint achievements_points_chk check (points >= 0)
);

create unique index if not exists achievements_code_key on public.achievements (code);

drop trigger if exists trg_achievements_updated_at on public.achievements;
create trigger trg_achievements_updated_at before update on public.achievements
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- cosmetic_items — store catalog of cosmetics
-- -----------------------------------------------------------------------------
create table if not exists public.cosmetic_items (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  type          public.cosmetic_type not null,
  rarity        public.cosmetic_rarity not null default 'common',
  name_key      text not null,           -- i18n key
  description_key text,                   -- i18n key
  preview_url   text,
  asset_ref     text,
  price_coins   integer,                  -- null => not purchasable with coins
  price_cents   integer,                  -- null => not a real-money product
  is_purchasable boolean not null default true,
  is_default    boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint cosmetic_items_price_chk check (
    (price_coins is null or price_coins >= 0) and (price_cents is null or price_cents >= 0)
  )
);

create unique index if not exists cosmetic_items_code_key on public.cosmetic_items (code);
create index if not exists cosmetic_items_type_idx on public.cosmetic_items (type, sort_order);

drop trigger if exists trg_cosmetic_items_updated_at on public.cosmetic_items;
create trigger trg_cosmetic_items_updated_at before update on public.cosmetic_items
  for each row execute function public.set_updated_at();

-- Deferred FKs now that cosmetic_items exists.
alter table public.daily_quests drop constraint if exists daily_quests_reward_item_fk;
alter table public.daily_quests
  add constraint daily_quests_reward_item_fk
  foreign key (reward_item_id) references public.cosmetic_items (id) on delete set null;

-- -----------------------------------------------------------------------------
-- user_quests — per-user quest progress
-- -----------------------------------------------------------------------------
create table if not exists public.user_quests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  quest_id     uuid not null references public.daily_quests (id) on delete cascade,
  quest_date   date not null default current_date,
  progress     integer not null default 0,
  status       public.quest_status not null default 'in_progress',
  completed_at timestamptz,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint user_quests_progress_chk check (progress >= 0)
);

create unique index if not exists user_quests_key
  on public.user_quests (user_id, quest_id, quest_date);
create index if not exists user_quests_user_idx on public.user_quests (user_id, status);

drop trigger if exists trg_user_quests_updated_at on public.user_quests;
create trigger trg_user_quests_updated_at before update on public.user_quests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_achievements — unlocked achievements
-- -----------------------------------------------------------------------------
create table if not exists public.user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  progress       integer not null default 0,
  unlocked       boolean not null default false,
  unlocked_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint user_achievements_progress_chk check (progress >= 0)
);

create unique index if not exists user_achievements_key
  on public.user_achievements (user_id, achievement_id);
create index if not exists user_achievements_user_idx on public.user_achievements (user_id);

drop trigger if exists trg_user_achievements_updated_at on public.user_achievements;
create trigger trg_user_achievements_updated_at before update on public.user_achievements
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_inventory — owned cosmetics
-- -----------------------------------------------------------------------------
create table if not exists public.user_inventory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  item_id      uuid not null references public.cosmetic_items (id) on delete cascade,
  source       text not null default 'purchase',
  acquired_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  constraint user_inventory_source_chk check (source in ('purchase', 'reward', 'grant', 'default'))
);

create unique index if not exists user_inventory_key on public.user_inventory (user_id, item_id);
create index if not exists user_inventory_user_idx on public.user_inventory (user_id);

-- -----------------------------------------------------------------------------
-- equipped_cosmetics — which item is equipped per slot/type
-- -----------------------------------------------------------------------------
create table if not exists public.equipped_cosmetics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.cosmetic_type not null,
  item_id     uuid not null references public.cosmetic_items (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One equipped item per (user, type) slot.
create unique index if not exists equipped_cosmetics_slot_key
  on public.equipped_cosmetics (user_id, type);

drop trigger if exists trg_equipped_cosmetics_updated_at on public.equipped_cosmetics;
create trigger trg_equipped_cosmetics_updated_at before update on public.equipped_cosmetics
  for each row execute function public.set_updated_at();

-- Ensure equipped item is actually owned by the user.
create or replace function public.guard_equipped_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_inventory ui
    where ui.user_id = new.user_id and ui.item_id = new.item_id
  ) then
    raise exception 'cannot equip an item the user does not own';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipped_ownership on public.equipped_cosmetics;
create trigger trg_equipped_ownership before insert or update on public.equipped_cosmetics
  for each row execute function public.guard_equipped_ownership();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.daily_quests       enable row level security;
alter table public.achievements        enable row level security;
alter table public.cosmetic_items      enable row level security;
alter table public.user_quests         enable row level security;
alter table public.user_achievements   enable row level security;
alter table public.user_inventory      enable row level security;
alter table public.equipped_cosmetics  enable row level security;

-- Catalog tables: public read of active rows; admin manages.
drop policy if exists daily_quests_read on public.daily_quests;
create policy daily_quests_read on public.daily_quests
  for select using (is_active = true);
drop policy if exists daily_quests_admin on public.daily_quests;
create policy daily_quests_admin on public.daily_quests
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements
  for select using (is_active = true);
drop policy if exists achievements_admin on public.achievements;
create policy achievements_admin on public.achievements
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists cosmetic_items_read on public.cosmetic_items;
create policy cosmetic_items_read on public.cosmetic_items
  for select using (deleted_at is null);
drop policy if exists cosmetic_items_admin on public.cosmetic_items;
create policy cosmetic_items_admin on public.cosmetic_items
  for all using (public.is_admin()) with check (public.is_admin());

-- Per-user tables: owner read; writes typically server-side (grant/rewards),
-- but users may read their own. equipped is user-managed.
drop policy if exists user_quests_owner on public.user_quests;
create policy user_quests_owner on public.user_quests
  for select using (user_id = auth.uid());
drop policy if exists user_quests_admin on public.user_quests;
create policy user_quests_admin on public.user_quests
  for all using (public.is_admin()) with check (public.is_admin());

-- Achievements & inventory are publicly viewable (shown on profiles),
-- but only server-side grants can insert/update.
drop policy if exists user_achievements_read on public.user_achievements;
create policy user_achievements_read on public.user_achievements
  for select using (true);
drop policy if exists user_achievements_admin on public.user_achievements;
create policy user_achievements_admin on public.user_achievements
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists user_inventory_read on public.user_inventory;
create policy user_inventory_read on public.user_inventory
  for select using (user_id = auth.uid());
drop policy if exists user_inventory_admin on public.user_inventory;
create policy user_inventory_admin on public.user_inventory
  for all using (public.is_admin()) with check (public.is_admin());

-- equipped_cosmetics: publicly readable (rendered on other players' games);
-- owner manages their own equipped set.
drop policy if exists equipped_read on public.equipped_cosmetics;
create policy equipped_read on public.equipped_cosmetics
  for select using (true);
drop policy if exists equipped_owner_write on public.equipped_cosmetics;
create policy equipped_owner_write on public.equipped_cosmetics
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
