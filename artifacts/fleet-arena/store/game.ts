/**
 * Local (offline, on-device) bot match state.
 *
 * This store owns the *authoritative* MatchState for a training game against a
 * bot. The human is always player 'A'; the bot is always player 'B'. The bot
 * only ever receives the redacted `projectPublicState('B')` projection — it can
 * never read player A's fleet.
 *
 * All engine calls go through lib/engine's public API. Randomness comes from a
 * single seeded RNG created from a caller-supplied seed (Date.now at match
 * start), so a match is fully reproducible.
 */
import { create } from 'zustand';

import {
  applyShot,
  autoPlace,
  createBot,
  createMatch,
  createRng,
  DEFAULT_RULES,
  generateRandomFleet,
  opponentOf,
  projectPublicState,
  validateFleet,
  type Bot,
  type BotDifficulty,
  type Coord,
  type Fleet,
  type FleetRules,
  type MatchState,
  type Orientation,
  type Placement,
  type PublicMatchState,
  type RNG,
  type ShipId,
  type ShipSpec,
  type Shot,
} from '@/lib/engine';

export type GamePhase = 'setup' | 'playing' | 'finished';

/** A single entry in the human-readable event log. */
export interface GameEvent {
  /** Monotonic id for React keys. */
  id: number;
  by: 'you' | 'bot';
  coord: Coord;
  result: Shot['result'];
  sunkShip?: ShipId;
}

interface GameStoreState {
  phase: GamePhase;
  rules: FleetRules;
  difficulty: BotDifficulty;

  /** Draft fleet being assembled on the setup screen (player A). */
  draftFleet: Placement[];

  /** Authoritative match state once the match has started. */
  match: MatchState | null;
  /** Winner once finished: 'A' = you, 'B' = bot. */
  winner: 'A' | 'B' | null;

  /** Human-readable event log (most-recent-last). */
  events: GameEvent[];
  /** True while the bot is "thinking" (a fire is scheduled). */
  botThinking: boolean;

  // ---- setup actions -----------------------------------------------------
  setDifficulty: (difficulty: BotDifficulty) => void;
  resetDraft: () => void;
  randomizeDraft: (seed?: number) => void;
  /** Place / move a single ship in the draft. Overwrites any existing entry. */
  placeDraftShip: (placement: Placement) => void;
  /** Remove a ship from the draft. */
  removeDraftShip: (id: ShipId) => void;

  // ---- match lifecycle ---------------------------------------------------
  /** Start a match from the current valid draft fleet. */
  startMatch: (seed?: number) => void;
  /** Fire at a coordinate as the human (player A). No-op if illegal. */
  fireAt: (coord: Coord) => void;
  /** Have the bot take its turn (called after a short UI delay). */
  botTurn: () => void;
  /** Concede the match; the bot wins. */
  resign: () => void;
  /** Tear everything down and return to setup. */
  reset: () => void;
}

/** Order ships come in / are laid out, longest first. */
export const SHIP_ORDER: ShipSpec[] = DEFAULT_RULES.ships;

/** RNG shared across the current match (recreated on start). */
let matchRng: RNG | null = null;
/** Bot decision function for the current match. */
let matchBot: Bot | null = null;
let eventCounter = 0;

function nextEventId(): number {
  eventCounter += 1;
  return eventCounter;
}

