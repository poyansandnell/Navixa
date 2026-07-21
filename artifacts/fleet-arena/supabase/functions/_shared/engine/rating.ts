/**
 * Glicko-2 rating system + division mapping.
 *
 * Implements Mark Glickman's Glicko-2 algorithm
 * (http://www.glicko.net/glicko/glicko2.pdf). Pure TypeScript — no react /
 * react-native / Node-only APIs. Deterministic (no randomness).
 *
 * Ratings default to a start of 1000 (configurable).
 */

/** A player's Glicko-2 state on the human-readable (Glicko-1) scale. */
export interface Glicko2Rating {
  /** Rating (default start 1000). */
  rating: number;
  /** Rating deviation (uncertainty). */
  rd: number;
  /** Volatility. */
  volatility: number;
}

export interface Glicko2Config {
  /** Starting rating for a new player. Default 1000. */
  startRating: number;
  /** Starting rating deviation. Default 350. */
  startRd: number;
  /** Starting volatility. Default 0.06. */
  startVolatility: number;
  /**
   * System constant τ constraining volatility change over time. Sensible
   * values are 0.3–1.2. Default 0.5.
   */
  tau: number;
}

export const DEFAULT_GLICKO_CONFIG: Glicko2Config = {
  startRating: 1000,
  startRd: 350,
  startVolatility: 0.06,
  tau: 0.5,
};

/** Glicko-2 internal scale conversion factor. */
const SCALE = 173.7178;

/** Create a fresh rating from config. */
export function newRating(config: Glicko2Config = DEFAULT_GLICKO_CONFIG): Glicko2Rating {
  return {
    rating: config.startRating,
    rd: config.startRd,
    volatility: config.startVolatility,
  };
}

/** Outcome of a game from the perspective of the player being updated. */
export type GameOutcome = 'win' | 'loss' | 'draw';

function scoreOf(outcome: GameOutcome): number {
  if (outcome === 'win') return 1;
  if (outcome === 'loss') return 0;
  return 0.5;
}

interface OpponentResult {
  opponent: Glicko2Rating;
  outcome: GameOutcome;
}

function toGlicko2Scale(r: Glicko2Rating, config: Glicko2Config): {
  mu: number;
  phi: number;
  sigma: number;
} {
  return {
    mu: (r.rating - config.startRating) / SCALE,
    phi: r.rd / SCALE,
    sigma: r.volatility,
  };
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Update a single player's rating given one or more opponents/results within a
 * rating period. Returns a new rating (input is not mutated).
 */
export function updateRating(
  player: Glicko2Rating,
  results: OpponentResult[],
  config: Glicko2Config = DEFAULT_GLICKO_CONFIG,
): Glicko2Rating {
  const { mu, phi, sigma } = toGlicko2Scale(player, config);

  // Step 2: if the player did not compete, only RD increases.
  if (results.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return {
      rating: player.rating,
      rd: phiStar * SCALE,
      volatility: sigma,
    };
  }

  // Step 3: estimate variance v.
  let vInv = 0;
  const gj: number[] = [];
  const ej: number[] = [];
  for (const res of results) {
    const opp = toGlicko2Scale(res.opponent, config);
    const gPhiJ = g(opp.phi);
    const eScore = expectedScore(mu, opp.mu, opp.phi);
    gj.push(gPhiJ);
    ej.push(eScore);
    vInv += gPhiJ * gPhiJ * eScore * (1 - eScore);
  }
  const v = 1 / vInv;

  // Step 4: estimate delta.
  let deltaSum = 0;
  for (let i = 0; i < results.length; i++) {
    deltaSum += gj[i] * (scoreOf(results[i].outcome) - ej[i]);
  }
  const delta = v * deltaSum;

  // Step 5: iterate to find the new volatility σ'.
  const a = Math.log(sigma * sigma);
  const tau = config.tau;

  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * (phi * phi + v + ex) * (phi * phi + v + ex);
    return num / den - (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;
  const deltaSq = delta * delta;
  const phiSqPlusV = phi * phi + v;
  if (deltaSq > phiSqPlusV) {
    B = Math.log(deltaSq - phiSqPlusV);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      k += 1;
    }
    B = a - k * tau;
  }

  const epsilon = 0.000001;
  let fA = f(A);
  let fB = f(B);
  let iterations = 0;
  while (Math.abs(B - A) > epsilon && iterations < 100) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
    iterations += 1;
  }

  const newSigma = Math.exp(A / 2);

  // Step 6: pre-rating-period RD.
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);

  // Step 7: new RD and rating on the Glicko-2 scale.
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  // Step 8: convert back to the human scale.
  return {
    rating: newMu * SCALE + config.startRating,
    rd: newPhi * SCALE,
    volatility: newSigma,
  };
}

/**
 * Convenience: update both players after a single head-to-head game.
 * `outcomeForA` is the result from player A's perspective.
 */
export function updateHeadToHead(
  a: Glicko2Rating,
  b: Glicko2Rating,
  outcomeForA: GameOutcome,
  config: Glicko2Config = DEFAULT_GLICKO_CONFIG,
): { a: Glicko2Rating; b: Glicko2Rating } {
  const outcomeForB: GameOutcome =
    outcomeForA === 'win' ? 'loss' : outcomeForA === 'loss' ? 'win' : 'draw';
  return {
    a: updateRating(a, [{ opponent: b, outcome: outcomeForA }], config),
    b: updateRating(b, [{ opponent: a, outcome: outcomeForB }], config),
  };
}

// ---------------------------------------------------------------------------
// Divisions
// ---------------------------------------------------------------------------

export type DivisionId =
  | 'recruit'
  | 'sailor'
  | 'officer'
  | 'commander'
  | 'captain'
  | 'admiral'
  | 'grand_admiral';

export interface Division {
  id: DivisionId;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound (Infinity for the top division). */
  max: number;
}

/** Default division boundaries. Boundaries are configurable via `divisions`. */
export const DEFAULT_DIVISIONS: Division[] = [
  { id: 'recruit', min: -Infinity, max: 800 },
  { id: 'sailor', min: 800, max: 1000 },
  { id: 'officer', min: 1000, max: 1200 },
  { id: 'commander', min: 1200, max: 1400 },
  { id: 'captain', min: 1400, max: 1600 },
  { id: 'admiral', min: 1600, max: 1800 },
  { id: 'grand_admiral', min: 1800, max: Infinity },
];

/** Map a rating to its division. */
export function divisionForRating(
  rating: number,
  divisions: Division[] = DEFAULT_DIVISIONS,
): Division {
  const found = divisions.find((d) => rating >= d.min && rating < d.max);
  if (found) return found;
  // Defensive fallback: clamp to the top division.
  return divisions[divisions.length - 1];
}
