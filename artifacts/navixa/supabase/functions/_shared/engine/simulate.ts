/**
 * Match simulation harness — pits two bots against each other using only the
 * public projection each side is allowed to see. Deterministic given a seed.
 *
 * Pure TypeScript — no react / react-native / Node-only APIs.
 */

import type { Bot } from './bots.ts';
import { applyShot, createMatch, projectPublicState } from './match.ts';
import { autoPlace } from './placement.ts';
import { createRng, type RNG } from './rng.ts';
import { DEFAULT_RULES, type FleetRules, type MatchState, type PlayerId } from './types.ts';

export interface SimulationResult {
  winner: PlayerId;
  moves: number;
  finalState: MatchState;
}

export interface SimulateOptions {
  rules?: FleetRules;
  /** RNG for placement + both bots. */
  rng?: RNG;
  firstTurn?: PlayerId;
  /** Hard cap on moves to guarantee termination. */
  maxMoves?: number;
}

/**
 * Simulate a full match between two bots. Each bot receives ONLY the public
 * projection for its own side — it cannot access private state.
 */
export function simulateMatch(
  botA: Bot,
  botB: Bot,
  options: SimulateOptions = {},
): SimulationResult {
  const rules = options.rules ?? DEFAULT_RULES;
  const rng = options.rng ?? createRng(1);
  const firstTurn = options.firstTurn ?? 'A';
  const maxMoves = options.maxMoves ?? rules.boardSize * rules.boardSize * 2 + 10;

  const fleetA = autoPlace(rules, rng);
  const fleetB = autoPlace(rules, rng);

  let state = createMatch({ rules, fleetA, fleetB, firstTurn });

  let moves = 0;
  while (state.winner === null && moves < maxMoves) {
    const current = state.turn;
    const bot = current === 'A' ? botA : botB;
    const view = projectPublicState(state, current);
    const coord = bot(view, rng);
    const res = applyShot(state, current, coord);
    state = res.newState;
    moves += 1;
  }

  if (state.winner === null) {
    throw new Error('simulateMatch: match did not terminate within maxMoves');
  }

  return { winner: state.winner, moves, finalState: state };
}
