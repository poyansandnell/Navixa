import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DIVISIONS,
  DEFAULT_GLICKO_CONFIG,
  divisionForRating,
  newRating,
  updateHeadToHead,
  updateRating,
  type Glicko2Rating,
} from '../rating';

describe('Glicko-2 rating', () => {
  it('starts new players at the configured rating', () => {
    const r = newRating();
    expect(r.rating).toBe(1000);
    expect(r.rd).toBe(350);
    expect(r.volatility).toBeCloseTo(0.06, 5);
  });

  it('increases rating on a win and decreases on a loss', () => {
    const player = newRating();
    const opponent = newRating();
    const win = updateRating(player, [{ opponent, outcome: 'win' }]);
    const loss = updateRating(player, [{ opponent, outcome: 'loss' }]);
    expect(win.rating).toBeGreaterThan(player.rating);
    expect(loss.rating).toBeLessThan(player.rating);
  });

  it('reduces rating deviation after playing games', () => {
    const player = newRating();
    const opponent = newRating();
    const updated = updateRating(player, [
      { opponent, outcome: 'win' },
      { opponent, outcome: 'loss' },
      { opponent, outcome: 'win' },
    ]);
    expect(updated.rd).toBeLessThan(player.rd);
  });

  it('matches the canonical Glickman worked example', () => {
    // From the Glicko-2 paper: player 1500 (rd 200, vol 0.06), tau 0.5,
    // vs three opponents, results W, L, L.
    const config = { ...DEFAULT_GLICKO_CONFIG, startRating: 1500, tau: 0.5 };
    const player: Glicko2Rating = { rating: 1500, rd: 200, volatility: 0.06 };
    const opps: { opponent: Glicko2Rating; outcome: 'win' | 'loss' | 'draw' }[] = [
      { opponent: { rating: 1400, rd: 30, volatility: 0.06 }, outcome: 'win' },
      { opponent: { rating: 1550, rd: 100, volatility: 0.06 }, outcome: 'loss' },
      { opponent: { rating: 1700, rd: 300, volatility: 0.06 }, outcome: 'loss' },
    ];
    const result = updateRating(player, opps, config);
    // Expected from the paper: rating ~1464.06, rd ~151.52, vol ~0.05999.
    expect(result.rating).toBeCloseTo(1464.06, 1);
    expect(result.rd).toBeCloseTo(151.52, 1);
    expect(result.volatility).toBeCloseTo(0.05999, 4);
  });

  it('only increases RD when a player sits out (no games)', () => {
    const player: Glicko2Rating = { rating: 1000, rd: 100, volatility: 0.06 };
    const updated = updateRating(player, []);
    expect(updated.rating).toBe(1000);
    expect(updated.rd).toBeGreaterThan(100);
    expect(updated.volatility).toBeCloseTo(0.06, 5);
  });

  it('head-to-head updates both players symmetrically', () => {
    const a = newRating();
    const b = newRating();
    const { a: a2, b: b2 } = updateHeadToHead(a, b, 'win');
    expect(a2.rating).toBeGreaterThan(a.rating);
    expect(b2.rating).toBeLessThan(b.rating);
  });
});

describe('division mapping', () => {
  const cases: { rating: number; expected: string }[] = [
    { rating: 500, expected: 'recruit' },
    { rating: 799, expected: 'recruit' },
    { rating: 800, expected: 'sailor' },
    { rating: 999, expected: 'sailor' },
    { rating: 1000, expected: 'officer' },
    { rating: 1199, expected: 'officer' },
    { rating: 1200, expected: 'commander' },
    { rating: 1399, expected: 'commander' },
    { rating: 1400, expected: 'captain' },
    { rating: 1599, expected: 'captain' },
    { rating: 1600, expected: 'admiral' },
    { rating: 1799, expected: 'admiral' },
    { rating: 1800, expected: 'grand_admiral' },
    { rating: 2400, expected: 'grand_admiral' },
  ];

  for (const c of cases) {
    it(`maps ${c.rating} -> ${c.expected}`, () => {
      expect(divisionForRating(c.rating).id).toBe(c.expected);
    });
  }

  it('supports configurable boundaries', () => {
    const custom = [
      { id: 'recruit' as const, min: -Infinity, max: 1000 },
      { id: 'grand_admiral' as const, min: 1000, max: Infinity },
    ];
    expect(divisionForRating(999, custom).id).toBe('recruit');
    expect(divisionForRating(1000, custom).id).toBe('grand_admiral');
  });

  it('default divisions cover the full range without gaps', () => {
    for (let r = -200; r <= 2600; r += 50) {
      expect(() => divisionForRating(r, DEFAULT_DIVISIONS)).not.toThrow();
      expect(divisionForRating(r).id).toBeDefined();
    }
  });
});
