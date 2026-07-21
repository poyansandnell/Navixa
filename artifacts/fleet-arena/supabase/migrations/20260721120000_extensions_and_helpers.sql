-- =============================================================================
-- Fleet Arena — 00: Extensions & shared helper functions
-- Postgres 17 / Supabase
-- =============================================================================
-- This migration sets up prerequisite extensions, common enum types, and the
-- shared trigger/utility functions used throughout the rest of the schema.
-- =============================================================================

-- pgcrypto provides gen_random_uuid() on all Supabase projects; ensure present.
create extension if not exists "pgcrypto";
-- citext for case-insensitive uniqueness (usernames).
create extension if not exists "citext";

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type public.match_status as enum (
      'pending', 'placing', 'active', 'finished', 'abandoned', 'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'match_result') then
    create type public.match_result as enum ('win', 'loss', 'draw', 'aborted');
  end if;

  if not exists (select 1 from pg_type where typname = 'match_mode') then
    create type public.match_mode as enum ('ranked', 'casual', 'friendly', 'tournament', 'bot');
  end if;

  if not exists (select 1 from pg_type where typname = 'friend_request_status') then
    create type public.friend_request_status as enum ('pending', 'accepted', 'declined', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'queue_status') then
    create type public.queue_status as enum ('searching', 'matched', 'cancelled', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'tournament_status') then
    create type public.tournament_status as enum ('draft', 'registration', 'upcoming', 'ongoing', 'completed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'tournament_format') then
    create type public.tournament_format as enum ('single_elimination', 'double_elimination', 'round_robin', 'swiss');
  end if;

  if not exists (select 1 from pg_type where typname = 'quest_period') then
    create type public.quest_period as enum ('daily', 'weekly', 'event');
  end if;

  if not exists (select 1 from pg_type where typname = 'quest_status') then
    create type public.quest_status as enum ('in_progress', 'completed', 'claimed', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'cosmetic_type') then
    create type public.cosmetic_type as enum ('board_theme', 'ship_skin', 'avatar_frame', 'emote', 'victory_effect', 'title', 'flag');
  end if;

  if not exists (select 1 from pg_type where typname = 'cosmetic_rarity') then
    create type public.cosmetic_rarity as enum ('common', 'rare', 'epic', 'legendary');
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'friend_request', 'friend_accepted', 'match_found', 'your_turn',
      'match_result', 'tournament_start', 'tournament_result', 'quest_complete',
      'achievement_unlocked', 'system'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
  end if;

  if not exists (select 1 from pg_type where typname = 'moderation_action_type') then
    create type public.moderation_action_type as enum ('warn', 'mute', 'suspend', 'ban', 'shadow_ban', 'unban', 'note');
  end if;

  if not exists (select 1 from pg_type where typname = 'device_platform') then
    create type public.device_platform as enum ('ios', 'android', 'web');
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- Shared trigger function: keep updated_at in sync
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger helper that stamps updated_at = now() on every UPDATE.';

-- -----------------------------------------------------------------------------
-- Helper: is the current JWT an admin? (checks profiles.is_admin)
-- SECURITY DEFINER so the lookup itself is not blocked by RLS recursion.
-- -----------------------------------------------------------------------------
-- NOTE: implemented in plpgsql so relation resolution is deferred to runtime;
-- this lets us define the helper before the profiles table is created.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v boolean;
begin
  select p.is_admin into v from public.profiles p where p.id = uid;
  return coalesce(v, false);
end;
$fn$;

comment on function public.is_admin(uuid) is
  'Returns true when the given (or current) user has profiles.is_admin = true. '
  'SECURITY DEFINER to avoid RLS recursion; used inside admin policies.';

-- -----------------------------------------------------------------------------
-- Helper: has the current user blocked, or been blocked by, another user?
-- Used to hide blocked users from queries/policies.
-- -----------------------------------------------------------------------------
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v boolean;
begin
  select exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b)
       or (bl.blocker_id = b and bl.blocked_id = a)
  ) into v;
  return v;
end;
$fn$;

comment on function public.is_blocked_between(uuid, uuid) is
  'Returns true if either user has blocked the other. SECURITY DEFINER.';
