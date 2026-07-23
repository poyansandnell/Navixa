/**
 * REST data-access for the social graph: profiles, friends, requests, blocks,
 * reports, ratings and leaderboards — all against the api-server.
 *
 * The server returns camelCase drizzle rows; we normalise them into the app's
 * snake_case view models here so consuming UI is unchanged.
 *
 * Contract gaps worked around client-side:
 *   - The leaderboard endpoint only does live global / national (scope =
 *     countryCode) ranking. The `friends` scope and the "your position"
 *     lookup are computed on the client from the friend graph + ratings.
 */
import { apiFetch, ApiError } from '@/lib/api';
import { toProfileRow, type ServerProfile } from '@/lib/normalize';

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

// --- server row shapes -------------------------------------------------------

interface ServerRating {
  playerId: string;
  rating: number;
  bestRating?: number | null;
  gamesPlayed?: number | null;
  wins?: number | null;
  losses?: number | null;
  winStreak?: number | null;
}

interface ServerFriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  message: string | null;
  createdAt: string;
}

function toRatingRow(r: ServerRating | null | undefined): RatingRow | null {
  if (!r) return null;
  return {
    player_id: r.playerId,
    rating: r.rating,
    best_rating: r.bestRating ?? r.rating,
    games_played: r.gamesPlayed ?? 0,
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
    win_streak: r.winStreak ?? 0,
  };
}

function toRequestRow(r: ServerFriendRequest): FriendRequestRow {
  return {
    id: r.id,
    sender_id: r.senderId,
    receiver_id: r.receiverId,
    status: r.status,
    message: r.message ?? null,
    created_at: r.createdAt,
  };
}

// --- contact matching --------------------------------------------------------

/** A Navixa player matched from a synced contact email hash. */
export interface ContactMatch {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  rating: number | null;
}

/**
 * Match sha256 email hashes against Navixa players. The server already excludes
 * self, existing friends, pending requests and blocked users. Max 500 hashes.
 */
export async function matchContacts(hashes: string[]): Promise<ContactMatch[]> {
  if (hashes.length === 0) return [];
  const res = await apiFetch<{ matches: ContactMatch[] }>('/social/contacts/match', {
    method: 'POST',
    body: { hashes: hashes.slice(0, 500) },
  });
  return res.matches;
}

// --- profiles / ratings / stats ---------------------------------------------

