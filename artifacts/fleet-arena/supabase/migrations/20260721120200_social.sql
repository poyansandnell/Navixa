-- =============================================================================
-- Fleet Arena — 02: Social graph (friendships, requests, blocks, reports)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- friend_requests — directional invite
-- -----------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  receiver_id  uuid not null references public.profiles (id) on delete cascade,
  status       public.friend_request_status not null default 'pending',
  message      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self_chk check (sender_id <> receiver_id),
  constraint friend_requests_message_len_chk check (message is null or char_length(message) <= 280)
);

-- Only one *pending* request per direction.
create unique index if not exists friend_requests_pending_key
  on public.friend_requests (sender_id, receiver_id)
  where status = 'pending';
create index if not exists friend_requests_receiver_idx on public.friend_requests (receiver_id, status);
create index if not exists friend_requests_sender_idx on public.friend_requests (sender_id, status);

drop trigger if exists trg_friend_requests_updated_at on public.friend_requests;
create trigger trg_friend_requests_updated_at before update on public.friend_requests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- friendships — accepted friendships (canonical: user_a < user_b)
-- -----------------------------------------------------------------------------
create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_order_chk check (user_a < user_b)
);

create unique index if not exists friendships_pair_key on public.friendships (user_a, user_b);
create index if not exists friendships_user_a_idx on public.friendships (user_a);
create index if not exists friendships_user_b_idx on public.friendships (user_b);

drop trigger if exists trg_friendships_updated_at on public.friendships;
create trigger trg_friendships_updated_at before update on public.friendships
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- blocks — one user blocking another
-- -----------------------------------------------------------------------------
create table if not exists public.blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  constraint blocks_not_self_chk check (blocker_id <> blocked_id)
);

create unique index if not exists blocks_pair_key on public.blocks (blocker_id, blocked_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- -----------------------------------------------------------------------------
-- reports — user-generated abuse reports
-- -----------------------------------------------------------------------------
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.profiles (id) on delete cascade,
  reported_id   uuid not null references public.profiles (id) on delete cascade,
  match_id      uuid,   -- optional context; FK added after matches table exists
  category      text not null,
  description   text,
  status        public.report_status not null default 'open',
  handled_by    uuid references public.profiles (id) on delete set null,
  handled_at    timestamptz,
  resolution    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint reports_not_self_chk check (reporter_id <> reported_id),
  constraint reports_category_chk check (category in
    ('harassment', 'cheating', 'inappropriate_name', 'spam', 'other')),
  constraint reports_desc_len_chk check (description is null or char_length(description) <= 2000)
);

create index if not exists reports_reported_idx on public.reports (reported_id);
create index if not exists reports_status_idx on public.reports (status);

drop trigger if exists trg_reports_updated_at on public.reports;
create trigger trg_reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.friend_requests enable row level security;
alter table public.friendships     enable row level security;
alter table public.blocks          enable row level security;
alter table public.reports         enable row level security;

-- friend_requests: sender or receiver can see; sender inserts; either party can
-- update status (accept/decline/cancel handled by app or RPC).
drop policy if exists friend_requests_participants on public.friend_requests;
create policy friend_requests_participants on public.friend_requests
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists friend_requests_send on public.friend_requests;
create policy friend_requests_send on public.friend_requests
  for insert with check (
    sender_id = auth.uid()
    and not public.is_blocked_between(sender_id, receiver_id)
  );

drop policy if exists friend_requests_respond on public.friend_requests;
create policy friend_requests_respond on public.friend_requests
  for update using (sender_id = auth.uid() or receiver_id = auth.uid())
  with check (sender_id = auth.uid() or receiver_id = auth.uid());

-- friendships: either party can read; deletion (unfriend) by either party.
drop policy if exists friendships_participants on public.friendships;
create policy friendships_participants on public.friendships
  for select using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete using (user_a = auth.uid() or user_b = auth.uid());

-- blocks: blocker manages own blocks; only blocker can read their block rows.
drop policy if exists blocks_owner on public.blocks;
create policy blocks_owner on public.blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- reports: reporter can insert & read own reports; admins see all.
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert with check (reporter_id = auth.uid());

drop policy if exists reports_own_select on public.reports;
create policy reports_own_select on public.reports
  for select using (reporter_id = auth.uid());

drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- RPC: accept a friend request (creates canonical friendship atomically)
-- -----------------------------------------------------------------------------
create or replace function public.accept_friend_request(request_id uuid)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.friend_requests;
  a uuid;
  b uuid;
  fr public.friendships;
begin
  select * into req from public.friend_requests
    where id = request_id for update;

  if not found then
    raise exception 'friend request not found';
  end if;
  if req.receiver_id <> auth.uid() then
    raise exception 'only the receiver may accept this request';
  end if;
  if req.status <> 'pending' then
    raise exception 'request is not pending';
  end if;

  update public.friend_requests
    set status = 'accepted', responded_at = now()
    where id = request_id;

  a := least(req.sender_id, req.receiver_id);
  b := greatest(req.sender_id, req.receiver_id);

  insert into public.friendships (user_a, user_b)
    values (a, b)
    on conflict (user_a, user_b) do update set updated_at = now()
    returning * into fr;

  return fr;
end;
$$;

comment on function public.accept_friend_request(uuid) is
  'Receiver accepts a pending friend request; creates the canonical friendship row.';
