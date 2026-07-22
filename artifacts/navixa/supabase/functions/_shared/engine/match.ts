/**
 * Pure reducer-style match engine.
 *
 * Pure TypeScript — no react / react-native / Node-only APIs. All state
 * transitions are pure functions returning new state; nothing is mutated in
 * place, so the engine is deterministic and server-verifiable.
 */

import { coordKey, formatCoord, inBounds } from './coord.ts';
import { fleetCells, placementCells, validateFleet } from './placement.ts';
import type {
  Coord,
  Fleet,
  FleetRules,
  MatchState,
  PlayerId,
  PlayerState,
  ShipId,
  Shot,
  ShotResult,
} from './types.ts';

/** Deep-ish clone of match state (structuredClone-free for Deno/RN parity). */
function cloneState(state: MatchState): MatchState {
  return {
    rules: state.rules,
    turn: state.turn,
    moveCount: state.moveCount,
    winner: state.winner,
    log: state.log.map((s) => ({ ...s, coord: { ...s.coord } })),
    players: {
      A: clonePlayer(state.players.A),
      B: clonePlayer(state.players.B),
    },
  };
}

function clonePlayer(p: PlayerState): PlayerState {
  return {
    fleet: p.fleet.map((pl) => ({ ...pl, origin: { ...pl.origin } })),
    shotsReceived: { ...p.shotsReceived },
  };
}

/** The other player. */
export function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === 'A' ? 'B' : 'A';
}

/**
 * Create a new match. Both fleets must be valid for the rules. `firstTurn`
 * defaults to player A.
 */
export function createMatch(params: {
  rules: FleetRules;
  fleetA: Fleet;
  fleetB: Fleet;
  firstTurn?: PlayerId;
}): MatchState {
  const { rules, fleetA, fleetB, firstTurn = 'A' } = params;

  const va = validateFleet(fleetA, rules);
  if (!va.valid) {
    throw new Error(`Invalid fleet for player A: ${va.errors.join(', ')}`);
  }
  const vb = validateFleet(fleetB, rules);
  if (!vb.valid) {
    throw new Error(`Invalid fleet for player B: ${vb.errors.join(', ')}`);
  }

  return {
    rules,
    turn: firstTurn,
    moveCount: 0,
    winner: null,
    log: [],
    players: {
      A: { fleet: fleetA, shotsReceived: {} },
      B: { fleet: fleetB, shotsReceived: {} },
    },
  };
}

/** Find which placement (if any) occupies the given cell on a fleet. */
function shipAt(fleet: Fleet, coord: Coord): Fleet[number] | undefined {
  return fleet.find((placement) =>
    placementCells(placement).some((c) => c.x === coord.x && c.y === coord.y),
  );
}

/** True if all cells of a placement have been hit. */
function isSunk(
  placement: Fleet[number],
  shotsReceived: Record<string, ShotResult>,
): boolean {
  return placementCells(placement).every((c) => {
    const r = shotsReceived[coordKey(c)];
    return r === 'hit' || r === 'sunk';
  });
}

/** True once every ship in a fleet is sunk. */
export function allSunk(
  fleet: Fleet,
  shotsReceived: Record<string, ShotResult>,
): boolean {
  const cells = fleetCells(fleet);
  return cells.every((c) => {
    const r = shotsReceived[coordKey(c)];
    return r === 'hit' || r === 'sunk';
  });
}

export interface ApplyShotResult {
  result: ShotResult;
  newState: MatchState;
  sunkShip?: ShipId;
  winner?: PlayerId;
  /** The move index assigned to this shot. */
  moveIndex: number;
  /** True when this call re-used an already-recorded result (idempotency). */
  idempotent: boolean;
}

export interface ApplyShotOptions {
  /**
   * Optional expected move index for idempotency. If provided and it does not
   * equal the current moveCount, the engine assumes this exact move was
   * already applied and returns the recorded result unchanged.
   */
  expectedMoveIndex?: number;
}

/**
 * Apply a shot by `playerId` at `coord`. Enforces:
 *  - match not already over
 *  - correct turn order
 *  - in-bounds target
 *  - no double-firing the same cell
 *  - idempotency via `expectedMoveIndex`
 *
 * Returns the shot result and a NEW state (input state is never mutated).
 */
