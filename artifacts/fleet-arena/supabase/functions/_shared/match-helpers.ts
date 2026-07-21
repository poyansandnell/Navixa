/**
 * Shared helpers for loading/persisting match state and running the engine.
 *
 * The authoritative board layout lives in private_game_states (service-role
 * only). Here we reconstruct the engine's MatchState from the DB, run pure
 * engine transitions (applyShot), and persist the results — moves, events,
 * turn flip, clocks, and finalisation. Nothing in this module ever returns a
 * private board to a client.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { applyShot, projectPublicState } from './engine/match.ts';
import { validateFleet } from './engine/placement.ts';
import { DEFAULT_SHIPS } from './engine/types.ts';
import type {
  Fleet,
  FleetRules,
  MatchState,
  PlayerId,
  PlayerState,
  ShotResult,
} from './engine/types.ts';
import type { PublicMatchState } from './engine/match.ts';
import { appError, mapEngineError } from './errors.ts';

/** DB match row (fields we care about). */
export interface MatchRow {
  id: string;
  mode: string;
  status: string;
  board_size: number;
  ruleset: string;
  is_rated: boolean;
  is_private: boolean;
  turn_seconds: number;
  turn_number: number;
  current_turn_player_id: string | null;
  current_turn_seat: number | null;
  turn_deadline: string | null;
  winner_id: string | null;
}

/** DB match_players row (fields we care about). */
export interface PlayerRow {
  id: string;
  match_id: string;
  player_id: string | null;
  seat: number;
  is_ready: boolean;
  is_bot: boolean;
  bot_difficulty: string | null;
  time_left_ms: number | null;
}

export interface PrivateStateRow {
  id: string;
  match_id: string;
  player_id: string | null;
  seat: number | null;
  is_bot: boolean;
  board: Fleet;
  shots_received: { key: string; result: ShotResult }[] | Record<string, ShotResult>;
  fleet_submitted: boolean;
}

/** Build the engine rules for a match. */
export function rulesForMatch(match: MatchRow): FleetRules {
  return {
    boardSize: match.board_size,
    ships: DEFAULT_SHIPS,
    allowTouching: true,
  };
}

/** Map a seat (0/1) to an engine PlayerId (A/B). */
export function seatToPlayerId(seat: number): PlayerId {
  return seat === 0 ? 'A' : 'B';
}
export function playerIdToSeat(pid: PlayerId): number {
  return pid === 'A' ? 0 : 1;
}

/** Normalise a stored shots_received value into the engine's map form. */
function toShotMap(
  raw: PrivateStateRow['shots_received'],
): Record<string, ShotResult> {
  if (Array.isArray(raw)) {
    const out: Record<string, ShotResult> = {};
    for (const s of raw) out[s.key] = s.result;
    return out;
  }
  return { ...(raw ?? {}) };
}

/**
 * Rebuild the full authoritative MatchState from the two private_game_states
 * rows + match row. Seat 0 -> player A, seat 1 -> player B.
 */
export function buildMatchState(
  match: MatchRow,
  players: PlayerRow[],
  privates: PrivateStateRow[],
): MatchState {
  const rules = rulesForMatch(match);
  const bySeat = new Map(players.map((p) => [p.seat, p]));
  const p0 = bySeat.get(0);
  const p1 = bySeat.get(1);
  if (!p0 || !p1) {
    throw appError('MATCH_NOT_READY', 'Match is missing a player seat');
  }

  const privateFor = (pr: PlayerRow): PrivateStateRow => {
    // Prefer matching by seat (works for both humans and bots), fall back to
    // player_id for rows written before seat was populated.
    const found =
      privates.find((s) => s.seat === pr.seat) ??
      (pr.player_id ? privates.find((s) => s.player_id === pr.player_id) : undefined);
    if (!found) {
      throw appError('FLEET_NOT_SUBMITTED', `Seat ${pr.seat} has no submitted fleet`);
    }
    return found;
  };

  const s0 = privateFor(p0);
  const s1 = privateFor(p1);

  const stateA: PlayerState = {
    fleet: s0.board,
    shotsReceived: toShotMap(s0.shots_received),
  };
  const stateB: PlayerState = {
    fleet: s1.board,
    shotsReceived: toShotMap(s1.shots_received),
  };

  // Turn is derived from move parity: even move count -> whoever started (A).
  // We instead persist current_turn via match.current_turn_player_id; recompute
  // the engine turn from the move log length + first mover. Simpler + robust:
  // derive turn from turn_number is unreliable across resigns, so we rebuild by
  // replaying is not needed — we trust the stored shots and current turn seat.
  const turn = seatFromMatch(match, players);

  const winnerSeat = match.winner_id
    ? players.find((p) => p.player_id === match.winner_id)?.seat
    : undefined;

  return {
    rules,
    turn,
    // moveCount must equal total shots recorded so far (both boards).
    moveCount: countShots(stateA.shotsReceived) + countShots(stateB.shotsReceived),
    winner:
      winnerSeat === undefined || winnerSeat === null
        ? null
        : seatToPlayerId(winnerSeat),
    log: [],
    players: { A: stateA, B: stateB },
  };
}