function toEvent(shot: Shot): GameEvent {
  return {
    id: nextEventId(),
    by: shot.by === 'A' ? 'you' : 'bot',
    coord: shot.coord,
    result: shot.result,
    sunkShip: shot.sunkShip,
  };
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  phase: 'setup',
  rules: DEFAULT_RULES,
  difficulty: 'normal',
  draftFleet: [],
  match: null,
  winner: null,
  events: [],
  botThinking: false,

  setDifficulty: (difficulty) => set({ difficulty }),

  resetDraft: () => set({ draftFleet: [] }),

  randomizeDraft: (seed) => {
    const rules = get().rules;
    const rng = createRng((seed ?? Date.now()) >>> 0);
    const fleet = generateRandomFleet(rules, rng);
    set({ draftFleet: fleet });
  },

  placeDraftShip: (placement) => {
    set((state) => {
      const others = state.draftFleet.filter((p) => p.id !== placement.id);
      return { draftFleet: [...others, placement] };
    });
  },

  removeDraftShip: (id) => {
    set((state) => ({
      draftFleet: state.draftFleet.filter((p) => p.id !== id),
    }));
  },

  startMatch: (seed) => {
    const { draftFleet, rules, difficulty } = get();

    const validation = validateFleet(draftFleet as Fleet, rules);
    if (!validation.valid) {
      // Guard: callers should only start once the draft is complete.
      return;
    }

    const baseSeed = (seed ?? Date.now()) >>> 0;
    matchRng = createRng(baseSeed);
    matchBot = createBot(difficulty);

    // The bot's fleet is generated from the same seeded RNG stream.
    const botFleet = autoPlace(rules, matchRng);

    // Human is A and always fires first for a friendlier training feel.
    const match = createMatch({
      rules,
      fleetA: draftFleet as Fleet,
      fleetB: botFleet,
      firstTurn: 'A',
    });

    eventCounter = 0;
    set({
      match,
      phase: 'playing',
      winner: null,
      events: [],
      botThinking: false,
    });
  },

  fireAt: (coord) => {
    const state = get();
    const match = state.match;
    if (!match || state.phase !== 'playing') return;
    if (match.turn !== 'A' || match.winner !== null) return;

    // Reject already-fired cells (double-fire guard) up front so the UI stays
    // responsive without throwing.
    const already = projectPublicState(match, 'A').opponent.grid[coord.y][coord.x];
    if (already !== 'unknown') return;

    let outcome;
    try {
      outcome = applyShot(match, 'A', coord);
    } catch {
      return;
    }

    const shot = outcome.newState.log[outcome.moveIndex];
    const events = shot ? [...state.events, toEvent(shot)] : state.events;

    if (outcome.winner) {
      set({
        match: outcome.newState,
        events,
        phase: 'finished',
        winner: outcome.winner,
        botThinking: false,
      });
      return;
    }

    // Turn now passes to the bot.
    set({ match: outcome.newState, events, botThinking: true });
  },

  botTurn: () => {
    const state = get();
    const match = state.match;
    if (!match || state.phase !== 'playing') return;
    if (match.turn !== 'B' || match.winner !== null) return;
    if (!matchBot || !matchRng) return;

    const view: PublicMatchState = projectPublicState(match, 'B');
    const coord = matchBot(view, matchRng);

    let outcome;
    try {
      outcome = applyShot(match, 'B', coord);
    } catch {
      // Defensive: if the bot somehow returns an illegal cell, pick the first
      // unknown cell instead of crashing.
      const fallback = firstUnknown(view);
      if (!fallback) {
        set({ botThinking: false });
        return;
      }
      outcome = applyShot(match, 'B', fallback);
    }

    const shot = outcome.newState.log[outcome.moveIndex];
    const events = shot ? [...state.events, toEvent(shot)] : state.events;

    if (outcome.winner) {
      set({
        match: outcome.newState,
        events,
        phase: 'finished',
        winner: outcome.winner,
        botThinking: false,
      });
      return;
    }

    set({ match: outcome.newState, events, botThinking: false });
  },

  resign: () => {
    const state = get();
    if (state.phase !== 'playing' || !state.match) return;
    // Bot (B) wins by concession. We keep the match state for board reveal.
    set({
      phase: 'finished',
      winner: 'B',
      botThinking: false,
    });
  },

  reset: () => {
    matchRng = null;
    matchBot = null;
    set({
      phase: 'setup',
      match: null,
      winner: null,
      events: [],
      botThinking: false,
      draftFleet: [],
    });
  },
}));

/** First still-unknown cell in a public view (defensive bot fallback). */
function firstUnknown(view: PublicMatchState): Coord | null {
  const size = view.rules.boardSize;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (view.opponent.grid[y][x] === 'unknown') return { x, y };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Selectors / derived helpers (pure, reusable in screens)
// ---------------------------------------------------------------------------

/** The next ship still missing from a draft fleet, in canonical order. */
export function nextUnplacedShip(
  draft: Placement[],
  rules: FleetRules,
): ShipSpec | null {
  for (const spec of rules.ships) {
    if (!draft.some((p) => p.id === spec.id)) return spec;
  }
  return null;
}

/** Build a candidate placement and clamp it fully in-bounds. */
export function buildPlacement(
  id: ShipId,
  length: number,
  origin: Coord,
  orientation: Orientation,
  boardSize: number,
): Placement {
  let x = origin.x;
  let y = origin.y;
  if (orientation === 'horizontal') {
    x = Math.max(0, Math.min(x, boardSize - length));
  } else {
    y = Math.max(0, Math.min(y, boardSize - length));
  }
  return { id, length, origin: { x, y }, orientation };
}

export { opponentOf };