export function applyShot(
  state: MatchState,
  playerId: PlayerId,
  coord: Coord,
  options: ApplyShotOptions = {},
): ApplyShotResult {
  if (state.winner !== null) {
    throw new Error('match-already-over');
  }

  if (state.turn !== playerId) {
    throw new Error('not-your-turn');
  }

  // Idempotency: replaying an already-applied move index returns the recorded
  // result without changing state.
  if (
    options.expectedMoveIndex !== undefined &&
    options.expectedMoveIndex < state.moveCount
  ) {
    const recorded = state.log[options.expectedMoveIndex];
    if (
      recorded &&
      recorded.by === playerId &&
      recorded.coord.x === coord.x &&
      recorded.coord.y === coord.y
    ) {
      return {
        result: recorded.result,
        newState: state,
        sunkShip: recorded.sunkShip,
        winner: state.winner ?? undefined,
        moveIndex: recorded.index,
        idempotent: true,
      };
    }
    throw new Error('stale-move-index');
  }

  if (
    options.expectedMoveIndex !== undefined &&
    options.expectedMoveIndex !== state.moveCount
  ) {
    throw new Error('stale-move-index');
  }

  if (!inBounds(coord, state.rules.boardSize)) {
    throw new Error(`out-of-bounds:${formatCoord(coord)}`);
  }

  const targetId = opponentOf(playerId);
  const target = state.players[targetId];
  const key = coordKey(coord);

  if (target.shotsReceived[key] !== undefined) {
    throw new Error('cell-already-fired');
  }

  const next = cloneState(state);
  const nextTarget = next.players[targetId];

  const hitShip = shipAt(target.fleet, coord);
  let result: ShotResult;
  let sunkShip: ShipId | undefined;

  if (!hitShip) {
    result = 'miss';
    nextTarget.shotsReceived[key] = 'miss';
  } else {
    // Mark as hit first so isSunk can see it.
    nextTarget.shotsReceived[key] = 'hit';
    if (isSunk(hitShip, nextTarget.shotsReceived)) {
      result = 'sunk';
      sunkShip = hitShip.id;
      // Re-mark all of the ship's cells as 'sunk' for clarity in projections.
      for (const c of placementCells(hitShip)) {
        nextTarget.shotsReceived[coordKey(c)] = 'sunk';
      }
    } else {
      result = 'hit';
    }
  }

  const shot: Shot = {
    index: next.moveCount,
    by: playerId,
    coord: { ...coord },
    result,
    ...(sunkShip ? { sunkShip } : {}),
  };
  next.log.push(shot);
  const moveIndex = next.moveCount;
  next.moveCount += 1;

  let winner: PlayerId | undefined;
  if (allSunk(nextTarget.fleet, nextTarget.shotsReceived)) {
    next.winner = playerId;
    winner = playerId;
  } else {
    // Turn passes to the other player on every completed shot.
    next.turn = targetId;
  }

  return {
    result,
    newState: next,
    sunkShip,
    winner,
    moveIndex,
    idempotent: false,
  };
}

// ---------------------------------------------------------------------------
// Public projection
// ---------------------------------------------------------------------------

/** A single cell in the public view of an opponent's board. */
export type PublicCell = 'unknown' | 'miss' | 'hit' | 'sunk';

/** Public, redacted view of a match for a specific viewer. */
export interface PublicMatchState {
  rules: FleetRules;
  viewer: PlayerId;
  turn: PlayerId;
  yourTurn: boolean;
  moveCount: number;
  winner: PlayerId | null;
  /**
   * The viewer's own board: full fleet placement plus which of the viewer's
   * cells the opponent has fired upon.
   */
  own: {
    fleet: Fleet;
    incoming: Record<string, ShotResult>;
  };
  /**
   * The opponent's board as the viewer is allowed to see it: only fired cells
   * are revealed (miss/hit/sunk). Unsunk ship positions are NEVER included.
   */
  opponent: {
    /** boardSize x boardSize grid of PublicCell, indexed [y][x]. */
    grid: PublicCell[][];
    /** Sunk ships the viewer has confirmed (ids + full cells, since revealed). */
    sunkShips: { id: ShipId; cells: Coord[] }[];
  };
  /**
   * Cells the viewer has already fired at the opponent (so callers/bots can
   * avoid repeats). Derived exclusively from public information.
   */
  firedByViewer: string[];
}

/**
 * Project the authoritative match state into the redacted public view for
 * `viewerId`. Crucially, the opponent's *unsunk* ship positions are never
 * present in the output object — there is no way to read them from a
 * PublicMatchState. Only sunk ships (already revealed to the viewer through
 * gameplay) expose their cells.
 */
export function projectPublicState(
  state: MatchState,
  viewerId: PlayerId,
): PublicMatchState {
  const opponentId = opponentOf(viewerId);
  const opponent = state.players[opponentId];
  const own = state.players[viewerId];
  const size = state.rules.boardSize;

  const grid: PublicCell[][] = [];
  for (let y = 0; y < size; y++) {
    const row: PublicCell[] = [];
    for (let x = 0; x < size; x++) {
      const r = opponent.shotsReceived[coordKey({ x, y })];
      row.push(r ?? 'unknown');
    }
    grid.push(row);
  }

  const firedByViewer = Object.keys(opponent.shotsReceived);

  const sunkShips: { id: ShipId; cells: Coord[] }[] = [];
  for (const placement of opponent.fleet) {
    if (isSunk(placement, opponent.shotsReceived)) {
      sunkShips.push({
        id: placement.id,
        cells: placementCells(placement),
      });
    }
  }

  return {
    rules: state.rules,
    viewer: viewerId,
    turn: state.turn,
    yourTurn: state.turn === viewerId && state.winner === null,
    moveCount: state.moveCount,
    winner: state.winner,
    own: {
      fleet: own.fleet.map((p) => ({ ...p, origin: { ...p.origin } })),
      incoming: { ...own.shotsReceived },
    },
    opponent: {
      grid,
      sunkShips,
    },
    firedByViewer,
  };
}
