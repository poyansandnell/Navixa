import { describe, expect, it } from 'vitest';

import { createBot } from '../bots';
import { applyShot, createMatch, projectPublicState } from '../match';
import { autoPlace } from '../placement';
import { createRng } from '../rng';
import { simulateMatch } from '../simulate';
import { DEFAULT_RULES } from '../types';

describe('bot information constraints', () => {
  it('the bot API only accepts a public projection (no private state passable)', () => {
    // A PublicMatchState has no `players` map, no per-player fleets other than
    // `own`, and no opponent fleet. This is a compile-time + runtime guarantee.
    const rng = createRng(5);
    const state = createMatch({
      rules: DEFAULT_RULES,
      fleetA: autoPlace(DEFAULT_RULES, rng),
      fleetB: autoPlace(DEFAULT_RULES, rng),
    });
    const view = projectPublicState(state, 'A');
    // Runtime assertion: no way to read opponent fleet from what the bot gets.
    expect('players' in view).toBe(false);
    expect('fleet' in view.opponent).toBe(false);
  });

  it('bots never fire at a cell they could not know is empty (only unknown cells)', () => {
    for (const difficulty of ['beginner', 'normal', 'expert'] as const) {
      const bot = createBot(difficulty);
      const rng = createRng(123);
      const state = createMatch({
        rules: DEFAULT_RULES,
        fleetA: autoPlace(DEFAULT_RULES, rng),
        fleetB: autoPlace(DEFAULT_RULES, rng),
      });
      let s = state;
      const botRng = createRng(999);
      // Play 40 of A's shots and verify each target was 'unknown' beforehand.
      for (let i = 0; i < 40 && s.winner === null; i++) {
        const view = projectPublicState(s, s.turn);
        const shooter = s.turn;
        const coord = bot(view, botRng);
        // The cell the bot chose must have been unknown in ITS view.
        expect(view.opponent.grid[coord.y][coord.x]).toBe('unknown');
        s = applyShot(s, shooter, coord).newState;
      }
    }
  });
});

describe('bots always produce legal, terminating games', () => {
  it('every difficulty finishes a match within move budget', () => {
    for (const difficulty of ['beginner', 'normal', 'expert'] as const) {
      const bot = createBot(difficulty);
      const res = simulateMatch(bot, bot, { rng: createRng(7) });
      expect(res.winner === 'A' || res.winner === 'B').toBe(true);
    }
  });
});

describe('expert vs beginner strength', () => {
  it('expert beats beginner in the majority of simulated matches', () => {
    const expert = createBot('expert');
    const beginner = createBot('beginner');

    let expertWins = 0;
    const games = 40;
    for (let i = 0; i < games; i++) {
      // Alternate who moves first to remove first-move bias; expert is A on
      // even games, B on odd games. Count expert wins regardless of side.
      const rng = createRng(1000 + i);
      if (i % 2 === 0) {
        const res = simulateMatch(expert, beginner, { rng, firstTurn: 'A' });
        if (res.winner === 'A') expertWins++;
      } else {
        const res = simulateMatch(beginner, expert, { rng, firstTurn: 'A' });
        if (res.winner === 'B') expertWins++;
      }
    }

    // Expert should win clearly more than half.
    expect(expertWins).toBeGreaterThan(games / 2);
  });
});
