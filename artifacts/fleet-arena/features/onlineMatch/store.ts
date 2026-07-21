/**
 * Fleet Arena — online (server-authoritative) match store.
 *
 * Unlike store/game.ts (offline bot), this store never computes shot results.
 * The server is the single source of truth: every shot goes through fire-shot
 * and we only mount the redacted `view` it returns. A cell tapped by the local
 * player is held in `pendingShot` (with a stable idempotency key) until the
 * server responds, so the UI can render a "pending" state with NO optimistic
 * hit/miss.
 *
 * Realtime updates (opponent shots, turn changes, match status) arrive through
 * subscriptions wired in the play screen; they call `applyServerView` /
 * `applyMoveRow` here to keep this store in sync.
 */
import { create } from 'zustand';

import {
  fireShot,
  reconnectMatch,
  resignMatch,
  botMove,
  makeIdempotencyKey,
  OnlineError,
  type FireShotResult,
} from './client';
import type {
  MatchClock,
  MatchStatus,
  ServerPublicView,
} from '@/features/matchmaking/types';

/** A human-readable event log entry, mirroring the offline GameEvent shape. */
export interface OnlineEvent {
  id: number;
  by: 'you' | 'opponent';
  coord: { x: number; y: number };
  result: 'miss' | 'hit' | 'sunk';
  sunkShip?: string;
}

/** A quick reaction (emoji / preset phrase), locally rendered. */
export interface Reaction {
  id: number;
  by: 'you' | 'opponent';
  text: string;
  at: number;
}

/** A shot the local player has fired that has not yet been confirmed. */
export interface PendingShot {
  coord: { x: number; y: number };
  idempotencyKey: string;
}

interface OnlineMatchState {
  matchId: string | null;
  /** Server match_mode label for leave-matchmaking / rating reads. */
  ranked: boolean;
  status: MatchStatus | null;
  seat: number | null;
  view: ServerPublicView | null;
  clock: MatchClock | null;
  /**
   * Server->device clock offset in ms (serverNow - deviceNow). We derive it
   * from `currentTurnRemainingMs` + `turnDeadline` on reconnect so the local
   * countdown is drift-corrected and does not depend on the device clock being
   * accurate.
   */
  clockOffsetMs: number;
  pendingShot: PendingShot | null;
  events: OnlineEvent[];
  reactions: Reaction[];
  winnerId: string | null;
  /** True once the match is finished/abandoned (drives navigation to result). */
  finished: boolean;
  /** Last transient error surfaced to the UI. */
  errorMessage: string | null;
  /** True while a fire-shot round-trip is in flight. */
  firing: boolean;

  // ---- lifecycle ---------------------------------------------------------
  init: (matchId: string, ranked: boolean) => void;
  reset: () => void;

  // ---- server sync -------------------------------------------------------
  applyServerView: (view: ServerPublicView, clock?: MatchClock | null) => void;
  setStatus: (status: MatchStatus) => void;
  /** Rebuild full state from reconnect-match (foreground / network regain). */
  reconnect: () => Promise<void>;

  // ---- actions -----------------------------------------------------------
  /** Fire at a cell; holds a pending state until the server responds. */
  fireAt: (x: number, y: number) => Promise<void>;
  /**
   * Re-send the pending shot with its ORIGINAL idempotency key (safe after a
   * lost response — the server replays the stored outcome with a full view).
   */
  retryPendingShot: () => Promise<void>;
  /** Abandon the pending shot and resync authoritative state from the server. */
  cancelPendingShot: () => Promise<void>;
  /** Ask the server to play the bot's turn (bot matches only). */
  playBotTurn: () => Promise<void>;
  /** Resign the match. */
  resign: () => Promise<void>;
  /** Record a locally-visible reaction (see NOTE in play screen). */
  addReaction: (by: 'you' | 'opponent', text: string) => void;
  clearError: () => void;
}

let eventCounter = 0;
let reactionCounter = 0;

function nextEventId(): number {
  eventCounter += 1;
  return eventCounter;
}

/**
 * Derive the local event log from a server view by diffing the number of
 * shots. Because the redacted view does not carry a full shot log, we rebuild
 * "you fired at X (result)" events from the opponent grid delta and "opponent
 * fired at Y (result)" from our own incoming map. This keeps a readable log
 * without ever exposing hidden ship positions.
 */
