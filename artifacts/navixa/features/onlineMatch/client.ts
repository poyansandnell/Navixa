/**
 * Navixa — thin client wrappers around the deployed Supabase Edge
 * Functions used by the online-play flow, plus a couple of shared helpers
 * (idempotency keys, app_config fetch, deep-link code parsing).
 *
 * Every wrapper unwraps the stable error envelope
 * `{ error: { code, message } }` and throws an `OnlineError` so callers can
 * `try/catch` uniformly. All network chatter is logged with a stable prefix so
 * the two-client flow is debuggable from a single device.
 */
import { supabase } from '@/lib/supabase';
import type {
  MatchClock,
  ServerMatchMode,
  ServerPublicView,
} from '@/features/matchmaking/types';
import { DEV_BOT_FALLBACK_MS } from '@/features/matchmaking/types';

const LOG = '[online]';

export class OnlineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'OnlineError';
  }
}

/**
 * Invoke an Edge Function and return its data, translating the error envelope
 * into a thrown OnlineError. `supabase.functions.invoke` resolves with
 * `{ data, error }` where `error` is a FunctionsHttpError whose response body
 * still carries our envelope, so we defensively read both.
 */
export async function invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  console.log(`${LOG} → ${name}`, safeBody(body));
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    // Try to extract our envelope from the failed response.
    let code = 'FUNCTION_ERROR';
    let message = error.message ?? 'Edge function failed';
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
      // ignore parse failures; fall back to the generic message
    }
    console.warn(`${LOG} ✗ ${name}`, code, message);
    throw new OnlineError(code, message);
  }

  // Some functions may return their own envelope in the success path.
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
    const env = (data as { error: { code?: string; message?: string } }).error;
    console.warn(`${LOG} ✗ ${name}`, env.code, env.message);
    throw new OnlineError(env.code ?? 'FUNCTION_ERROR', env.message ?? 'Edge function failed');
  }

  console.log(`${LOG} ✓ ${name}`);
  return data as T;
}

/** Never log a full fleet in plaintext. */
function safeBody(body: Record<string, unknown>): Record<string, unknown> {
  if ('fleet' in body) {
    const fleet = body.fleet as unknown[];
    return { ...body, fleet: `[${Array.isArray(fleet) ? fleet.length : '?'} placements]` };
  }
  return body;
}

// ---------------------------------------------------------------------------
// Idempotency keys
// ---------------------------------------------------------------------------

/**
 * Generate an idempotency key for a fire-shot attempt. We avoid a hard
 * dependency on expo-crypto (not installed) and use a timestamp + random
 * suffix, which comfortably satisfies the server's 8..128 char requirement and
 * is unique per attempt. The caller is responsible for reusing the SAME key
 * for retries of the same cell so a shot is never double-applied.
 */
export function makeIdempotencyKey(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const rand2 = Math.random().toString(36).slice(2, 10);
  return `shot_${Date.now().toString(36)}_${rand}${rand2}`;
}

// ---------------------------------------------------------------------------
// Edge function wrappers
// ---------------------------------------------------------------------------

export interface JoinMatchmakingResult {
  matched: boolean;
  matchId: string | null;
  status: string;
}

export function joinMatchmaking(params: {
  mode: ServerMatchMode;
  boardSize?: number;
  region?: string;
}): Promise<JoinMatchmakingResult> {
  return invokeEdge<JoinMatchmakingResult>('join-matchmaking', params);
}

export function leaveMatchmaking(mode: ServerMatchMode): Promise<{ cancelled: boolean }> {
  return invokeEdge<{ cancelled: boolean }>('leave-matchmaking', { mode });
}

export interface CreatePrivateResult {
  matchId: string;
  code: string;
  deepLink: string;
  universalLink: string;
}

export function createPrivateMatch(params: {
  mode?: 'casual' | 'friendly';
  boardSize?: number;
  turnSeconds?: number;
  isRated?: boolean;
}): Promise<CreatePrivateResult> {
  return invokeEdge<CreatePrivateResult>('create-private-match', params);
}

export function joinPrivateMatch(code: string): Promise<{ matchId: string; status: string }> {
  return invokeEdge<{ matchId: string; status: string }>('join-private-match', { code });
}

export interface SubmitFleetResult {
  ok: boolean;
  ready: boolean;
  matchStarted: boolean;
}

export function submitFleet(params: {
  matchId: string;
  fleet: unknown[];
  boardHash?: string;
  salt?: string;
}): Promise<SubmitFleetResult> {
  return invokeEdge<SubmitFleetResult>('submit-fleet', params);
}

export interface FireShotResult {
  idempotent: boolean;
  result: 'miss' | 'hit' | 'sunk';
  sunkShip?: string | null;
  moveNumber: number;
  winner: 'A' | 'B' | null;
  winnerId: string | null;
  view: ServerPublicView;
  botToMove?: boolean;
}

export function fireShot(params: {
  matchId: string;
  x: number;
  y: number;
  idempotencyKey: string;
}): Promise<FireShotResult> {
  return invokeEdge<FireShotResult>('fire-shot', params);
}

export interface BotMoveResult {
  botShot: { x: number; y: number };
  result: 'miss' | 'hit' | 'sunk';
  sunkShip?: string | null;
  moveNumber: number;
  winner: 'A' | 'B' | null;
  winnerId: string | null;
  view: ServerPublicView;
}

export function botMove(matchId: string): Promise<BotMoveResult> {
  return invokeEdge<BotMoveResult>('bot-move', { matchId });
}

export function resignMatch(matchId: string): Promise<{ ok: boolean; winnerId: string | null }> {
  return invokeEdge<{ ok: boolean; winnerId: string | null; abandoned?: boolean }>(
    'resign-match',
    { matchId },
  );
}

export function handleTimeout(
  matchId: string,
): Promise<{ ok: boolean; timedOut: boolean; winnerId: string | null }> {
  return invokeEdge('handle-timeout', { matchId });
}

export interface ReconnectResult {
  view: ServerPublicView;
  status: string;
  seat: number;
  yourTurn: boolean;
  winnerId: string | null;
  clock: MatchClock;
}

export function reconnectMatch(matchId: string): Promise<ReconnectResult> {
  return invokeEdge<ReconnectResult>('reconnect-match', { matchId });
}

// ---------------------------------------------------------------------------
// app_config (public flags)
// ---------------------------------------------------------------------------

/**
 * Read the dev bot-fallback delay from app_config (public key
 * `dev_bot_fallback_ms`) with a hard-coded default. Never throws; on any error
 * it falls back to the constant so the search screen keeps working offline.
 */
export async function getDevBotFallbackMs(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'dev_bot_fallback_ms')
      .maybeSingle();
    if (error || !data) return DEV_BOT_FALLBACK_MS;
    const value = (data as { value: unknown }).value;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? n : DEV_BOT_FALLBACK_MS;
  } catch {
    return DEV_BOT_FALLBACK_MS;
  }
}

// ---------------------------------------------------------------------------
// Deep-link code parsing
// ---------------------------------------------------------------------------

/**
 * Extract an invite code from a deep link such as `navixa://join/ABCD` or
 * `navixa://join/ABCD`, a universal link `https://.../join/ABCD`, or a
 * bare code. Returns the trimmed uppercase code, or null when nothing usable
 * is found.
 */
export function parseInviteCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare code (4..12 alphanumerics).
  if (/^[a-z0-9]{4,12}$/i.test(trimmed)) return trimmed.toUpperCase();

  const match = trimmed.match(/join\/([a-z0-9]{4,12})/i);
  if (match) return match[1].toUpperCase();

  return null;
}
