/**
 * Server-authoritative game helpers — ported from the Supabase edge
 * `_shared/match-helpers.ts`, now backed by Drizzle + @workspace/game-engine.
 *
 * The secret board layout lives only in private_game_states and is NEVER
 * returned to a client. We reconstruct the engine MatchState from the DB, run
 * pure engine transitions, and persist moves/events/turn/clock.
 */
import {
  applyShot,
  projectPublicState,
  validateFleet,
  DEFAULT_SHIPS,
  type Fleet,
  type FleetRules,
  type MatchState,
  type PlayerId,
  type PlayerState,
  type PublicMatchState,
  type ShotResult,
} from "@workspace/game-engine";
import type { Match, MatchPlayer, PrivateGameState } from "@workspace/db";
import { appError, mapEngineError } from "../lib/errors";

export type MatchRow = Match;
export type PlayerRow = MatchPlayer;
export type PrivateStateRow = PrivateGameState;

/** Build the engine rules for a match. */
export function rulesForMatch(match: MatchRow): FleetRules {
  return { boardSize: match.boardSize, ships: DEFAULT_SHIPS, allowTouching: true };
}

export function seatToPlayerId(seat: number): PlayerId {
  return seat === 0 ? "A" : "B";
}
export function playerIdToSeat(pid: PlayerId): number {
  return pid === "A" ? 0 : 1;
}

type StoredShot = { key: string; result: ShotResult };

/** Normalise a stored shots_received value into the engine map form. */
function toShotMap(raw: unknown): Record<string, ShotResult> {
  if (Array.isArray(raw)) {
    const out: Record<string, ShotResult> = {};
    for (const s of raw as StoredShot[]) {
      if (s && typeof s.key === "string") out[s.key] = s.result;
    }
    return out;
  }
  return { ...((raw as Record<string, ShotResult>) ?? {}) };
}

/** Serialise a shotsReceived map into the stored `{key,result}[]` form. */
export function shotMapToArray(shots: Record<string, ShotResult>): StoredShot[] {
  return Object.entries(shots).map(([key, result]) => ({ key, result }));
}

function countShots(shots: Record<string, ShotResult>): number {
  return Object.keys(shots).length;
}

function seatFromMatch(match: MatchRow, players: PlayerRow[]): PlayerId {
  if (match.currentTurnSeat === 0 || match.currentTurnSeat === 1) {
    return seatToPlayerId(match.currentTurnSeat);
  }
  if (match.currentTurnPlayerId) {
    const p = players.find((pl) => pl.playerId === match.currentTurnPlayerId);
    if (p) return seatToPlayerId(p.seat);
  }
  return "A";
}

/** Rebuild the full authoritative MatchState from private states + match row. */
export function buildMatchState(
  match: MatchRow,
  players: PlayerRow[],
  privates: PrivateStateRow[],
): MatchState {
  const rules = rulesForMatch(match);
  const bySeat = new Map(players.map((p) => [p.seat, p]));
  const p0 = bySeat.get(0);
  const p1 = bySeat.get(1);
  if (!p0 || !p1) throw appError("MATCH_NOT_READY", "Match is missing a player seat");

  const privateFor = (pr: PlayerRow): PrivateStateRow => {
    const found =
      privates.find((s) => s.seat === pr.seat) ??
      (pr.playerId ? privates.find((s) => s.playerId === pr.playerId) : undefined);
    if (!found) {
      throw appError("FLEET_NOT_SUBMITTED", `Seat ${pr.seat} has no submitted fleet`);
    }
    return found;
  };

  const s0 = privateFor(p0);
  const s1 = privateFor(p1);

  const stateA: PlayerState = {
    fleet: s0.board as unknown as Fleet,
    shotsReceived: toShotMap(s0.shotsReceived),
  };
  const stateB: PlayerState = {
    fleet: s1.board as unknown as Fleet,
    shotsReceived: toShotMap(s1.shotsReceived),
  };

  const turn = seatFromMatch(match, players);
  const winnerSeat = match.winnerId
    ? players.find((p) => p.playerId === match.winnerId)?.seat
    : undefined;

  return {
    rules,
    turn,
    moveCount: countShots(stateA.shotsReceived) + countShots(stateB.shotsReceived),
    winner:
      winnerSeat === undefined || winnerSeat === null
        ? null
        : seatToPlayerId(winnerSeat),
    log: [],
    players: { A: stateA, B: stateB },
  };
}

/** Validate a submitted fleet against a match's rules. Throws INVALID_FLEET. */
export function assertValidFleet(fleet: Fleet, match: MatchRow): void {
  const v = validateFleet(fleet, rulesForMatch(match));
  if (!v.valid) throw appError("INVALID_FLEET", "Fleet failed validation", v.errors);
}

export interface FiredOutcome {
  result: ShotResult;
  sunkShip?: string;
  winnerSeat: number | null;
  moveIndex: number;
  newState: MatchState;
  idempotent: boolean;
}

/** Run a single shot through the engine. Throws mapped AppErrors. */
export function fireOnce(
  state: MatchState,
  shooterSeat: number,
  x: number,
  y: number,
): FiredOutcome {
  const shooter = seatToPlayerId(shooterSeat);
  try {
    const res = applyShot(state, shooter, { x, y });
    return {
      result: res.result,
      sunkShip: res.sunkShip,
      winnerSeat: res.winner !== undefined ? playerIdToSeat(res.winner) : null,
      moveIndex: res.moveIndex,
      newState: res.newState,
      idempotent: res.idempotent,
    };
  } catch (e) {
    throw mapEngineError(e);
  }
}

/** Public projection for a given seat (reconnect / responses). */
export function publicViewForSeat(state: MatchState, seat: number): PublicMatchState {
  return projectPublicState(state, seatToPlayerId(seat));
}

/** Require `userId` is a participant; return their player row. */
export function requireParticipant(players: PlayerRow[], userId: string): PlayerRow {
  const found = players.find((p) => p.playerId === userId);
  if (!found) throw appError("NOT_A_PARTICIPANT");
  return found;
}
