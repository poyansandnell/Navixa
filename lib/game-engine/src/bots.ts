/**
 * Bot AI. Three difficulties: beginner, normal, expert.
 *
 * SECURITY BY DESIGN: `chooseShot` accepts ONLY a `PublicMatchState` (the same
 * redacted projection a human opponent receives) plus an RNG. There is no code
 * path that lets a bot read the authoritative `MatchState`, so a bot can never
 * see the opponent's unsunk ships. All targeting decisions are derived purely
 * from public information (own fired cells, misses, hits, sunk ships).
 *
 * Pure TypeScript — no react / react-native / Node-only APIs.
 */

import { coordKey, inBounds } from './coord';
import type { PublicCell, PublicMatchState } from './match';
import type { RNG } from './rng';
import type { Coord } from './types';

export type BotDifficulty = 'beginner' | 'normal' | 'expert';

/** A bot decision function. */
export type Bot = (view: PublicMatchState, rng: RNG) => Coord;

/** Build a bot for the requested difficulty. */
export function createBot(difficulty: BotDifficulty): Bot {
  switch (difficulty) {
    case 'beginner':
      return beginnerBot;
    case 'normal':
      return normalBot;
    case 'expert':
      return expertBot;
  }
}

// ---------------------------------------------------------------------------
// Shared helpers — derived purely from the public grid
// ---------------------------------------------------------------------------

function cellAt(view: PublicMatchState, x: number, y: number): PublicCell {
  return view.opponent.grid[y][x];
}

function alreadyFired(view: PublicMatchState, coord: Coord): boolean {
  return cellAt(view, coord.x, coord.y) !== 'unknown';
}

/** All cells not yet fired at. */
function candidateCells(view: PublicMatchState): Coord[] {
  const size = view.rules.boardSize;
  const out: Coord[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (cellAt(view, x, y) === 'unknown') out.push({ x, y });
    }
  }
  return out;
}

/**
 * "Open" hits: cells marked 'hit' (not yet 'sunk'). These belong to a still-
 * floating ship and are the seeds for target mode.
 */
function openHits(view: PublicMatchState): Coord[] {
  const size = view.rules.boardSize;
  const out: Coord[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (cellAt(view, x, y) === 'hit') out.push({ x, y });
    }
  }
  return out;
}

const NEIGHBORS: Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function pickRandom<T>(items: T[], rng: RNG): T {
  return items[rng.nextInt(0, items.length - 1)];
}

/** Remaining (unsunk) ship lengths, inferred from public sunk ships + rules. */
function remainingShipLengths(view: PublicMatchState): number[] {
  const sunkIds = new Set(view.opponent.sunkShips.map((s) => s.id));
  return view.rules.ships.filter((s) => !sunkIds.has(s.id)).map((s) => s.length);
}

// ---------------------------------------------------------------------------
// Beginner: mostly random, occasionally follows up an adjacent hit
// ---------------------------------------------------------------------------

const beginnerBot: Bot = (view, rng) => {
  const hits = openHits(view);
  // ~60% of the time, if there's an open hit, poke a neighbouring cell.
  if (hits.length > 0 && rng.next() < 0.6) {
    const targets: Coord[] = [];
    for (const hit of hits) {
      for (const d of NEIGHBORS) {
        const c = { x: hit.x + d.x, y: hit.y + d.y };
        if (inBounds(c, view.rules.boardSize) && !alreadyFired(view, c)) {
          targets.push(c);
        }
      }
    }
    if (targets.length > 0) return pickRandom(targets, rng);
  }
  const candidates = candidateCells(view);
  return pickRandom(candidates, rng);
};

// ---------------------------------------------------------------------------
// Normal: hunt-and-target with direction inference
// ---------------------------------------------------------------------------

const normalBot: Bot = (view, rng) => {
  const hits = openHits(view);

  if (hits.length > 0) {
    const targets = targetModeCandidates(view, hits);
    if (targets.length > 0) {
      return pickRandom(targets, rng);
    }
  }

  // Hunt mode with a parity mask: smallest remaining ship length defines the
  // checkerboard stride so we don't waste shots.
  return huntCell(view, rng);
};

/**
 * Candidate cells while targeting. If two or more open hits are collinear we
 * infer the ship's axis and only extend along that line; otherwise we probe
 * the orthogonal neighbours of every open hit.
 */
