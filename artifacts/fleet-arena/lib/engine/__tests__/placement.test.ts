import { describe, expect, it } from 'vitest';

import { parseCoord } from '../coord';
import {
  autoPlace,
  generateRandomFleet,
  validateFleet,
} from '../placement';
import { createRng } from '../rng';
import { DEFAULT_RULES, type Fleet, type FleetRules } from '../types';

function fullFleet(): Fleet {
  // A hand-built valid non-touching layout on a 10x10 board.
  return [
    { id: 'carrier', length: 5, origin: parseCoord('A1'), orientation: 'horizontal' },
    { id: 'battleship', length: 4, origin: parseCoord('A3'), orientation: 'horizontal' },
    { id: 'cruiser', length: 3, origin: parseCoord('A5'), orientation: 'horizontal' },
    { id: 'submarine', length: 3, origin: parseCoord('A7'), orientation: 'horizontal' },
    { id: 'destroyer', length: 2, origin: parseCoord('A9'), orientation: 'horizontal' },
  ];
}

describe('placement validation', () => {
  it('accepts a valid fleet', () => {
    const res = validateFleet(fullFleet(), DEFAULT_RULES);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects overlapping ships', () => {
    const fleet = fullFleet();
    // Move the destroyer to overlap the carrier at A1-B1.
    fleet[4] = {
      id: 'destroyer',
      length: 2,
      origin: parseCoord('A1'),
      orientation: 'horizontal',
    };
    const res = validateFleet(fleet, DEFAULT_RULES);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('overlap');
  });

  it('rejects out-of-bounds ships', () => {
    const fleet = fullFleet();
    // Carrier starting at H1 horizontally would extend past column J.
    fleet[0] = {
      id: 'carrier',
      length: 5,
      origin: parseCoord('H1'),
      orientation: 'horizontal',
    };
    const res = validateFleet(fleet, DEFAULT_RULES);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.startsWith('out-of-bounds'))).toBe(true);
  });

  it('enforces no-touch rule when configured', () => {
    const noTouch: FleetRules = { ...DEFAULT_RULES, allowTouching: false };
    // Two ships on adjacent rows (A1 row and A2 row) touch.
    const fleet: Fleet = [
      { id: 'carrier', length: 5, origin: parseCoord('A1'), orientation: 'horizontal' },
      { id: 'battleship', length: 4, origin: parseCoord('A2'), orientation: 'horizontal' },
      { id: 'cruiser', length: 3, origin: parseCoord('A5'), orientation: 'horizontal' },
      { id: 'submarine', length: 3, origin: parseCoord('A7'), orientation: 'horizontal' },
      { id: 'destroyer', length: 2, origin: parseCoord('A9'), orientation: 'horizontal' },
    ];
    const res = validateFleet(fleet, noTouch);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('ships-touching');
  });

  it('rejects fleet with wrong composition', () => {
    const fleet = fullFleet().slice(0, 4);
    const res = validateFleet(fleet, DEFAULT_RULES);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('fleet-composition-mismatch');
  });
});

describe('random / auto placement', () => {
  it('auto-place always produces a valid fleet (many seeds, touching allowed)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed);
      const fleet = autoPlace(DEFAULT_RULES, rng);
      const res = validateFleet(fleet, DEFAULT_RULES);
      expect(res.valid, `seed ${seed}: ${res.errors.join(',')}`).toBe(true);
    }
  });

  it('auto-place always produces a valid fleet (no-touch rule)', () => {
    const noTouch: FleetRules = { ...DEFAULT_RULES, allowTouching: false };
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed * 7 + 1);
      const fleet = autoPlace(noTouch, rng);
      const res = validateFleet(fleet, noTouch);
      expect(res.valid, `seed ${seed}: ${res.errors.join(',')}`).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateRandomFleet(DEFAULT_RULES, createRng(42));
    const b = generateRandomFleet(DEFAULT_RULES, createRng(42));
    expect(a).toEqual(b);
  });
});