function countShots(shots: Record<string, ShotResult>): number {
  return Object.keys(shots).length;
}

/** Whose turn it is, as an engine PlayerId, from the match's current turn. */
function seatFromMatch(match: MatchRow, players: PlayerRow[]): PlayerId {
  // Prefer the seat (robust for bot seats whose player_id is null).
  if (match.current_turn_seat === 0 || match.current_turn_seat === 1) {
    return seatToPlayerId(match.current_turn_seat);
  }
  if (match.current_turn_player_id) {
    const p = players.find((pl) => pl.player_id === match.current_turn_player_id);
    if (p) return seatToPlayerId(p.seat);
  }
  // Default to seat 0 (player A) when unset.
  return 'A';
}

/** Serialise a shotsReceived map back into a stored array form. */
export function shotMapToArray(
  shots: Record<string, ShotResult>,
): { key: string; result: ShotResult }[] {
  return Object.entries(shots).map(([key, result]) => ({ key, result }));
}

/** Validate a submitted fleet against a match's rules. Throws INVALID_FLEET. */
export function assertValidFleet(fleet: Fleet, match: MatchRow): void {
  const v = validateFleet(fleet, rulesForMatch(match));
  if (!v.valid) {
    throw appError('INVALID_FLEET', 'Fleet failed validation', v.errors);
  }
}

export interface FiredOutcome {
  result: ShotResult;
  sunkShip?: string;
  winnerSeat: number | null;
  moveIndex: number;
  newState: MatchState;
  idempotent: boolean;
}

/**
 * Run a single shot through the engine. `shooterSeat` is the seat firing.
 * Returns the outcome; throws mapped AppErrors on illegal moves.
 */
export function fireOnce(
  state: MatchState,
  shooterSeat: number,
  x: number,
  y: number,
): FiredOutcome {
  const shooter = seatToPlayerId(shooterSeat);
  try {
    const res = applyShot(state, shooter, { x, y });
    const winnerSeat =
      res.winner !== undefined ? playerIdToSeat(res.winner) : null;
    return {
      result: res.result,
      sunkShip: res.sunkShip,
      winnerSeat,
      moveIndex: res.moveIndex,
      newState: res.newState,
      idempotent: res.idempotent,
    };
  } catch (e) {
    throw mapEngineError(e);
  }
}

/** Public projection helper for reconnect. */
export function publicViewForSeat(
  state: MatchState,
  seat: number,
): PublicMatchState {
  return projectPublicState(state, seatToPlayerId(seat));
}

/**
 * Persist the target player's updated shots_received after a shot, insert the
 * match_moves row (idempotent via unique key), append a match_event and flip
 * the turn. Returns nothing; caller handles finalisation on a win.
 */
