/**
 * Core types for the Navixa game engine.
 *
 * Pure TypeScript — ZERO react / react-native imports and no Node-only APIs,
 * so this module also runs unchanged inside Deno Edge Functions.
 *
 * Board convention: 10x10 grid. Columns are letters A-J (x = 0..9), rows are
 * numbers 1-10 (y = 0..9). Coordinates are stored numerically as { x, y } and
 * can be formatted to human-readable labels such as "A1" or "J10".
 */

/** A ship kind identifier. */
export type ShipId =
  | 'carrier'
  | 'battleship'
  | 'cruiser'
  | 'submarine'
  | 'destroyer';

/** A ship definition: which kind and how many cells long it is. */
export interface ShipSpec {
  id: ShipId;
  /** Length in cells. */
  length: number;
}

/** Rules that describe a fleet / board configuration. */
export interface FleetRules {
  /** Square board side length. Default 10. */
  boardSize: number;
  /** Ships that make up one fleet. */
  ships: ShipSpec[];
  /**
   * Whether ships are allowed to touch (including diagonally). When false, a
   * one-cell buffer is enforced around every ship. Default: true.
   */
  allowTouching: boolean;
}

/** Orientation of a placed ship. */
export type Orientation = 'horizontal' | 'vertical';

/** A zero-based board coordinate. x = column (A..), y = row (1..). */
export interface Coord {
  x: number;
  y: number;
}

/** A ship placed on the board. */
export interface Placement {
  id: ShipId;
  length: number;
  /** Top-left-most (smallest x/y) cell of the ship. */
  origin: Coord;
  orientation: Orientation;
}

/** A full fleet placement for one player. */
export type Fleet = Placement[];

/** Default fleet configuration used by the classic naval rules. */
export const DEFAULT_SHIPS: ShipSpec[] = [
  { id: 'carrier', length: 5 },
  { id: 'battleship', length: 4 },
  { id: 'cruiser', length: 3 },
  { id: 'submarine', length: 3 },
  { id: 'destroyer', length: 2 },
];

/** Default rules: 10x10, classic fleet, touching allowed. */
export const DEFAULT_RULES: FleetRules = {
  boardSize: 10,
  ships: DEFAULT_SHIPS,
  allowTouching: true,
};

/** Player identifiers within a single match. */
export type PlayerId = 'A' | 'B';

/** Result of a single shot. */
export type ShotResult = 'miss' | 'hit' | 'sunk';

/** A recorded shot in a match's move log. */
export interface Shot {
  /** Sequential move index, starting at 0. */
  index: number;
  by: PlayerId;
  coord: Coord;
  result: ShotResult;
  /** Ship sunk by this shot, if any. */
  sunkShip?: ShipId;
}

/** Per-player private state (fleet + shots taken against this player). */
export interface PlayerState {
  fleet: Fleet;
  /**
   * Cells that have been fired upon *this* player's board, keyed by cell key.
   * Value is the result at that cell.
   */
  shotsReceived: Record<string, ShotResult>;
}

/** Full authoritative match state (server-side / trusted). */
export interface MatchState {
  rules: FleetRules;
  players: Record<PlayerId, PlayerState>;
  /** Whose turn it is to fire. */
  turn: PlayerId;
  /** Sequential move counter (also the next move index). */
  moveCount: number;
  /** Ordered log of every shot. */
  log: Shot[];
  /** Winner, once the match is decided. */
  winner: PlayerId | null;
}
