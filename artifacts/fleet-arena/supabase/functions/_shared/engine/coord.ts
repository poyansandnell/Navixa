/**
 * Coordinate helpers. Pure TypeScript, no external deps.
 */

import type { Coord } from './types.ts';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Stable string key for a coordinate (used as map keys). */
export function coordKey(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

/** Parse a coordinate key back into a Coord. */
export function parseKey(key: string): Coord {
  const [x, y] = key.split(',').map((n) => Number.parseInt(n, 10));
  return { x, y };
}

/** Human-readable label, e.g. { x: 0, y: 0 } => "A1", { x: 9, y: 9 } => "J10". */
export function formatCoord(coord: Coord): string {
  return `${LETTERS[coord.x] ?? '?'}${coord.y + 1}`;
}

/** Parse a label such as "A1" or "J10" into a Coord. */
export function parseCoord(label: string): Coord {
  const match = /^([A-Za-z])(\d+)$/.exec(label.trim());
  if (!match) {
    throw new Error(`Invalid coordinate label: ${label}`);
  }
  const x = LETTERS.indexOf(match[1].toUpperCase());
  const y = Number.parseInt(match[2], 10) - 1;
  return { x, y };
}

/** True if a coordinate is inside a square board of the given size. */
export function inBounds(coord: Coord, boardSize: number): boolean {
  return coord.x >= 0 && coord.y >= 0 && coord.x < boardSize && coord.y < boardSize;
}

/** Value equality for coordinates. */
export function coordEquals(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}
