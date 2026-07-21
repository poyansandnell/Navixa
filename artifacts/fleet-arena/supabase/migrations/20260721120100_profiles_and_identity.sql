-- =============================================================================
-- Fleet Arena — 01: Profiles, settings, devices & push tokens
-- =============================================================================
-- NOTE: emails live ONLY in auth.users. The public profiles table must never
-- store or expose email. Client apps read profiles via the anon/authenticated
-- role and RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles — public identity, 1:1 with auth.users
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      citext not null,
  display_name  text,
  bio           text,
  avatar_url    text,
  country_code  char(2),                       -- ISO 3166-1 alpha-2
  locale        text not null default 'en',
  is_admin      boolean not null default false,
  is_bot        boolean not null default false,
  is_verified   boolean not null default false,
  xp            integer not null default 0,
  level         integer not null default 1,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint profiles_username_len_chk check (char_length(username::text) between 3 and 24),
  constraint profiles_username_fmt_chk check (username::text ~ '^[a-zA-Z0-9_]+$'),
  constraint profiles_country_chk check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint profiles_xp_chk check (xp >= 0),
  constraint profiles_level_chk check (level >= 1)
);

-- Case-insensitive unique username among non-deleted profiles.
create unique index if not exists profiles_username_key
  on public.profiles (username) where deleted_at is null;
create index if not exists profiles_country_idx on public.profiles (country_code);
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

comment on table public.profiles is
  'Public player identity. NEVER stores email (see auth.users). is_admin gates server-side admin checks.';

-- Auto-create a profile row when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
begin
  base_username := lower(regexp_replace(coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    'player'
  ), '[^a-zA-Z0-9_]', '', 'g'));

  if char_length(base_username) < 3 then
    base_username := 'player';
  end if;

  insert into public.profiles (id, username, display_name, locale)
  values (
    new.id,
    -- guarantee uniqueness by appending a short suffix from the uuid
    left(base_username, 18) || '_' || left(replace(new.id::text, '-', ''), 5),
    coalesce(new.raw_user_meta_data->>'display_name', base_username),
    coalesce(new.raw_user_meta_data->>'locale', 'en')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- user_settings — private per-user preferences (1:1)
-- -----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id               uuid primary key references public.profiles (id) on delete cascade,
  theme                 text not null default 'system',
  sound_enabled         boolean not null default true,
  music_enabled         boolean not null default true,
  haptics_enabled       boolean not null default true,
  notifications_enabled boolean not null default true,
  push_matches          boolean not null default true,
  push_turns            boolean not null default true,
  push_social           boolean not null default true,
  push_marketing        boolean not null default false,
  show_online_status    boolean not null default true,
  allow_friend_requests boolean not null default true,
  allow_spectators      boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint user_settings_theme_chk check (theme in ('system', 'light', 'dark'))
);

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- devices — known devices for a user (for session/security context)
-- -----------------------------------------------------------------------------
create table if not exists public.devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  platform     public.device_platform not null,
  device_name  text,
  os_version   text,
  app_version  text,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists devices_user_idx on public.devices (user_id);

drop trigger if exists trg_devices_updated_at on public.devices;
create trigger trg_devices_updated_at before update on public.devices
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- push_tokens — Expo/FCM/APNs push tokens
-- -----------------------------------------------------------------------------
create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  device_id  uuid references public.devices (id) on delete set null,
  token      text not null,
  platform   public.device_platform not null,
  provider   text not null default 'expo',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_provider_chk check (provider in ('expo', 'fcm', 'apns'))
);

create unique index if not exists push_tokens_token_key on public.push_tokens (token);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id) where is_active;

drop trigger if exists trg_push_tokens_updated_at on public.push_tokens;
create trigger trg_push_tokens_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;
alter table public.devices       enable row level security;
alter table public.push_tokens   enable row level security;

-- profiles: readable by anyone who is not blocked; deleted profiles hidden.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    deleted_at is null
    and not public.is_blocked_between(auth.uid(), id)
  );

drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select on public.profiles
  for select using (public.is_admin());

-- Users may insert their own profile row (id must equal auth.uid()).
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- Users may update their own profile, but NOT the privileged is_admin/is_bot/
-- is_verified/xp/level columns (those are enforced via a column-guard trigger).
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Prevent non-admins from escalating privileged columns on their own row.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.is_admin    := old.is_admin;
  new.is_bot      := old.is_bot;
  new.is_verified := old.is_verified;
  new.xp          := old.xp;
  new.level       := old.level;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_privileged on public.profiles;
create trigger trg_profiles_guard_privileged before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- user_settings: owner only.
drop policy if exists user_settings_owner on public.user_settings;
create policy user_settings_owner on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- devices: owner only.
drop policy if exists devices_owner on public.devices;
create policy devices_owner on public.devices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- push_tokens: owner only.
drop policy if exists push_tokens_owner on public.push_tokens;
create policy push_tokens_owner on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