export async function persistShot(
  db: SupabaseClient,
  params: {
    match: MatchRow;
    shooter: PlayerRow;
    target: PlayerRow;
    outcome: FiredOutcome;
    x: number;
    y: number;
    idempotencyKey?: string;
  },
): Promise<void> {
  const { match, shooter, target, outcome, x, y } = params;
  const targetId = seatToPlayerId(target.seat);
  const newTargetShots = params.outcome.newState.players[targetId].shotsReceived;

  // Update the target's private shots_received (keyed by seat so bot seats,
  // which have a null player_id, are updated correctly too).
  const { error: updErr } = await db
    .from('private_game_states')
    .update({ shots_received: shotMapToArray(newTargetShots) })
    .eq('match_id', match.id)
    .eq('seat', target.seat);
  if (updErr) throw appError('INTERNAL', `persist shots failed: ${updErr.message}`);

  // Insert the move row. Unique on (match_id, move_number) AND on
  // (match_id, idempotency_key) — either collision means a duplicate replay.
  const { error: moveErr } = await db.from('match_moves').insert({
    match_id: match.id,
    player_id: shooter.player_id,
    move_number: outcome.moveIndex,
    target_x: x,
    target_y: y,
    is_hit: outcome.result !== 'miss',
    sunk_ship: outcome.sunkShip ?? null,
    idempotency_key: params.idempotencyKey ?? null,
  });
  if (moveErr) {
    // Unique violation -> duplicate move (idempotent replay by another request).
    if ((moveErr as { code?: string }).code === '23505') {
      throw appError('DUPLICATE_MOVE', 'This move was already applied');
    }
    throw appError('INTERNAL', `insert move failed: ${moveErr.message}`);
  }

  // Stat increments via a fresh read-modify-write (small, single row).
  await incrementShooterStats(db, shooter.id, outcome);

  // Turn flip: after a completed shot the turn passes to the target unless the
  // shooter just won. Persist both the seat (robust for bot seats) and the
  // player id.
  const nextSeat = outcome.winnerSeat === null ? target.seat : shooter.seat;
  const nextTurnPlayerId =
    outcome.winnerSeat === null ? target.player_id : shooter.player_id;

  await db
    .from('matches')
    .update({
      current_turn_player_id: nextTurnPlayerId,
      current_turn_seat: nextSeat,
      turn_number: match.turn_number + 1,
    })
    .eq('id', match.id);

  // Advance the clock (deduct from shooter, set new deadline on next player).
  if (outcome.winnerSeat === null) {
    await db.rpc('touch_turn_clock', {
      p_match_id: match.id,
      p_prev_seat: shooter.seat,
      p_active_seat: target.seat,
    });
  }

  await db.from('match_events').insert({
    match_id: match.id,
    actor_id: shooter.player_id,
    event_type: 'shot_fired',
    payload: {
      x,
      y,
      result: outcome.result,
      sunk_ship: outcome.sunkShip ?? null,
      move_number: outcome.moveIndex,
    },
  });
}

async function incrementShooterStats(
  db: SupabaseClient,
  playerRowId: string,
  outcome: FiredOutcome,
): Promise<void> {
  const { data } = await db
    .from('match_players')
    .select('shots_fired, hits, ships_sunk')
    .eq('id', playerRowId)
    .single();
  const cur = (data ?? { shots_fired: 0, hits: 0, ships_sunk: 0 }) as {
    shots_fired: number;
    hits: number;
    ships_sunk: number;
  };
  await db
    .from('match_players')
    .update({
      shots_fired: cur.shots_fired + 1,
      hits: cur.hits + (outcome.result === 'miss' ? 0 : 1),
      ships_sunk: cur.ships_sunk + (outcome.sunkShip ? 1 : 0),
    })
    .eq('id', playerRowId);
}

/** Load a match, its players and (optionally) private states in one place. */
export async function loadMatch(
  db: SupabaseClient,
  matchId: string,
): Promise<{ match: MatchRow; players: PlayerRow[] }> {
  const { data: match, error: mErr } = await db
    .from('matches')
    .select(
      'id, mode, status, board_size, ruleset, is_rated, is_private, turn_seconds, turn_number, current_turn_player_id, current_turn_seat, turn_deadline, winner_id',
    )
    .eq('id', matchId)
    .maybeSingle();
  if (mErr) throw appError('INTERNAL', mErr.message);
  if (!match) throw appError('MATCH_NOT_FOUND');

  const { data: players, error: pErr } = await db
    .from('match_players')
    .select(
      'id, match_id, player_id, seat, is_ready, is_bot, bot_difficulty, time_left_ms',
    )
    .eq('match_id', matchId)
    .order('seat', { ascending: true });
  if (pErr) throw appError('INTERNAL', pErr.message);

  return { match: match as MatchRow, players: (players ?? []) as PlayerRow[] };
}

/** Load private states for the given match. Service-role only. */
export async function loadPrivateStates(
  db: SupabaseClient,
  matchId: string,
): Promise<PrivateStateRow[]> {
  const { data, error } = await db
    .from('private_game_states')
    .select('id, match_id, player_id, seat, is_bot, board, shots_received, fleet_submitted')
    .eq('match_id', matchId);
  if (error) throw appError('INTERNAL', error.message);
  return (data ?? []) as PrivateStateRow[];
}

/** Require that `userId` is a participant; return their seat/player row. */
export function requireParticipant(players: PlayerRow[], userId: string): PlayerRow {
  const found = players.find((p) => p.player_id === userId);
  if (!found) throw appError('NOT_A_PARTICIPANT');
  return found;
}
