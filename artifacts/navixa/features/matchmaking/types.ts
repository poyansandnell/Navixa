/**
 * Navixa — online-play shared types.
 *
 * These mirror the server enums and the API
 * payloads. They are intentionally
 * duplicated on the client (rather than imported from the server) so the app
 * stays decoupled from the Deno functions.
 */

/** Match modes as exposed on the Play tab. `bot` reuses the offline flow. */
export type OnlineMode = 'quick' | 'ranked' | 'blitz' | 'classic' | 'private' | 'bot';

/** Server-side match_mode enum. */
export type ServerMatchMode = 'ranked' | 'casual' | 'friendly' | 'tournament' | 'bot';

/** Server-side match_status enum. */
export type MatchStatus =
  | 'pending'
  | 'placing'
  | 'active'
  | 'finished'
  | 'abandoned'
  | 'cancelled';

/** Server-side matchmaking_queue.status enum values we care about. */
export type QueueStatus = 'searching' | 'matched' | 'cancelled' | 'expired';

/**
 * Config for a matchmaking search initiated from a Play-tab mode. Blitz and
 * classic map onto the server `casual` mode but differ in turn clock; the
 * server owns the clock, so on the client they only affect labels + which
 * mode we submit.
 */
export interface ModeConfig {
  mode: OnlineMode;
  /** Server match_mode to submit to join-matchmaking. */
  serverMode: ServerMatchMode;
  /** Whether the mode is rated (requires a registered account). */
  ranked: boolean;
  boardSize: number;
}

/** Redacted public state as returned by fire-shot / reconnect-match `view`. */
export interface ServerPublicView {
  rules: { boardSize: number; ships: { id: string; length: number }[]; allowTouching: boolean };
  viewer: 'A' | 'B';
  turn: 'A' | 'B';
  yourTurn: boolean;
  moveCount: number;
  winner: 'A' | 'B' | null;
  own: {
    fleet: { id: string; length: number; origin: { x: number; y: number }; orientation: string }[];
    incoming: Record<string, string>;
  };
  opponent: {
    grid: string[][];
    sunkShips: { id: string; cells: { x: number; y: number }[] }[];
  };
  firedByViewer: string[];
}

/** clock block from reconnect-match. */
export interface MatchClock {
  turnDeadline: string | null;
  currentTurnRemainingMs: number | null;
  timeLeftMs: Record<string, number> | null;
}

/** Default dev fallback wait before offering "play a bot instead" (ms). */
export const DEV_BOT_FALLBACK_MS = 15_000;

/** Map a Play-tab mode into a concrete matchmaking config. */
export function resolveModeConfig(mode: OnlineMode, boardSize = 10): ModeConfig {
  switch (mode) {
    case 'ranked':
      return { mode, serverMode: 'ranked', ranked: true, boardSize };
    case 'quick':
      return { mode, serverMode: 'casual', ranked: false, boardSize };
    case 'blitz':
      return { mode, serverMode: 'casual', ranked: false, boardSize };
    case 'classic':
      return { mode, serverMode: 'casual', ranked: false, boardSize };
    case 'private':
      return { mode, serverMode: 'friendly', ranked: false, boardSize };
    case 'bot':
    default:
      return { mode: 'bot', serverMode: 'bot', ranked: false, boardSize };
  }
}