function buildEventsFromView(
  prev: ServerPublicView | null,
  next: ServerPublicView,
  existing: OnlineEvent[],
): OnlineEvent[] {
  const events = [...existing];

  // Your shots: cells on the opponent grid that changed from unknown.
  const prevOpp = prev?.opponent.grid;
  next.opponent.grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      const before = prevOpp?.[y]?.[x] ?? 'unknown';
      if (before === 'unknown' && cell !== 'unknown') {
        events.push({
          id: nextEventId(),
          by: 'you',
          coord: { x, y },
          result: cell as 'miss' | 'hit' | 'sunk',
        });
      }
    });
  });

  // Opponent shots: keys newly present in your incoming map.
  const prevIncoming = prev?.own.incoming ?? {};
  for (const [key, result] of Object.entries(next.own.incoming)) {
    if (!(key in prevIncoming)) {
      const [xs, ys] = key.split(',');
      events.push({
        id: nextEventId(),
        by: 'opponent',
        coord: { x: Number(xs), y: Number(ys) },
        result: result as 'miss' | 'hit' | 'sunk',
      });
    }
  }

  return events;
}

type Set = (partial: Partial<OnlineMatchState>) => void;
type Get = () => OnlineMatchState;

/**
 * Shared shot sender used by both fireAt (fresh key) and retryPendingShot
 * (SAME key). The server's idempotent replay returns the full response shape
 * (including a rebuilt view), so both paths update state identically.
 */
async function sendPendingShot(set: Set, get: Get, pending: PendingShot): Promise<void> {
  const matchId = get().matchId;
  if (!matchId) return;
  set({ pendingShot: pending, firing: true, errorMessage: null });

  try {
    const res: FireShotResult = await fireShot({
      matchId,
      x: pending.coord.x,
      y: pending.coord.y,
      idempotencyKey: pending.idempotencyKey,
    });
    const events = buildEventsFromView(get().view, res.view, get().events);
    set({
      view: res.view,
      events,
      pendingShot: null,
      firing: false,
      winnerId: res.winnerId ?? get().winnerId,
      finished: res.view.winner !== null,
    });

    // Bot matches: nudge the server to play the bot's reply.
    if (res.botToMove) {
      void get().playBotTurn();
    }
  } catch (err) {
    const message = err instanceof OnlineError ? err.message : 'Shot failed';
    // Keep the pending shot so a manual retry reuses the same idempotency key
    // (never resend a NEW key for the same cell attempt).
    set({ firing: false, errorMessage: message });
    console.warn('[online] shot failed; pending retained for retry', message);
  }
}

