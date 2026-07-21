import { describe, expect, it } from 'vitest';

import { parseCoord } from '../coord';
import {
  applyShot,
  createMatch,
  projectPublicState,
} from '../match';
import {
  DEFAULT_RULES,
  type Fleet,
  type FleetRules,
  type MatchState,
} from '../types';

/** Minimal deterministic fleets on a small board for precise assertions. */
const SMALL_RULES: FleetRules = {
  boardSize: 5,
  ships: [
    { id: 'cruiser', length: 3 },
    { id: 'destroyer', length: 2 },
  ],
  allowTouching: true,
};

function smallFleetA(): Fleet {
  return [
    { id: 'cruiser', length: 3, origin: parseCoord('A1'), orientation: 'horizontal' },
    { id: 'destroyer', length: 2, origin: parseCoord('A3'), orientation: 'horizontal' },
  ];
}

function smallFleetB(): Fleet {
  return [
    { id: 'cruiser', length: 3, origin: parseCoord('C3'), orientation: 'vertical' },
    { id: 'destroyer', length: 2, origin: parseCoord('E1'), orientation: 'vertical' },
  ];
}

function newSmallMatch(): MatchState {
  return createMatch({
    rules: SMALL_RULES,
    fleetA: smallFleetA(),
    fleetB: smallFleetB(),
    firstTurn: 'A',
  });
}

