/**
 * Supabase data-access layer for the social graph: profiles, friends, requests,
 * blocks, reports, ratings and leaderboards. All queries run with the anon key
 * under RLS; writes are limited to what the policies in the social migration
 * allow (friend_requests insert/update, friendships delete, blocks all, reports
 * insert). Friendship creation goes through the accept_friend_request RPC.
 */
import { supabase } from '@/lib/supabase';

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  xp: number;
  level: number;
  last_seen_at: string | null;
  created_at: string;
  is_bot?: boolean;
}

export interface RatingRow {
  player_id: string;
  rating: number;
  best_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  win_streak: number;
}

export interface FriendRequestRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  message: string | null;
  created_at: string;
}

export interface PlayerStats {
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  total_shots: number;
  total_hits: number;
  accuracy: number;
  ships_sunk: number;
  current_rating: number;
  best_rating: number;
}

/** Combined friend record used by the UI. */
export interface FriendEntry {
  friendshipId: string;
  profile: ProfileRow;
  rating: number | null;
  online: boolean;
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ONLINE_WINDOW_MS;
}

const PROFILE_COLS =
  'id, username, display_name, avatar_url, country_code, xp, level, last_seen_at, created_at, is_bot';

/** Fetch a single profile by id. */
export async function fetchProfile(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow) ?? null;
}

/** Fetch the ranked rating row for a player. */
export async function fetchRating(playerId: string): Promise<RatingRow | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('player_id, rating, best_rating, games_played, wins, losses, win_streak')
    .eq('player_id', playerId)
    .eq('mode', 'ranked')
    .maybeSingle();
  if (error) throw error;
  return (data as RatingRow) ?? null;
}

/** Aggregate lifetime stats via the player_stats RPC. */
export async function fetchPlayerStats(playerId: string): Promise<PlayerStats | null> {
  const { data, error } = await supabase.rpc('player_stats', { p_player_id: playerId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PlayerStats) ?? null;
}

/** Fetch ratings for a set of players (used to decorate lists). */
export async function fetchRatingsFor(playerIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (playerIds.length === 0) return map;
  const { data, error } = await supabase
    .from('ratings')
    .select('player_id, rating')
    .eq('mode', 'ranked')
    .in('player_id', playerIds);
  if (error) throw error;
  for (const r of (data ?? []) as { player_id: string; rating: number }[]) {
    map.set(r.player_id, r.rating);
  }
  return map;
}

/** Ids the current user has blocked (used to filter search results). */
export async function fetchBlockedIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('blocks').select('blocked_id');
  if (error) throw error;
  return new Set(((data ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id));
}

/**
 * Search users by (case-insensitive) username prefix, excluding self and blocked
 * users. citext + ilike makes this a case-insensitive match.
 */
export async function searchUsers(query: string, selfId: string): Promise<ProfileRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .ilike('username', `${q}%`)
    .neq('id', selfId)
    .limit(20);
  if (error) throw error;
  const blocked = await fetchBlockedIds();
  return ((data ?? []) as ProfileRow[]).filter((p) => !blocked.has(p.id));
}

/** Accepted friends of the current user, decorated with rating + online. */
export async function fetchFriends(selfId: string): Promise<FriendEntry[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, user_a, user_b, created_at');
  if (error) throw error;
  const rows = (data ?? []) as { id: string; user_a: string; user_b: string }[];
  const otherIds = rows.map((r) => (r.user_a === selfId ? r.user_b : r.user_a));
  if (otherIds.length === 0) return [];

  const { data: profs, error: pErr } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .in('id', otherIds);
  if (pErr) throw pErr;
  const profMap = new Map<string, ProfileRow>();
  for (const p of (profs ?? []) as ProfileRow[]) profMap.set(p.id, p);

  const ratings = await fetchRatingsFor(otherIds);

  const out: FriendEntry[] = [];
  for (const row of rows) {
    const otherId = row.user_a === selfId ? row.user_b : row.user_a;
    const profile = profMap.get(otherId);
    if (!profile) continue;
    out.push({
      friendshipId: row.id,
      profile,
      rating: ratings.get(otherId) ?? null,
      online: isOnline(profile.last_seen_at),
    });
  }
  out.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.profile.username.localeCompare(b.profile.username);
  });
  return out;
}

