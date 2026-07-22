/**
 * Navixa — admin/moderation client. Thin wrappers around the
 * `admin-actions` Edge Function (a single `{ action, payload }` dispatcher)
 * plus a helper to read the caller's own `profiles.is_admin` flag.
 *
 * The function re-verifies admin status server-side on EVERY call; the client
 * check below only decides whether to render the admin UI at all.
 */
import { supabase } from '@/lib/supabase';

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
  const { data, error } = await supabase.functions.invoke('admin-actions', {
    body: { action, payload: payload ?? {} },
  });

  if (error) {
    let code = 'FUNCTION_ERROR';
    let message = error.message ?? 'Admin action failed';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const parsed = await ctx.json();
        if (parsed?.error) {
          code = parsed.error.code ?? code;
          message = parsed.error.message ?? message;
        }
      }
    } catch {
      // ignore parse failures
    }
    throw new AdminError(code, message);
  }

  if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
    const env = (data as { error: { code?: string; message?: string } }).error;
    throw new AdminError(env.code ?? 'FUNCTION_ERROR', env.message ?? 'Admin action failed');
  }

  return data as T;
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

// ---------------------------------------------------------------------------
// Admin check
// ---------------------------------------------------------------------------
/** Read the current user's own `is_admin` flag (RLS-safe: owner reads own row). */
export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.is_admin);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export async function searchUsers(query: string, limit = 20): Promise<AdminUser[]> {
  const res = await invokeAdmin<{ users: AdminUser[] }>('search_users', { query, limit });
  return res.users ?? [];
}

export async function getUserStatus(userId: string): Promise<UserStatus> {
  return invokeAdmin<UserStatus>('get_user_status', { userId });
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
  const res = await invokeAdmin<{ reports: AdminReport[] }>('list_reports', payload);
  return res.reports ?? [];
}

export async function resolveReport(params: {
  reportId: string;
  status: 'reviewing' | 'actioned' | 'dismissed';
  resolution?: string;
}): Promise<void> {
  await invokeAdmin('resolve_report', params as Record<string, unknown>);
}

export async function listBannedUsernames(): Promise<BannedUsername[]> {
  const res = await invokeAdmin<{ banned: BannedUsername[] }>('list_banned_usernames');
  return res.banned ?? [];
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
  const res = await invokeAdmin<{ stats: PlatformStats }>('platform_stats');
  return res.stats;
}
