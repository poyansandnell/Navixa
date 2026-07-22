-- =============================================================================
-- Navixa — 07: Notifications, moderation actions, audit logs, app config
-- =============================================================================

-- -----------------------------------------------------------------------------
-- notifications — in-app notification feed
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.notification_type not null,
  title_key   text,
  body_key    text,
  title       text,
  body        text,
  data        jsonb not null default '{}'::jsonb,
  is_read     boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc) where deleted_at is null;
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where is_read = false and deleted_at is null;

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- moderation_actions — admin actions taken against users
-- -----------------------------------------------------------------------------
create table if not exists public.moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  target_id    uuid not null references public.profiles (id) on delete cascade,
  moderator_id uuid references public.profiles (id) on delete set null,
  report_id    uuid references public.reports (id) on delete set null,
  action       public.moderation_action_type not null,
  reason       text,
  notes        text,
  expires_at   timestamptz,          -- for mutes/suspensions
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists moderation_actions_target_idx on public.moderation_actions (target_id);
create index if not exists moderation_actions_active_idx
  on public.moderation_actions (target_id) where is_active = true;

drop trigger if exists trg_moderation_actions_updated_at on public.moderation_actions;
create trigger trg_moderation_actions_updated_at before update on public.moderation_actions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- audit_logs — append-only record of privileged/security events
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- -----------------------------------------------------------------------------
-- app_config — server-side feature flags & tunables (key/value)
-- -----------------------------------------------------------------------------
create table if not exists public.app_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_public   boolean not null default false,  -- public flags readable by clients
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_app_config_updated_at on public.app_config;
create trigger trg_app_config_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.notifications      enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.app_config         enable row level security;

-- notifications: owner reads & marks read/deletes own; server inserts.
drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications
  for select using (user_id = auth.uid() and deleted_at is null);
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_admin on public.notifications;
create policy notifications_admin on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

-- moderation_actions: admins only. Additionally, a user can see *active* bans/
-- mutes against themselves (so the client can show a message).
drop policy if exists moderation_actions_self_active on public.moderation_actions;
create policy moderation_actions_self_active on public.moderation_actions
  for select using (target_id = auth.uid() and is_active = true);
drop policy if exists moderation_actions_admin on public.moderation_actions;
create policy moderation_actions_admin on public.moderation_actions
  for all using (public.is_admin()) with check (public.is_admin());

-- audit_logs: admins read only; inserts are server-side (service_role).
drop policy if exists audit_logs_admin on public.audit_logs;
create policy audit_logs_admin on public.audit_logs
  for select using (public.is_admin());

-- app_config: public flags readable by everyone; everything else admin-only.
drop policy if exists app_config_public_read on public.app_config;
create policy app_config_public_read on public.app_config
  for select using (is_public = true);
drop policy if exists app_config_admin on public.app_config;
create policy app_config_admin on public.app_config
  for all using (public.is_admin()) with check (public.is_admin());
