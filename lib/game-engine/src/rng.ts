/**
 * Deterministic, injectable pseudo-random number generator.
 *
 * Pure TypeScript — no react / react-native / Node-only APIs. Safe to run in
 * Deno Edge Functions. The engine and bots take an `RNG` so that all
 * randomness is reproducible and server-verifiable.
 */

export interface RNG {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number;
  /** Returns a copy of the RNG in its current state (for branching sims). */
  clone(): RNG;
}

/**
 * mulberry32 — a small, fast, deterministic 32-bit PRNG. Given the same seed
 * it always produces the same sequence across every platform.
 */
export function createRng(seed: number): RNG {
  let state = seed >>> 0;

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: RNG = {
    next,
    nextInt(min: number, max: number): number {
      if (max < min) {
        throw new Error(`nextInt: max (${max}) < min (${min})`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    clone(): RNG {
      return createRng(state);
    },
  };

  return rng;
}
