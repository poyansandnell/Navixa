/**
 * Navixa — admin/moderation client. Thin wrappers around the api-server's
 * single `{ action, payload }` dispatcher (`POST /api/admin/actions`) plus a
 * helper to read the caller's own `isAdmin` flag.
 *
 * The server re-verifies admin status on EVERY call; the client check below
 * only decides whether to render the admin UI at all.
 *
 * The server returns camelCase drizzle rows which we normalise into the app's
 * snake_case view models. Some legacy fields have no server equivalent:
 *   - get_user_status returns { profile, suspended, activeActions } — there is
 *     no per-user ratings breakdown, so `ratings` is always [].
 *   - platform_stats returns 4 counters; totalTournaments / activeSuspensions
 *     are not provided and surface as 0.
 */
import { apiFetch, ApiError } from '@/lib/api';

export class AdminError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AdminError';
  }
}

/** Invoke the admin-actions dispatcher and unwrap the standard error envelope. */
async function invokeAdmin<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  try {
    return await apiFetch<T>('/admin/actions', {
      method: 'POST',
      body: { action, payload: payload ?? {} },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new AdminError(err.code, err.message);
    }
    throw new AdminError('FUNCTION_ERROR', (err as Error).message ?? 'Admin action failed');
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  country_code: string | null;
  is_admin: boolean;
  is_bot: boolean;
  level: number;
  created_at: string;
}

export interface ModerationAction {
  id: string;
  action: string;
  reason: string | null;
  notes: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RatingRow {
  mode: string;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface UserStatus {
  ok: true;
  profile: AdminUser & { xp: number; last_seen_at: string | null };
  moderationActions: ModerationAction[];
  ratings: RatingRow[];
  suspended: boolean;
  suspension: ModerationAction | null;
}

export interface AdminReport {
  id: string;
  reporter_id: string;
  reported_id: string;
  match_id: string | null;
  category: string;
  description: string | null;
  status: string;
  resolution: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface BannedUsername {
  id: string;
  pattern: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PlatformStats {
  totalUsers: number;
  totalMatches: number;
  activeMatches: number;
  openReports: number;
  totalTournaments: number;
  activeSuspensions: number;
}

// --- server row shapes -------------------------------------------------------

interface ServerAdminProfile {
  id: string;
  username: string;
  displayName?: string | null;
  countryCode?: string | null;
  isAdmin?: boolean | null;
  isBot?: boolean | null;
  level?: number | null;
  xp?: number | null;
  lastSeenAt?: string | null;
  createdAt?: string;
}

interface ServerModerationAction {
  id: string;
  action: string;
  reason?: string | null;
  notes?: string | null;
  expiresAt?: string | null;
  isActive?: boolean | null;
  createdAt: string;
}

interface ServerReport {
  id: string;
  reporterId: string;
  reportedId: string;
  matchId?: string | null;
  category: string;
  description?: string | null;
  status: string;
  resolution?: string | null;
  handledBy?: string | null;
  handledAt?: string | null;
  createdAt: string;
}

interface ServerBannedUsername {
  id: string;
  pattern: string;
  reason?: string | null;
  isActive?: boolean | null;
  createdAt: string;
}

function toAdminUser(p: ServerAdminProfile): AdminUser {
  return {
    id: p.id,
    username: p.username,
    display_name: p.displayName ?? null,
    country_code: p.countryCode ?? null,
    is_admin: Boolean(p.isAdmin),
    is_bot: Boolean(p.isBot),
    level: p.level ?? 1,
    created_at: p.createdAt ?? new Date(0).toISOString(),
  };
}

function toModerationAction(a: ServerModerationAction): ModerationAction {
  return {
    id: a.id,
    action: a.action,
    reason: a.reason ?? null,
    notes: a.notes ?? null,
    expires_at: a.expiresAt ?? null,
    is_active: a.isActive ?? true,
    created_at: a.createdAt,
  };
}

function toReport(r: ServerReport): AdminReport {
  return {
    id: r.id,
    reporter_id: r.reporterId,
    reported_id: r.reportedId,
    match_id: r.matchId ?? null,
    category: r.category,
    description: r.description ?? null,
    status: r.status,
    resolution: r.resolution ?? null,
    handled_by: r.handledBy ?? null,
    handled_at: r.handledAt ?? null,
    created_at: r.createdAt,
  };
}

function toBannedUsername(b: ServerBannedUsername): BannedUsername {
  return {
    id: b.id,
    pattern: b.pattern,
    reason: b.reason ?? null,
    is_active: b.isActive ?? true,
    created_at: b.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Admin check
// ---------------------------------------------------------------------------
/** Read the current user's own `isAdmin` flag via GET /profile/me. */
export async function fetchIsAdmin(_userId: string): Promise<boolean> {
  try {
    const res = await apiFetch<{ profile: ServerAdminProfile }>('/profile/me');
    return Boolean(res.profile?.isAdmin);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export async function searchUsers(query: string, limit = 20): Promise<AdminUser[]> {
  const res = await invokeAdmin<{ users: ServerAdminProfile[] }>('search_users', { query, limit });
  return (res.users ?? []).map(toAdminUser);
}

export async function getUserStatus(userId: string): Promise<UserStatus> {
  const res = await invokeAdmin<{
    profile: ServerAdminProfile;
    suspended: boolean;
    activeActions: ServerModerationAction[];
  }>('get_user_status', { userId });
  const moderationActions = (res.activeActions ?? []).map(toModerationAction);
  const suspension =
    moderationActions.find((a) => a.action === 'suspend' || a.action === 'ban') ?? null;
  return {
    ok: true,
    profile: {
      ...toAdminUser(res.profile),
      xp: res.profile.xp ?? 0,
      last_seen_at: res.profile.lastSeenAt ?? null,
    },
    moderationActions,
    ratings: [],
    suspended: res.suspended,
    suspension,
  };
}

export async function suspendAccount(params: {
  userId: string;
  reason?: string;
  notes?: string;
  until?: string;
  permanent?: boolean;
}): Promise<void> {
  await invokeAdmin('suspend_account', params as Record<string, unknown>);
}

export async function unsuspendAccount(userId: string): Promise<void> {
  await invokeAdmin('unsuspend_account', { userId });
}

export async function listReports(
  status?: 'open' | 'reviewing' | 'actioned' | 'dismissed',
  limit = 50,
): Promise<AdminReport[]> {
  const payload: Record<string, unknown> = { limit };
  if (status) payload.status = status;
  const res = await invokeAdmin<{ reports: ServerReport[] }>('list_reports', payload);
  return (res.reports ?? []).map(toReport);
}

export async function resolveReport(params: {
  reportId: string;
  status: 'reviewing' | 'actioned' | 'dismissed';
  resolution?: string;
}): Promise<void> {
  await invokeAdmin('resolve_report', params as Record<string, unknown>);
}

export async function listBannedUsernames(): Promise<BannedUsername[]> {
  const res = await invokeAdmin<{ banned: ServerBannedUsername[] }>('list_banned_usernames');
  return (res.banned ?? []).map(toBannedUsername);
}

export async function addBannedUsername(pattern: string, reason?: string): Promise<void> {
  await invokeAdmin('add_banned_username', { pattern, reason });
}

export async function removeBannedUsername(id: string): Promise<void> {
  await invokeAdmin('remove_banned_username', { id });
}

export async function createTournament(params: {
  name: string;
  description?: string;
  mode?: string;
  format?: string;
  maxPlayers?: number;
  minPlayers?: number;
  boardSize?: number;
  entryFeeCoins?: number;
  startsAt?: string;
}): Promise<string> {
  const res = await invokeAdmin<{ tournamentId: string }>(
    'create_tournament',
    params as Record<string, unknown>,
  );
  return res.tournamentId;
}

export async function updateTournamentStatus(
  tournamentId: string,
  status: string,
): Promise<void> {
  await invokeAdmin('update_tournament_status', { tournamentId, status });
}

export async function createDailyQuest(params: {
  code: string;
  period?: string;
  titleKey: string;
  descriptionKey: string;
  metric: string;
  goal: number;
  rewardXp?: number;
  rewardCoins?: number;
}): Promise<string> {
  const res = await invokeAdmin<{ questId: string }>(
    'create_daily_quest',
    params as Record<string, unknown>,
  );
  return res.questId;
}

export async function upsertCosmeticItem(params: {
  code: string;
  type: string;
  rarity?: string;
  nameKey: string;
  descriptionKey?: string;
  priceCoins?: number | null;
  priceCents?: number | null;
  isPurchasable?: boolean;
  sortOrder?: number;
}): Promise<string> {
  const res = await invokeAdmin<{ itemId: string }>(
    'upsert_cosmetic_item',
    params as Record<string, unknown>,
  );
  return res.itemId;
}

export async function annulMatch(matchId: string, reason?: string): Promise<void> {
  await invokeAdmin('annul_match', { matchId, reason });
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const res = await invokeAdmin<{
    stats: {
      totalUsers: number;
      totalMatches: number;
      activeMatches: number;
      openReports: number;
      totalTournaments?: number;
      activeSuspensions?: number;
    };
  }>('platform_stats');
  const s = res.stats;
  return {
    totalUsers: s.totalUsers,
    totalMatches: s.totalMatches,
    activeMatches: s.activeMatches,
    openReports: s.openReports,
    totalTournaments: s.totalTournaments ?? 0,
    activeSuspensions: s.activeSuspensions ?? 0,
  };
}