export const useOnlineMatchStore = create<OnlineMatchState>((set, get) => ({
  matchId: null,
  ranked: false,
  status: null,
  seat: null,
  view: null,
  clock: null,
  clockOffsetMs: 0,
  pendingShot: null,
  events: [],
  reactions: [],
  winnerId: null,
  finished: false,
  errorMessage: null,
  firing: false,

  init: (matchId, ranked) => {
    eventCounter = 0;
    reactionCounter = 0;
    set({
      matchId,
      ranked,
      status: 'placing',
      seat: null,
      view: null,
      clock: null,
      clockOffsetMs: 0,
      pendingShot: null,
      events: [],
      reactions: [],
      winnerId: null,
      finished: false,
      errorMessage: null,
      firing: false,
    });
  },

  reset: () => {
    set({
      matchId: null,
      ranked: false,
      status: null,
      seat: null,
      view: null,
      clock: null,
      clockOffsetMs: 0,
      pendingShot: null,
      events: [],
      reactions: [],
      winnerId: null,
      finished: false,
      errorMessage: null,
      firing: false,
    });
  },

  applyServerView: (view, clock) => {
    const state = get();
    const events = buildEventsFromView(state.view, view, state.events);

    // If our pending shot has now landed (present on the opponent grid), clear
    // it. Otherwise keep it so the cell stays "pending".
    let pendingShot = state.pendingShot;
    if (pendingShot) {
      const { x, y } = pendingShot.coord;
      const landed = view.opponent.grid[y]?.[x];
      if (landed && landed !== 'unknown') pendingShot = null;
    }

    set({
      view,
      events,
      pendingShot,
      clock: clock ?? state.clock,
      finished: view.winner !== null ? true : state.finished,
    });
  },

  setStatus: (status) => {
    set({
      status,
      finished: status === 'finished' || status === 'abandoned' ? true : get().finished,
    });
  },

  reconnect: async () => {
    const matchId = get().matchId;
    if (!matchId) return;
    try {
      const res = await reconnectMatch(matchId);
      // Drift correction: compute server offset from the returned clock.
      let clockOffsetMs = get().clockOffsetMs;
      if (res.clock?.turnDeadline && res.clock.currentTurnRemainingMs != null) {
        const deadlineMs = Date.parse(res.clock.turnDeadline);
        // serverNow = deadline - remaining. offset = serverNow - deviceNow.
        const serverNow = deadlineMs - res.clock.currentTurnRemainingMs;
        clockOffsetMs = serverNow - Date.now();
      }
      const events = buildEventsFromView(get().view, res.view, get().events);
      set({
        view: res.view,
        status: res.status as MatchStatus,
        seat: res.seat,
        clock: res.clock,
        clockOffsetMs,
        winnerId: res.winnerId,
        events,
        finished: res.view.winner !== null || res.status === 'finished' || res.status === 'abandoned',
        pendingShot: null,
      });
      console.log('[online] reconnect rebuilt state', { status: res.status, seat: res.seat });
    } catch (err) {
      console.warn('[online] reconnect failed', err);
      // Non-fatal: keep current state; the banner can prompt a manual retry.
    }
  },

  fireAt: async (x, y) => {
    const state = get();
    const { matchId, view } = state;
    if (!matchId || !view || state.finished) return;
    if (!view.yourTurn) return;
    if (state.pendingShot) return; // one in-flight shot at a time
    if (view.opponent.grid[y]?.[x] !== 'unknown') return; // already fired

    // Stable key per cell attempt; reused if the SAME pending shot is retried
    // (the guard above prevents a second distinct key).
    const pending: PendingShot = { coord: { x, y }, idempotencyKey: makeIdempotencyKey() };
    await sendPendingShot(set, get, pending);
  },

  retryPendingShot: async () => {
    const pending = get().pendingShot;
    if (!pending || get().firing) return;
    await sendPendingShot(set, get, pending);
  },

  cancelPendingShot: async () => {
    // Drop the local pending marker and resync from the server. If the shot
    // actually landed server-side, reconnect returns the authoritative view.
    set({ pendingShot: null, firing: false, errorMessage: null });
    await get().reconnect();
  },

  playBotTurn: async () => {
    const matchId = get().matchId;
    if (!matchId) return;
    try {
      const res = await botMove(matchId);
      const events = buildEventsFromView(get().view, res.view, get().events);
      set({
        view: res.view,
        events,
        winnerId: res.winnerId ?? get().winnerId,
        finished: res.view.winner !== null,
      });
    } catch (err) {
      console.warn('[online] botMove failed', err);
    }
  },

  resign: async () => {
    const matchId = get().matchId;
    if (!matchId) return;
    try {
      const res = await resignMatch(matchId);
      set({ winnerId: res.winnerId, finished: true, status: 'abandoned' });
    } catch (err) {
      const message = err instanceof OnlineError ? err.message : 'Resign failed';
      set({ errorMessage: message });
    }
  },

  addReaction: (by, text) => {
    reactionCounter += 1;
    const reaction: Reaction = { id: reactionCounter, by, text, at: Date.now() };
    set((s) => ({ reactions: [...s.reactions.slice(-19), reaction] }));
  },

  clearError: () => set({ errorMessage: null }),
}));

/** Turn-clock preset phrases for quick chat (namespaced i18n keys resolved in UI). */
export const REACTION_EMOJIS = ['👍', '😅', '🔥', '🎯', '🫡', '😮'] as const;
export const PRESET_PHRASE_KEYS = [
  'online.reactions.goodLuck',
  'online.reactions.niceShot',
  'online.reactions.close',
  'online.reactions.wellPlayed',
] as const;
