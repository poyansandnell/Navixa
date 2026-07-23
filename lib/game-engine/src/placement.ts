/**
 * Fleet placement: validation, seeded random generation and auto-place.
 *
 * Pure TypeScript — no react / react-native / Node-only APIs.
 */

import { coordKey, inBounds } from './coord';
import type { RNG } from './rng';
import type {
  Coord,
  Fleet,
  FleetRules,
  Orientation,
  Placement,
} from './types';

/** Return every cell occupied by a placement. */
export function placementCells(placement: Placement): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < placement.length; i++) {
    if (placement.orientation === 'horizontal') {
      cells.push({ x: placement.origin.x + i, y: placement.origin.y });
    } else {
      cells.push({ x: placement.origin.x, y: placement.origin.y + i });
    }
  }
  return cells;
}

/** All cells occupied by an entire fleet. */
export function fleetCells(fleet: Fleet): Coord[] {
  return fleet.flatMap(placementCells);
}

/** Details of why a placement/fleet is invalid. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a full fleet against the rules: correct ships, all in-bounds, no
 * overlaps, and (optionally) the no-touch buffer.
 */
export function validateFleet(fleet: Fleet, rules: FleetRules): ValidationResult {
  const errors: string[] = [];

  // Ship set must match the rules exactly (by id + length, ignoring order).
  const expected = [...rules.ships].sort((a, b) => a.id.localeCompare(b.id));
  const got = [...fleet]
    .map((p) => ({ id: p.id, length: p.length }))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (
    expected.length !== got.length ||
    expected.some((s, i) => s.id !== got[i].id || s.length !== got[i].length)
  ) {
    errors.push('fleet-composition-mismatch');
  }

  const occupied = new Map<string, number>();

  for (const placement of fleet) {
    if (placement.orientation !== 'horizontal' && placement.orientation !== 'vertical') {
      errors.push(`invalid-orientation:${placement.id}`);
      continue;
    }

    const cells = placementCells(placement);

    // In-bounds check.
    for (const cell of cells) {
      if (!inBounds(cell, rules.boardSize)) {
        errors.push(`out-of-bounds:${placement.id}`);
        break;
      }
    }

    // Overlap check.
    for (const cell of cells) {
      const key = coordKey(cell);
      occupied.set(key, (occupied.get(key) ?? 0) + 1);
    }
  }

  for (const count of occupied.values()) {
    if (count > 1) {
      errors.push('overlap');
      break;
    }
  }

  // No-touch buffer check.
  if (!rules.allowTouching) {
    for (let a = 0; a < fleet.length; a++) {
      for (let b = a + 1; b < fleet.length; b++) {
        if (placementsTouch(fleet[a], fleet[b])) {
          errors.push('ships-touching');
          break;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** True if two placements are adjacent (including diagonally) or overlapping. */
function placementsTouch(a: Placement, b: Placement): boolean {
  const cellsA = placementCells(a);
  const cellsB = placementCells(b);
  for (const ca of cellsA) {
    for (const cb of cellsB) {
      if (Math.abs(ca.x - cb.x) <= 1 && Math.abs(ca.y - cb.y) <= 1) {
        return true;
      }
    }
  }
  return false;
}

/** True if placing `placement` is legal given already-occupied cells. */
function canPlace(
  placement: Placement,
  rules: FleetRules,
  occupied: Set<string>,
): boolean {
  const cells = placementCells(placement);
  for (const cell of cells) {
    if (!inBounds(cell, rules.boardSize)) return false;
    if (occupied.has(coordKey(cell))) return false;
  }
  if (!rules.allowTouching) {
    for (const cell of cells) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const neighbor = coordKey({ x: cell.x + dx, y: cell.y + dy });
          if (occupied.has(neighbor)) return false;
        }
      }
    }
  }
  return true;
}

function markOccupied(placement: Placement, occupied: Set<string>): void {
  for (const cell of placementCells(placement)) {
    occupied.add(coordKey(cell));
  }
}

/**
 * Generate a random, valid fleet using the supplied seeded RNG. Deterministic:
 * the same RNG state always produces the same fleet.
 */
export function generateRandomFleet(rules: FleetRules, rng: RNG): Fleet {
  const maxAttempts = 2000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const fleet: Fleet = [];
    const occupied = new Set<string>();
    let ok = true;

    for (const spec of rules.ships) {
      let placed = false;
      for (let tries = 0; tries < 500 && !placed; tries++) {
        const orientation: Orientation = rng.next() < 0.5 ? 'horizontal' : 'vertical';
        const maxX =
          orientation === 'horizontal'
            ? rules.boardSize - spec.length
            : rules.boardSize - 1;
        const maxY =
          orientation === 'vertical'
            ? rules.boardSize - spec.length
            : rules.boardSize - 1;
        if (maxX < 0 || maxY < 0) {
          ok = false;
          break;
        }
        const origin: Coord = {
          x: rng.nextInt(0, maxX),
          y: rng.nextInt(0, maxY),
        };
        const placement: Placement = {
          id: spec.id,
          length: spec.length,
          origin,
          orientation,
        };
        if (canPlace(placement, rules, occupied)) {
          markOccupied(placement, occupied);
          fleet.push(placement);
          placed = true;
        }
      }
      if (!placed) {
        ok = false;
        break;
      }
    }

    if (ok && fleet.length === rules.ships.length) {
      return fleet;
    }
  }
  throw new Error('generateRandomFleet: could not place fleet within attempt budget');
}

/** Alias for generateRandomFleet — auto-place a valid fleet. */
export function autoPlace(rules: FleetRules, rng: RNG): Fleet {
  return generateRandomFleet(rules, rng);
}
