-- =============================================================================
-- Navixa — 12: Admin & moderation support
-- =============================================================================
-- Adds the schema pieces the admin-actions Edge Function relies on that are not
-- present in the base schema:
--   * match_status += 'annulled'          -> a voided/annulled match
--   * banned_usernames                     -> forbidden username substrings table
--   * is_username_banned(text)             -> helper used by admin function + a
--                                             profile-update guard trigger
--   * annul_match(...)                     -> voids a match and reverts rating via
--                                             compensating rating_history rows
--
-- Everything server-privileged here is SECURITY DEFINER with a pinned
-- search_path and its EXECUTE revoked from PUBLIC (service_role only).
-- DO NOT apply this migration by hand — the platform / CLI applies migrations
-- in timestamp order.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum extension: an annulled (voided) match is distinct from cancelled.
-- ALTER TYPE ... ADD VALUE cannot run inside a txn block in older PG; guard it.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
    where t.typname = 'match_status' and e.enumlabel = 'annulled'
  ) then
    alter type public.match_status add value 'annulled';
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- Annul support columns on matches
-- -----------------------------------------------------------------------------
alter table public.matches
  add column if not exists annulled_at     timestamptz,
  add column if not exists annulled_by     uuid references public.profiles (id) on delete set null,
  add column if not exists annul_reason    text;

-- -----------------------------------------------------------------------------
-- banned_usernames — forbidden username substrings (case-insensitive).
-- A username is rejected when it CONTAINS any active banned pattern.
-- -----------------------------------------------------------------------------
create table if not exists public.banned_usernames (
  id          uuid primary key default gen_random_uuid(),
  pattern     citext not null,
  reason      text,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists banned_usernames_pattern_key
  on public.banned_usernames (pattern);
create index if not exists banned_usernames_active_idx
  on public.banned_usernames (is_active) where is_active = true;

drop trigger if exists trg_banned_usernames_updated_at on public.banned_usernames;
create trigger trg_banned_usernames_updated_at before update on public.banned_usernames
  for each row execute function public.set_updated_at();

comment on table public.banned_usernames is
  'Forbidden username substrings. A candidate username is rejected when it '
  'contains any active pattern (case-insensitive). Managed by admins.';

-- Seed a small starter list of forbidden words.
insert into public.banned_usernames (pattern, reason) values
  ('admin',     'Impersonation of staff'),
  ('moderator', 'Impersonation of staff'),
  ('navixa','Impersonation of the brand'),
  ('support',   'Impersonation of staff'),
  ('nigger',    'Hate speech'),
  ('faggot',    'Hate speech')
on conflict (pattern) do nothing;

-- -----------------------------------------------------------------------------
-- is_username_banned — true when a candidate contains any active banned pattern.
-- -----------------------------------------------------------------------------
create or replace function public.is_username_banned(p_username text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v boolean;
begin
  if p_username is null then
    return false;
  end if;
  select exists (
    select 1 from public.banned_usernames b
    where b.is_active = true
      and lower(p_username) like '%' || lower(b.pattern::text) || '%'
  ) into v;
  return v;
end;
$$;

comment on function public.is_username_banned(text) is
  'Returns true when the candidate username contains any active banned pattern. '
  'SECURITY DEFINER so the lookup is not blocked by RLS.';

-- -----------------------------------------------------------------------------
-- Profile-update guard: reject usernames containing a banned pattern.
-- Only fires when the username is being set/changed (not on unrelated updates).
-- Admins are exempt (they may need to rename accounts during moderation).
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' or new.username is distinct from old.username) then
    if not coalesce(new.is_admin, false)
       and public.is_username_banned(new.username::text) then
      raise exception 'username contains a forbidden word'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_username on public.profiles;
create trigger trg_guard_profile_username
  before insert or update of username on public.profiles
  for each row execute function public.guard_profile_username();

comment on function public.guard_profile_username() is
  'Rejects profile usernames that contain a forbidden word (banned_usernames). '
  'Admins are exempt. SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- annul_match — void a match and revert its rating effects.
--   * Sets matches.status = 'annulled' (+ audit columns).
--   * For every rating_history row tied to the match, writes a compensating
--     row (delta = -original) and rolls the current ratings row back by the
--     same amount, plus decrements the win/loss/draw + games_played counters.
--   Idempotent: a second call is a no-op once the match is annulled.
-- -----------------------------------------------------------------------------
create or replace function public.annul_match(
  p_match_id uuid,
  p_admin_id uuid,
  p_reason   text default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  rh      record;
begin
  if p_match_id is null then
    raise exception 'p_match_id is required';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;

  -- Idempotency: already annulled.
  if v_match.status = 'annulled' then
    return v_match;
  end if;

  -- Compensate each original rating change with an inverse entry and roll the
  -- current rating back. Only compensate rows we have not already reversed.
  for rh in
    select * from public.rating_history
    where match_id = p_match_id
      and rating_delta <> 0
  loop
    -- Skip if a compensating row already exists (defensive against re-runs).
    if exists (
      select 1 from public.rating_history c
      where c.match_id = p_match_id
        and c.player_id = rh.player_id
        and c.rating_delta = -rh.rating_delta
        and c.created_at > rh.created_at
    ) then
      continue;
    end if;

    -- Roll back the current rating row and its counters.
    update public.ratings r
      set rating       = greatest(0, least(4000, r.rating - rh.rating_delta)),
          games_played = greatest(0, r.games_played - 1),
          wins         = greatest(0, r.wins   - case when rh.result = 'win'  then 1 else 0 end),
          losses       = greatest(0, r.losses - case when rh.result = 'loss' then 1 else 0 end),
          draws        = greatest(0, r.draws  - case when rh.result = 'draw' then 1 else 0 end),
          updated_at   = now()
      where r.player_id = rh.player_id and r.mode = rh.mode;

    -- Record the compensation for auditability / graphs.
    insert into public.rating_history
      (player_id, mode, match_id, rating_before, rating_after, rating_delta, result)
    values
      (rh.player_id, rh.mode, p_match_id,
       rh.rating_after, rh.rating_after - rh.rating_delta, -rh.rating_delta, 'aborted');
  end loop;

  update public.matches
    set status      = 'annulled',
        annulled_at = now(),
        annulled_by = p_admin_id,
        annul_reason = p_reason,
        updated_at  = now()
    where id = p_match_id
    returning * into v_match;

  return v_match;
end;
$$;

comment on function public.annul_match(uuid, uuid, text) is
  'Voids a match and reverts its rating effects via compensating rating_history '
  'rows. Idempotent. SECURITY DEFINER — call from the admin Edge Function only.';

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.banned_usernames enable row level security;

-- banned_usernames: admins only (everything is done server-side anyway).
drop policy if exists banned_usernames_admin on public.banned_usernames;
create policy banned_usernames_admin on public.banned_usernames
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- Grants: server-only helpers. Revoke EXECUTE from PUBLIC (service_role only).
-- =============================================================================
revoke execute on function public.is_username_banned(text) from public;
revoke execute on function public.guard_profile_username() from public;
revoke execute on function public.annul_match(uuid, uuid, text) from public;