export interface RequestWithProfile {
  request: FriendRequestRow;
  profile: ProfileRow | null;
}

/** Incoming + outgoing pending friend requests. */
export async function fetchPendingRequests(selfId: string): Promise<{
  incoming: RequestWithProfile[];
  outgoing: RequestWithProfile[];
}> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, sender_id, receiver_id, status, message, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as FriendRequestRow[];

  const otherIds = new Set<string>();
  for (const r of rows) {
    otherIds.add(r.sender_id === selfId ? r.receiver_id : r.sender_id);
  }
  const profMap = new Map<string, ProfileRow>();
  if (otherIds.size > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .in('id', Array.from(otherIds));
    for (const p of (profs ?? []) as ProfileRow[]) profMap.set(p.id, p);
  }

  const incoming: RequestWithProfile[] = [];
  const outgoing: RequestWithProfile[] = [];
  for (const r of rows) {
    if (r.receiver_id === selfId) {
      incoming.push({ request: r, profile: profMap.get(r.sender_id) ?? null });
    } else if (r.sender_id === selfId) {
      outgoing.push({ request: r, profile: profMap.get(r.receiver_id) ?? null });
    }
  }
  return { incoming, outgoing };
}

/** Relationship between the current user and another profile. */
export type Relationship =
  | 'self'
  | 'friends'
  | 'request_sent'
  | 'request_received'
  | 'blocked'
  | 'none';

export async function fetchRelationship(
  selfId: string,
  otherId: string,
): Promise<{ relationship: Relationship; requestId: string | null }> {
  if (selfId === otherId) return { relationship: 'self', requestId: null };

  const [{ data: fs }, { data: reqs }, { data: blk }] = await Promise.all([
    supabase
      .from('friendships')
      .select('id')
      .or(`and(user_a.eq.${selfId},user_b.eq.${otherId}),and(user_a.eq.${otherId},user_b.eq.${selfId})`)
      .maybeSingle(),
    supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .eq('status', 'pending')
      .or(`and(sender_id.eq.${selfId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${selfId})`),
    supabase.from('blocks').select('id').eq('blocked_id', otherId).maybeSingle(),
  ]);

  if (blk) return { relationship: 'blocked', requestId: null };
  if (fs) return { relationship: 'friends', requestId: null };
  const pending = (reqs ?? []) as { id: string; sender_id: string }[];
  if (pending.length > 0) {
    const p = pending[0];
    return {
      relationship: p.sender_id === selfId ? 'request_sent' : 'request_received',
      requestId: p.id,
    };
  }
  return { relationship: 'none', requestId: null };
}

/** Send a friend request (RLS enforces sender = auth.uid + not blocked). */
export async function sendFriendRequest(
  senderId: string,
  receiverId: string,
  message?: string,
): Promise<void> {
  const { error } = await supabase.from('friend_requests').insert({
    sender_id: senderId,
    receiver_id: receiverId,
    message: message ?? null,
  });
  if (error) throw error;
}

/** Accept a pending request via the server RPC (creates the friendship). */
export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_friend_request', { request_id: requestId });
  if (error) throw error;
}

/** Reject (decline) a pending request the current user received. */
export async function rejectFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

/** Cancel a pending request the current user sent. */
export async function cancelFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