/** Fetch a single profile by id. */
export async function fetchProfile(id: string): Promise<ProfileRow | null> {
  try {
    const res = await apiFetch<{ profile: ServerProfile }>(`/profile/${id}`);
    return toProfileRow(res.profile);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Fetch the ranked rating row for a player. */
export async function fetchRating(playerId: string): Promise<RatingRow | null> {
  const res = await apiFetch<{ rating: ServerRating | null }>(`/profile/${playerId}/rating`);
  return toRatingRow(res.rating);
}

/** Aggregate lifetime stats. */
export async function fetchPlayerStats(playerId: string): Promise<PlayerStats | null> {
  const res = await apiFetch<{
    stats: {
      matchesPlayed: number;
      wins: number;
      losses: number;
      draws: number;
      winRate: number;
      totalShots: number;
      totalHits: number;
      accuracy: number;
      shipsSunk: number;
      currentRating: number;
      bestRating: number;
    };
  }>(`/profile/${playerId}/stats`);
  const s = res.stats;
  return {
    matches_played: s.matchesPlayed,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    win_rate: s.winRate,
    total_shots: s.totalShots,
    total_hits: s.totalHits,
    accuracy: s.accuracy,
    ships_sunk: s.shipsSunk,
    current_rating: s.currentRating,
    best_rating: s.bestRating,
  };
}

/** Fetch ratings for a set of players (used to decorate lists). */
export async function fetchRatingsFor(playerIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (playerIds.length === 0) return map;
  const results = await Promise.all(
    playerIds.map((id) =>
      fetchRating(id)
        .then((r) => [id, r?.rating] as const)
        .catch(() => [id, undefined] as const),
    ),
  );
  for (const [id, rating] of results) {
    if (typeof rating === 'number') map.set(id, rating);
  }
  return map;
}

/** Ids the current user has blocked (used to filter search results). */
export async function fetchBlockedIds(): Promise<Set<string>> {
  const res = await apiFetch<{ blocks: { blockedId: string }[] }>('/social/blocks');
  return new Set(res.blocks.map((b) => b.blockedId));
}

/**
 * Search users by (case-insensitive) username prefix, excluding self and
 * blocked users.
 */
export async function searchUsers(query: string, _selfId: string): Promise<ProfileRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [res, blocked] = await Promise.all([
    apiFetch<{ users: ServerProfile[] }>('/profile/search', { query: { q, limit: 20 } }),
    fetchBlockedIds().catch(() => new Set<string>()),
  ]);
  return res.users
    .map((u) => toProfileRow(u))
    .filter((p): p is ProfileRow => p !== null && !blocked.has(p.id));
}

// --- friends -----------------------------------------------------------------

interface ServerFriendEntry {
  friendshipId: string;
  profile: ServerProfile;
  rating: number | null;
}

/** Accepted friends of the current user, decorated with rating + online. */
export async function fetchFriends(_selfId: string): Promise<FriendEntry[]> {
  const res = await apiFetch<{ friends: ServerFriendEntry[] }>('/social/friends');
  const out: FriendEntry[] = [];
  for (const row of res.friends) {
    const profile = toProfileRow(row.profile);
    if (!profile) continue;
    out.push({
      friendshipId: row.friendshipId,
      profile,
      rating: row.rating ?? null,
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

interface ServerRequestWithProfile {
  request: ServerFriendRequest;
  profile: ServerProfile | null;
}

/** Incoming + outgoing pending friend requests. */
export async function fetchPendingRequests(_selfId: string): Promise<{
  incoming: RequestWithProfile[];
  outgoing: RequestWithProfile[];
}> {
  const res = await apiFetch<{
    incoming: ServerRequestWithProfile[];
    outgoing: ServerRequestWithProfile[];
  }>('/social/requests');
  const map = (r: ServerRequestWithProfile): RequestWithProfile => ({
    request: toRequestRow(r.request),
    profile: toProfileRow(r.profile),
  });
  return {
    incoming: res.incoming.map(map),
    outgoing: res.outgoing.map(map),
  };
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
  _selfId: string,
  otherId: string,
): Promise<{ relationship: Relationship; requestId: string | null }> {
  const res = await apiFetch<{ relationship: Relationship; requestId: string | null }>(
    `/social/relationship/${otherId}`,
  );
  return { relationship: res.relationship, requestId: res.requestId };
}

/** Send a friend request. */
export async function sendFriendRequest(
  _senderId: string,
  receiverId: string,
  message?: string,
): Promise<void> {
  await apiFetch('/social/requests', {
    method: 'POST',
    body: { receiverId, message: message ?? undefined },
  });
}

/** Accept a pending request (creates the friendship server-side). */
export async function acceptFriendRequest(requestId: string): Promise<void> {
  await apiFetch(`/social/requests/${requestId}/accept`, { method: 'POST', body: {} });
}

/** Reject (decline) a pending request the current user received. */
export async function rejectFriendRequest(requestId: string): Promise<void> {
  await apiFetch(`/social/requests/${requestId}/reject`, { method: 'POST', body: {} });
}

/** Cancel a pending request the current user sent. */
export async function cancelFriendRequest(requestId: string): Promise<void> {
  await apiFetch(`/social/requests/${requestId}/cancel`, { method: 'POST', body: {} });
}

/** Remove a friendship by its id. */
export async function removeFriend(friendshipId: string): Promise<void> {
  await apiFetch(`/social/friends/${friendshipId}`, { method: 'DELETE' });
}

/**
 * Remove a friendship identified by the two participant ids. The server keys
 * removal off the friendship id, so we resolve it from the caller's friend
 * list first.
 */
export async function removeFriendByPair(selfId: string, otherId: string): Promise<void> {
  const friends = await fetchFriends(selfId);
  const match = friends.find((f) => f.profile.id === otherId);
  if (match) await removeFriend(match.friendshipId);
}

/** Block a user. Also tears down any friendship between the two (server-side). */
export async function blockUser(
  _selfId: string,
  targetId: string,
  reason?: string,
): Promise<void> {
  await apiFetch('/social/blocks', {
    method: 'POST',
    body: { blockedId: targetId, reason: reason ?? undefined },
  });
}

/** Unblock a user (path id is the blocked user id). */
export async function unblockUser(_selfId: string, targetId: string): Promise<void> {
  await apiFetch(`/social/blocks/${targetId}`, { method: 'DELETE' });
}

export type ReportCategory =
  | 'harassment'
  | 'cheating'
  | 'inappropriate_name'
  | 'spam'
  | 'other';

/** Report a user. */
export async function reportUser(
  reportedId: string,
  category: ReportCategory,
  description?: string,
): Promise<void> {
  await apiFetch('/social/reports', {
    method: 'POST',
    body: { reportedId, category, description: description ?? undefined },
  });
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

interface ServerLeaderboardRow {
  playerId: string;
  rating: number;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  countryCode?: string | null;
  level?: number | null;
  rank: number;
}

/**
 * Fetch a page of the leaderboard for a scope. `global` and `national` hit the
 * live server endpoint; `friends` is computed client-side from the friend
 * graph. Returns entries plus whether more pages likely exist.
 */
export async function fetchLeaderboardPage(params: {
  scope: LeaderboardScope;
  page: number;
  selfId: string;
  countryCode: string | null;
}): Promise<{ entries: LeaderboardEntry[]; hasMore: boolean }> {
  const { scope, page, selfId, countryCode } = params;

  if (scope === 'friends') {
    return fetchFriendsLeaderboard(selfId, page);
  }

  if (scope === 'national' && !countryCode) {
    return { entries: [], hasMore: false };
  }

  const serverScope = scope === 'national' ? (countryCode as string) : 'global';
  const res = await apiFetch<{ entries: ServerLeaderboardRow[]; page: number; pageSize: number }>(
    '/social/leaderboard',
    { query: { scope: serverScope, mode: 'ranked', page, pageSize: PAGE_SIZE } },
  );
  const entries: LeaderboardEntry[] = res.entries.map((r) => ({
    rank: r.rank,
    playerId: r.playerId,
    rating: r.rating,
    profile: {
      id: r.playerId,
      username: r.username,
      display_name: r.displayName ?? null,
      avatar_url: r.avatarUrl ?? null,
      country_code: r.countryCode ?? null,
      xp: 0,
      level: r.level ?? 1,
      last_seen_at: null,
      created_at: new Date(0).toISOString(),
    },
  }));
  return { entries, hasMore: res.entries.length === PAGE_SIZE };
}

async function fetchFriendsLeaderboard(
  selfId: string,
  page: number,
): Promise<{ entries: LeaderboardEntry[]; hasMore: boolean }> {
  const friends = await fetchFriends(selfId);
  const self = await fetchProfile(selfId);
  const selfRating = (await fetchRating(selfId))?.rating ?? 1200;

  const rows: { id: string; rating: number; profile: ProfileRow | null }[] = [
    { id: selfId, rating: selfRating, profile: self },
    ...friends.map((f) => ({
      id: f.profile.id,
      rating: f.rating ?? 1200,
      profile: f.profile,
    })),
  ];
  rows.sort((a, b) => b.rating - a.rating);

  const from = page * PAGE_SIZE;
  const slice = rows.slice(from, from + PAGE_SIZE);
  return {
    entries: slice.map((r, i) => ({
      rank: from + i + 1,
      playerId: r.id,
      rating: r.rating,
      profile: r.profile,
    })),
    hasMore: from + PAGE_SIZE < rows.length,
  };
}

/**
 * The current user's own leaderboard position for a scope. There is no server
 * "your position" endpoint, so this is estimated by scanning leaderboard pages
 * for global/national (bounded) and computed exactly for the small friends set.
 */
export async function fetchYourPosition(params: {
  scope: LeaderboardScope;
  selfId: string;
  countryCode: string | null;
}): Promise<{ rank: number | null; rating: number } | null> {
  const { scope, selfId, countryCode } = params;
  const rating = (await fetchRating(selfId))?.rating ?? 1200;

  if (scope === 'friends') {
    const { entries } = await fetchFriendsLeaderboard(selfId, 0);
    const me = entries.find((e) => e.playerId === selfId);
    return { rank: me?.rank ?? null, rating };
  }

  if (scope === 'national' && !countryCode) return { rank: null, rating };

  // Scan up to a bounded number of pages looking for the caller.
  const MAX_PAGES = 8;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { entries, hasMore } = await fetchLeaderboardPage({
      scope,
      page,
      selfId,
      countryCode,
    });
    const me = entries.find((e) => e.playerId === selfId);
    if (me) return { rank: me.rank, rating };
    if (!hasMore) break;
  }
  return { rank: null, rating };
}

/** Update the current user's chosen preset avatar. */
export async function updateAvatar(_selfId: string, encoded: string): Promise<void> {
  await apiFetch('/profile/me', { method: 'PATCH', body: { avatarUrl: encoded } });
}

/** Touch last_seen_at so presence-style online status works. */
export async function touchPresence(_selfId: string): Promise<void> {
  try {
    await apiFetch('/profile/presence', { method: 'POST', body: {} });
  } catch {
    // Best-effort presence ping.
  }
}