function targetModeCandidates(view: PublicMatchState, hits: Coord[]): Coord[] {
  // Group hits by connected line clusters and prefer extending known lines.
  const size = view.rules.boardSize;

  // Detect a horizontal run.
  const horiz = hits.filter((h) =>
    hits.some((o) => o.y === h.y && Math.abs(o.x - h.x) === 1),
  );
  const vert = hits.filter((h) =>
    hits.some((o) => o.x === h.x && Math.abs(o.y - h.y) === 1),
  );

  const line = horiz.length >= vert.length && horiz.length >= 2 ? horiz : vert.length >= 2 ? vert : null;

  const targets: Coord[] = [];
  if (line) {
    const isHoriz = line === horiz;
    const xs = line.map((c) => c.x);
    const ys = line.map((c) => c.y);
    if (isHoriz) {
      const y = ys[0];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      for (const c of [
        { x: minX - 1, y },
        { x: maxX + 1, y },
      ]) {
        if (inBounds(c, size) && !alreadyFired(view, c)) targets.push(c);
      }
    } else {
      const x = xs[0];
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      for (const c of [
        { x, y: minY - 1 },
        { x, y: maxY + 1 },
      ]) {
        if (inBounds(c, size) && !alreadyFired(view, c)) targets.push(c);
      }
    }
    if (targets.length > 0) return targets;
  }

  // Single hit (or no valid line extension): probe orthogonal neighbours.
  for (const hit of hits) {
    for (const d of NEIGHBORS) {
      const c = { x: hit.x + d.x, y: hit.y + d.y };
      if (inBounds(c, size) && !alreadyFired(view, c)) targets.push(c);
    }
  }
  return targets;
}

function huntCell(view: PublicMatchState, rng: RNG): Coord {
  const remaining = remainingShipLengths(view);
  const stride = remaining.length > 0 ? Math.min(...remaining) : 2;
  const candidates = candidateCells(view);
  const parity = candidates.filter((c) => (c.x + c.y) % stride === 0);
  const pool = parity.length > 0 ? parity : candidates;
  return pickRandom(pool, rng);
}

// ---------------------------------------------------------------------------
// Expert: probability-density map over placements of remaining ships
// ---------------------------------------------------------------------------

const expertBot: Bot = (view, rng) => {
  const size = view.rules.boardSize;
  const remaining = remainingShipLengths(view);

  // Density grid: for every legal placement of every remaining ship over cells
  // that are 'unknown' or 'hit', add weight. Cells overlapping an open hit get
  // a large multiplier so we finish off ships aggressively.
  const density: number[][] = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0),
  );

  const isOpen = (x: number, y: number): boolean => {
    const c = cellAt(view, x, y);
    return c === 'unknown' || c === 'hit';
  };
  const isHit = (x: number, y: number): boolean => cellAt(view, x, y) === 'hit';

  const hasOpenHit = openHits(view).length > 0;

  for (const length of remaining) {
    // Horizontal placements.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x <= size - length; x++) {
        let fits = true;
        let touchesHit = false;
        for (let i = 0; i < length; i++) {
          if (!isOpen(x + i, y)) {
            fits = false;
            break;
          }
          if (isHit(x + i, y)) touchesHit = true;
        }
        if (!fits) continue;
        const weight = touchesHit ? 50 : 1;
        for (let i = 0; i < length; i++) {
          density[y][x + i] += weight;
        }
      }
    }
    // Vertical placements.
    for (let x = 0; x < size; x++) {
      for (let y = 0; y <= size - length; y++) {
        let fits = true;
        let touchesHit = false;
        for (let i = 0; i < length; i++) {
          if (!isOpen(x, y + i)) {
            fits = false;
            break;
          }
          if (isHit(x, y + i)) touchesHit = true;
        }
        if (!fits) continue;
        const weight = touchesHit ? 50 : 1;
        for (let i = 0; i < length; i++) {
          density[y + i][x] += weight;
        }
      }
    }
  }

  // Never target a cell we've already fired at. Only consider 'unknown' cells.
  let best: Coord | null = null;
  let bestScore = -1;
  const ties: Coord[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (cellAt(view, x, y) !== 'unknown') continue;
      const score = density[y][x];
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
        ties.length = 0;
        ties.push({ x, y });
      } else if (score === bestScore) {
        ties.push({ x, y });
      }
    }
  }

  if (ties.length > 0 && bestScore > 0) {
    return pickRandom(ties, rng);
  }

  // Fallback: any remaining cell (guarantees a legal move even in edge cases).
  void hasOpenHit;
  const candidates = candidateCells(view);
  if (candidates.length === 0) {
    // Should never happen mid-match; return a defensive in-bounds coord.
    return best ?? { x: 0, y: 0 };
  }
  return pickRandom(candidates, rng);
};