/** Remove a friendship (either party may delete under RLS). */
export async function removeFriend(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

/** Remove a friendship identified by the two participant ids (canonical pair). */
export async function removeFriendByPair(selfId: string, otherId: string): Promise<void> {
  const a = selfId < otherId ? selfId : otherId;
  const b = selfId < otherId ? otherId : selfId;
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_a', a)
    .eq('user_b', b);
  if (error) throw error;
}

/** Block a user. Also tears down any friendship between the two, best-effort. */
export async function blockUser(
  selfId: string,
  targetId: string,
  reason?: string,
): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: selfId, blocked_id: targetId, reason: reason ?? null });
  if (error && error.code !== '23505') throw error; // ignore duplicate
  // Best-effort friendship removal (canonical a<b ordering).
  const a = selfId < targetId ? selfId : targetId;
  const b = selfId < targetId ? targetId : selfId;
  await supabase.from('friendships').delete().eq('user_a', a).eq('user_b', b);
}

/** Unblock a user. */
export async function unblockUser(selfId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', selfId)
    .eq('blocked_id', targetId);
  if (error) throw error;
}

export type ReportCategory =
  | 'harassment'
  | 'cheating'
  | 'inappropriate_name'
  | 'spam'
  | 'other';

/** Report a user via the report-user edge function. */
export async function reportUser(
  reportedId: string,
  category: ReportCategory,
  description?: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('report-user', {
    body: { reportedId, category, description },
  });
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Leaderboard
// -----------------------------------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  rating: number;
  profile: ProfileRow | null;
}

export type LeaderboardScope = 'global' | 'national' | 'friends';

const PAGE_SIZE = 25;

/**
 * Fetch a page of the leaderboard for a scope. Prefers today's
 * leaderboard_snapshots when present; otherwise falls back to a live
 * ratings+profiles query. `friends` is always computed live from the friend
 * graph. Returns entries plus whether more pages exist.
 */
export async function fetchLeaderboardPage(params: {
  scope: LeaderboardScope;
  page: number;
  selfId: string;
  countryCode: string | null;
}): Promise<{ entries: LeaderboardEntry[]; hasMore: boolean }> {
  const { scope, page, selfId, countryCode } = params;
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (scope === 'friends') {
    return fetchFriendsLeaderboard(selfId, page);
  }

  const snapScope = scope === 'national' ? (countryCode ?? '') : 'global';
  if (scope === 'national' && !snapScope) {
    return { entries: [], hasMore: false };
  }

  // Try today's snapshot first.
  const { data: snap, error: snapErr } = await supabase
    .from('leaderboard_snapshots')
    .select('rank, rating, player_id')
    .eq('scope', snapScope)
    .eq('mode', 'ranked')
    .eq('snapshot_date', new Date().toISOString().slice(0, 10))
    .order('rank', { ascending: true })
    .range(from, to);

  if (!snapErr && snap && snap.length > 0) {
    const rows = snap as { rank: number; rating: number; player_id: string }[];
    const profiles = await fetchProfilesMap(rows.map((r) => r.player_id));
    return {
      entries: rows.map((r) => ({
        rank: r.rank,
        playerId: r.player_id,
        rating: r.rating,
        profile: profiles.get(r.player_id) ?? null,
      })),
      hasMore: rows.length === PAGE_SIZE,
    };
  }

  // Live fallback: rank by rating. National scope filters by country via a join.
  return fetchLiveLeaderboard(scope, page, countryCode);
}