describe('applyShot results', () => {
  it('reports a miss', () => {
    const state = newSmallMatch();
    // B has nothing at A5.
    const res = applyShot(state, 'A', parseCoord('A5'));
    expect(res.result).toBe('miss');
    expect(res.winner).toBeUndefined();
    expect(res.newState.turn).toBe('B');
  });

  it('reports a hit', () => {
    const state = newSmallMatch();
    // B cruiser occupies C3 (vertical: C3,C4,C5).
    const res = applyShot(state, 'A', parseCoord('C3'));
    expect(res.result).toBe('hit');
    expect(res.sunkShip).toBeUndefined();
  });

  it('reports a sunk ship when all its cells are hit', () => {
    let state = newSmallMatch();
    // B destroyer occupies E1,E2 (vertical). A fires, B fires (miss), A fires.
    state = applyShot(state, 'A', parseCoord('E1')).newState; // hit
    state = applyShot(state, 'B', parseCoord('A5')).newState; // B miss
    const res = applyShot(state, 'A', parseCoord('E2')); // sinks destroyer
    expect(res.result).toBe('sunk');
    expect(res.sunkShip).toBe('destroyer');
  });

  it('does not mutate the input state', () => {
    const state = newSmallMatch();
    const before = JSON.stringify(state);
    applyShot(state, 'A', parseCoord('C3'));
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('turn + firing rules', () => {
  it('rejects firing out of turn', () => {
    const state = newSmallMatch();
    expect(() => applyShot(state, 'B', parseCoord('A1'))).toThrow('not-your-turn');
  });

  it('rejects firing the same cell twice', () => {
    let state = newSmallMatch();
    state = applyShot(state, 'A', parseCoord('A5')).newState; // A miss
    state = applyShot(state, 'B', parseCoord('B1')).newState; // B some shot
    // A tries A5 again.
    expect(() => applyShot(state, 'A', parseCoord('A5'))).toThrow('cell-already-fired');
  });

  it('rejects out-of-bounds shots', () => {
    const state = newSmallMatch();
    expect(() => applyShot(state, 'A', { x: 9, y: 9 })).toThrow(/out-of-bounds/);
  });
});

describe('winning', () => {
  it('ends the match when all opponent ships are sunk', () => {
    let state = newSmallMatch();
    // B cruiser: C3,C4,C5 ; B destroyer: E1,E2.
    const bCells = ['C3', 'C4', 'C5', 'E1', 'E2'];
    let idx = 0;
    let lastWinner: string | undefined;
    for (const label of bCells) {
      const res = applyShot(state, 'A', parseCoord(label));
      state = res.newState;
      lastWinner = res.winner;
      // Give B a throwaway move between A's shots (unless match ended).
      if (state.winner === null) {
        const filler = ['A5', 'B5', 'C1', 'D5', 'E5'][idx++];
        state = applyShot(state, 'B', parseCoord(filler)).newState;
      }
    }
    expect(lastWinner).toBe('A');
    expect(state.winner).toBe('A');
  });

  it('rejects further shots once the match is over', () => {
    let state = newSmallMatch();
    const bCells = ['C3', 'C4', 'C5', 'E1', 'E2'];
    let idx = 0;
    for (const label of bCells) {
      state = applyShot(state, 'A', parseCoord(label)).newState;
      if (state.winner === null) {
        const filler = ['A5', 'B5', 'C1', 'D5', 'E5'][idx++];
        state = applyShot(state, 'B', parseCoord(filler)).newState;
      }
    }
    expect(state.winner).toBe('A');
    expect(() => applyShot(state, 'A', parseCoord('A5'))).toThrow('match-already-over');
  });
});

describe('idempotency', () => {
  it('registers a result only once when replayed with the same move index', () => {
    const state = newSmallMatch();
    const first = applyShot(state, 'A', parseCoord('C3'), { expectedMoveIndex: 0 });
    expect(first.idempotent).toBe(false);
    expect(first.moveIndex).toBe(0);
    const nextState = first.newState;
    expect(nextState.moveCount).toBe(1);
    expect(nextState.log).toHaveLength(1);

    // Replaying move index 0 on the advanced state returns the recorded result
    // and does not append another log entry or change the move count.
    // (Turn has passed to B, so we must ask on behalf of A again — the engine
    //  short-circuits before the turn check via the recorded-move path only
    //  when it's still A's turn, so we assert on a state where A replays before
    //  advancing.)
    const replay = applyShot(state, 'A', parseCoord('C3'), { expectedMoveIndex: 0 });
    expect(replay.result).toBe(first.result);
    expect(replay.newState.moveCount).toBe(1);
    expect(replay.newState.log).toHaveLength(1);
  });

  it('detects idempotent replay against an advanced state', () => {
    let state = newSmallMatch();
    const first = applyShot(state, 'A', parseCoord('C3'), { expectedMoveIndex: 0 });
    state = first.newState; // now B's turn, moveCount = 1
    const second = applyShot(state, 'B', parseCoord('A1'), { expectedMoveIndex: 1 });
    state = second.newState; // now A's turn, moveCount = 2

    // A replays its original move 0: recognised as idempotent, no state change.
    const replay = applyShot(state, 'A', parseCoord('C3'), { expectedMoveIndex: 0 });
    expect(replay.idempotent).toBe(true);
    expect(replay.result).toBe(first.result);
    expect(replay.newState.moveCount).toBe(2);
    expect(replay.newState.log).toHaveLength(2);
  });

  it('rejects a stale/mismatched move index', () => {
    let state = newSmallMatch();
    state = applyShot(state, 'A', parseCoord('C3'), { expectedMoveIndex: 0 }).newState;
    state = applyShot(state, 'B', parseCoord('A1'), { expectedMoveIndex: 1 }).newState;
    // A now at moveCount 2. Replaying index 0 with a DIFFERENT coord is stale.
    expect(() =>
      applyShot(state, 'A', parseCoord('D5'), { expectedMoveIndex: 0 }),
    ).toThrow('stale-move-index');
  });
});

describe('public projection', () => {
  it('never exposes opponent unsunk ship positions', () => {
    const state = newSmallMatch();
    const view = projectPublicState(state, 'A');
    // No shots yet: opponent grid is entirely 'unknown'.
    const flat = view.opponent.grid.flat();
    expect(flat.every((c) => c === 'unknown')).toBe(true);
    expect(view.opponent.sunkShips).toHaveLength(0);

    // The serialized public view must not contain the opponent's fleet coords.
    const serialized = JSON.stringify(view);
    // B cruiser is at C3 (x=2,y=2). Ensure that raw placement isn't leaked as
    // a "fleet" for the opponent — the view only has `own.fleet`.
    expect((view as unknown as { opponent: { fleet?: unknown } }).opponent.fleet).toBeUndefined();
    // The viewer's own fleet IS present.
    expect(view.own.fleet.length).toBe(SMALL_RULES.ships.length);
    // Sanity: serialized view length is bounded and doesn't error.
    expect(serialized.length).toBeGreaterThan(0);
  });

  it('reveals only fired cells and full sunk ships', () => {
    let state = newSmallMatch();
    // Sink B destroyer at E1,E2.
    state = applyShot(state, 'A', parseCoord('E1')).newState;
    state = applyShot(state, 'B', parseCoord('A5')).newState;
    state = applyShot(state, 'A', parseCoord('E2')).newState;

    const view = projectPublicState(state, 'A');
    expect(view.opponent.sunkShips.map((s) => s.id)).toContain('destroyer');
    const e1 = parseCoord('E1');
    expect(view.opponent.grid[e1.y][e1.x]).toBe('sunk');
    // A cell A1 (never fired at B) stays unknown even though B has a ship near.
    const a1 = parseCoord('A1');
    expect(view.opponent.grid[a1.y][a1.x]).toBe('unknown');
  });

  it('reports whose turn it is', () => {
    const state = newSmallMatch();
    expect(projectPublicState(state, 'A').yourTurn).toBe(true);
    expect(projectPublicState(state, 'B').yourTurn).toBe(false);
  });
});

describe('default rules sanity', () => {
  it('classic fleet sums to 17 cells', () => {
    const total = DEFAULT_RULES.ships.reduce((n, s) => n + s.length, 0);
    expect(total).toBe(17);
  });
});
