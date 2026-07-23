/**
 * Navixa — REST client wrappers for the online-play flow against the
 * api-server, plus a couple of shared helpers (idempotency keys, deep-link code
 * parsing).
 *
 * Every wrapper goes through `apiFetch`, which unwraps the stable error
 * envelope `{ error: { code, message } }` into a thrown `ApiError`. We re-throw
 * as `OnlineError` so existing callers keep working. All network chatter is
 * logged with a stable prefix so the two-client flow is debuggable.
 */
import { apiFetch, ApiError } from '@/lib/api';
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
 * Perform an api-server request, translating an `ApiError` into an
 * `OnlineError` so callers can `try/catch` uniformly.
 */
async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  console.log(`${LOG} → ${method} ${path}`, body ? safeBody(body) : '');
  try {
    const data = await apiFetch<T>(path, { method, body });
    console.log(`${LOG} ✓ ${path}`);
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      console.warn(`${LOG} ✗ ${path}`, err.code, err.message);
      throw new OnlineError(err.code, err.message);
    }
    throw err;
  }
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
 * Generate an idempotency key for a fire-shot attempt (timestamp + random
 * suffix). Callers must reuse the SAME key for retries of the same cell so a
 * shot is never double-applied.
 */
export function makeIdempotencyKey(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const rand2 = Math.random().toString(36).slice(2, 10);
  return `shot_${Date.now().toString(36)}_${rand}${rand2}`;
}

// ---------------------------------------------------------------------------
// Matchmaking
// ---------------------------------------------------------------------------

/** Match pace: `daily` (~24h/move, async) vs `blitz` (realtime clock). */
export type MatchTempo = 'blitz' | 'daily';

export interface JoinMatchmakingResult {
  matched: boolean;
  matchId: string | null;
  status: string;
}

export function joinMatchmaking(params: {
  mode: ServerMatchMode;
  boardSize?: number;
  region?: string;
  /** Match pace; defaults to `daily` server-side. */
  tempo?: MatchTempo;
}): Promise<JoinMatchmakingResult> {
  return call<JoinMatchmakingResult>('POST', '/matchmaking/join', params);
}

export function leaveMatchmaking(mode: ServerMatchMode): Promise<{ cancelled: boolean }> {
  return call<{ cancelled: boolean }>('POST', '/matchmaking/leave', { mode });
}

// ---------------------------------------------------------------------------
// Private + bot matches
// ---------------------------------------------------------------------------

export interface CreatePrivateResult {
  matchId: string;
  code: string;
  deepLink: string;
  universalLink: string;
  tempo: MatchTempo;
}

export function createPrivateMatch(params: {
  mode?: 'casual' | 'friendly';
  boardSize?: number;
  turnSeconds?: number;
  isRated?: boolean;
  /** Match pace; defaults to `blitz` server-side. */
  tempo?: MatchTempo;
}): Promise<CreatePrivateResult> {
  return call<CreatePrivateResult>('POST', '/matches/private', params);
}

export function joinPrivateMatch(code: string): Promise<{ matchId: string; status: string }> {
  return call<{ matchId: string; status: string }>('POST', '/matches/private/join', { code });
}

export function createBotMatch(params: {
  boardSize?: number;
  turnSeconds?: number;
  difficulty?: string;
}): Promise<{ matchId: string; status: string }> {
  return call<{ matchId: string; status: string }>('POST', '/matches/bot', params);
}

// ---------------------------------------------------------------------------
// Fleet + shots
// ---------------------------------------------------------------------------

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
  return call<SubmitFleetResult>('POST', '/matches/submit-fleet', params);
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
  return call<FireShotResult>('POST', '/matches/fire', params);
}

export function resignMatch(matchId: string): Promise<{ ok: boolean; winnerId: string | null }> {
  return call<{ ok: boolean; winnerId: string | null; abandoned?: boolean }>(
    'POST',
    `/matches/${matchId}/resign`,
    {},
  );
}

export function handleTimeout(
  matchId: string,
): Promise<{ ok: boolean; timedOut: boolean; winnerId: string | null }> {
  return call('POST', `/matches/${matchId}/timeout`, {});
}

export interface ReconnectResult {
  view: ServerPublicView | null;
  status: string;
  seat: number;
  yourTurn: boolean;
  winnerId: string | null;
  clock: MatchClock | null;
}

export function reconnectMatch(matchId: string): Promise<ReconnectResult> {
  return call<ReconnectResult>('GET', `/matches/${matchId}/reconnect`);
}

// ---------------------------------------------------------------------------
// Active matches ("Dina matcher")
// ---------------------------------------------------------------------------

/** Opponent summary on an active-match row (null for an unfilled seat). */
export interface ActiveMatchOpponent {
  id: string;
  isBot: boolean;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
}

/**
 * A single active match as returned by `GET /api/matches/active`. Server keys
 * are already camelCase, so no normalisation is needed. Rows are sorted
 * your-turn-first.
 */
export interface ActiveMatch {
  matchId: string;
  tempo: MatchTempo;
  mode: ServerMatchMode;
  status: 'pending' | 'placing' | 'active';
  boardSize: number;
  turnSeconds: number | null;
  seat: number;
  yourTurn: boolean;
  turnDeadline: string | null;
  updatedAt: string;
  opponent: ActiveMatchOpponent | null;
}

export function fetchActiveMatches(): Promise<{ matches: ActiveMatch[] }> {
  return call<{ matches: ActiveMatch[] }>('GET', '/matches/active');
}

// ---------------------------------------------------------------------------
// Dev config
// ---------------------------------------------------------------------------

/**
 * Dev bot-fallback delay. The api-server has no app_config equivalent, so this
 * always returns the compiled-in default (kept async for call-site
 * compatibility).
 */
export async function getDevBotFallbackMs(): Promise<number> {
  return DEV_BOT_FALLBACK_MS;
}

// ---------------------------------------------------------------------------
// Deep-link code parsing
// ---------------------------------------------------------------------------

/**
 * Extract an invite code from a deep link (`navixa://join/ABCD`), a universal
 * link (`https://.../join/ABCD`), or a bare code. Returns the trimmed uppercase
 * code, or null when nothing usable is found.
 */
export function parseInviteCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-z0-9]{4,12}$/i.test(trimmed)) return trimmed.toUpperCase();

  const match = trimmed.match(/join\/([a-z0-9]{4,12})/i);
  if (match) return match[1].toUpperCase();

  return null;
}