async function fetchLiveLeaderboard(
  scope: LeaderboardScope,
  page: number,
  countryCode: string | null,
): Promise<{ entries: LeaderboardEntry[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (scope === 'national') {
    if (!countryCode) return { entries: [], hasMore: false };
    // Filter by country via an inner join on profiles.
    const { data, error } = await supabase
      .from('ratings')
      .select('player_id, rating, profiles!inner(country_code, is_bot, deleted_at)')
      .eq('mode', 'ranked')
      .gt('games_played', 0)
      .eq('profiles.country_code', countryCode)
      .eq('profiles.is_bot', false)
      .order('rating', { ascending: false })
      .range(from, to);
    if (error) throw error;
    const rows = (data ?? []) as { player_id: string; rating: number }[];
    const profiles = await fetchProfilesMap(rows.map((r) => r.player_id));
    return {
      entries: rows.map((r, i) => ({
        rank: from + i + 1,
        playerId: r.player_id,
        rating: r.rating,
        profile: profiles.get(r.player_id) ?? null,
      })),
      hasMore: rows.length === PAGE_SIZE,
    };
  }

  const { data, error } = await supabase
    .from('ratings')
    .select('player_id, rating, profiles!inner(is_bot, deleted_at)')
    .eq('mode', 'ranked')
    .gt('games_played', 0)
    .eq('profiles.is_bot', false)
    .order('rating', { ascending: false })
    .range(from, to);
  if (error) throw error;
  const rows = (data ?? []) as { player_id: string; rating: number }[];
  const profiles = await fetchProfilesMap(rows.map((r) => r.player_id));
  return {
    entries: rows.map((r, i) => ({
      rank: from + i + 1,
      playerId: r.player_id,
      rating: r.rating,
      profile: profiles.get(r.player_id) ?? null,
    })),
    hasMore: rows.length === PAGE_SIZE,
  };
}

async function fetchFriendsLeaderboard(
  selfId: string,
  page: number,
): Promise<{ entries: LeaderboardEntry[]; hasMore: boolean }> {
  // Friends leaderboard includes the user themself for context.
  const friends = await fetchFriends(selfId);
  const ids = [selfId, ...friends.map((f) => f.profile.id)];
  const [ratings, profiles] = await Promise.all([
    fetchRatingsFor(ids),
    fetchProfilesMap(ids),
  ]);
  const ranked = ids
    .map((id) => ({ id, rating: ratings.get(id) ?? 1200 }))
    .sort((a, b) => b.rating - a.rating);

  const from = page * PAGE_SIZE;
  const slice = ranked.slice(from, from + PAGE_SIZE);
  return {
    entries: slice.map((r, i) => ({
      rank: from + i + 1,
      playerId: r.id,
      rating: r.rating,
      profile: profiles.get(r.id) ?? null,
    })),
    hasMore: from + PAGE_SIZE < ranked.length,
  };
}

/** The current user's own leaderboard position for a scope (rank + rating). */
export async function fetchYourPosition(params: {
  scope: LeaderboardScope;
  selfId: string;
  countryCode: string | null;
}): Promise<{ rank: number | null; rating: number } | null> {
  const { scope, selfId, countryCode } = params;
  const rating = (await fetchRating(selfId))?.rating ?? 1200;

  if (scope === 'friends') {
    const { entries } = await fetchFriendsLeaderboard(selfId, 0);
    // friends list is small; find self across pages by re-deriving full order.
    const me = entries.find((e) => e.playerId === selfId);
    if (me) return { rank: me.rank, rating };
    return { rank: null, rating };
  }

  if (scope === 'national' && !countryCode) return { rank: null, rating };

  // Count how many rated players outrank the user.
  let query = supabase
    .from('ratings')
    .select('player_id, profiles!inner(is_bot, country_code)', { count: 'exact', head: true })
    .eq('mode', 'ranked')
    .gt('games_played', 0)
    .eq('profiles.is_bot', false)
    .gt('rating', rating);
  if (scope === 'national' && countryCode) {
    query = query.eq('profiles.country_code', countryCode);
  }
  const { count, error } = await query;
  if (error) throw error;
  return { rank: (count ?? 0) + 1, rating };
}

async function fetchProfilesMap(ids: string[]): Promise<Map<string, ProfileRow>> {
  const map = new Map<string, ProfileRow>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLS).in('id', ids);
  if (error) throw error;
  for (const p of (data ?? []) as ProfileRow[]) map.set(p.id, p);
  return map;
}

/** Update the current user's chosen preset avatar. */
export async function updateAvatar(selfId: string, encoded: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: encoded }).eq('id', selfId);
  if (error) throw error;
}

/** Touch last_seen_at so presence-style online status works. */
export async function touchPresence(selfId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', selfId);
}
