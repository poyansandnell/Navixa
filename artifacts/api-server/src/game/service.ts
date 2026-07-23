/**
 * Server-authoritative match orchestration ported from the Supabase edge
 * functions + SQL functions (finalize_match, update_rating, touch_turn_clock,
 * applyShot). Emits realtime events from the same code path as the DB write.
 *
 * Concurrency model: every state-mutating path (fire shot, bot move, timeout,
 * resign, finalize) runs inside a single drizzle transaction that FIRST locks
 * the matches row with `SELECT ... FOR UPDATE`, then re-reads the players and
 * private_game_states rows inside that same transaction. This serialises a
 * human shot against a concurrent bot move / timeout so they cannot interleave.
 * Socket emits are collected during the transaction and flushed only AFTER it
 * commits.
 */
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  matchesTable,
  matchPlayersTable,
  matchMovesTable,
  matchEventsTable,
  privateGameStatesTable,
  ratingsTable,
  ratingHistoryTable,
  type Match,
  type MatchPlayer,
} from "@workspace/db";
import type { ShotResult } from "@workspace/game-engine";
import { appError } from "../lib/errors";
import {
  buildMatchState,
  fireOnce,
  publicViewForSeat,
  seatToPlayerId,
  shotMapToArray,
  type MatchRow,
  type PlayerRow,
  type PrivateStateRow,
} from "./helpers";
import {
  emitMatchEvent,
  emitMatchMove,
  emitMatchUpdate,
} from "../realtime/emitter";

/** Transaction handle type (the argument drizzle passes to the tx callback). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A deferred socket emit. Collected inside a transaction and flushed only after
 * it commits so clients never observe uncommitted (or rolled-back) state.
 */
type Emit =
  | { kind: "update"; matchId: string; payload: Record<string, unknown> }
  | { kind: "move"; matchId: string; payload: Record<string, unknown> }
  | { kind: "event"; matchId: string; payload: Record<string, unknown> };

function flushEmits(emits: Emit[]): void {
  for (const e of emits) {
    if (e.kind === "update") emitMatchUpdate(e.matchId, e.payload);
    else if (e.kind === "move") emitMatchMove(e.matchId, e.payload);
    else emitMatchEvent(e.matchId, e.payload);
  }
}

/** Load a match + its player rows (ordered by seat). Read-only, no locks. */
export async function loadMatch(
  matchId: string,
): Promise<{ match: MatchRow; players: PlayerRow[] }> {
  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);
  if (!match) throw appError("MATCH_NOT_FOUND");
  const players = await db
    .select()
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.matchId, matchId))
    .orderBy(matchPlayersTable.seat);
  return { match, players };
}

export async function loadPrivateStates(matchId: string) {
  return db
    .select()
    .from(privateGameStatesTable)
    .where(eq(privateGameStatesTable.matchId, matchId));
}

/**
 * Lock a match and its players/private-state rows inside a transaction.
 * Returns everything a state mutation needs, already serialised via FOR UPDATE.
 */
async function lockMatch(
  tx: Tx,
  matchId: string,
): Promise<{ match: MatchRow; players: PlayerRow[]; privates: PrivateStateRow[] }> {
  const [match] = await tx
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .for("update")
    .limit(1);
  if (!match) throw appError("MATCH_NOT_FOUND");
  const players = await tx
    .select()
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.matchId, matchId))
    .for("update")
    .orderBy(matchPlayersTable.seat);
  const privates = await tx
    .select()
    .from(privateGameStatesTable)
    .where(eq(privateGameStatesTable.matchId, matchId));
  return { match, players, privates };
}

/** Insert a match_event row and emit it (used by non-shot paths). */
export async function recordEvent(
  matchId: string,
  eventType: string,
  actorId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(matchEventsTable).values({
    matchId,
    actorId,
    eventType,
    payload,
  });
  emitMatchEvent(matchId, { eventType, actorId, payload });
}

// ---------------------------------------------------------------------------
// Elo rating update — ports update_rating() SQL function. Transaction-scoped.
// ---------------------------------------------------------------------------
async function updateRatingTx(
  tx: Tx,
  playerId: string,
  mode: Match["mode"],
  opponentRating: number,
  result: 0 | 0.5 | 1,
  matchId: string | null,
): Promise<number> {
  await tx
    .insert(ratingsTable)
    .values({ playerId, mode })
    .onConflictDoNothing({
      target: [ratingsTable.playerId, ratingsTable.mode],
    });

  const [row] = await tx
    .select({ rating: ratingsTable.rating, games: ratingsTable.gamesPlayed })
    .from(ratingsTable)
    .where(and(eq(ratingsTable.playerId, playerId), eq(ratingsTable.mode, mode)))
    .limit(1);

  const rating = row?.rating ?? 1200;
  const games = row?.games ?? 0;

  const k = games < 15 ? 40 : rating >= 2100 ? 16 : 24;
  const expected = 1.0 / (1.0 + Math.pow(10.0, (opponentRating - rating) / 400.0));
  let next = Math.round(rating + k * (result - expected));
  next = Math.max(0, Math.min(4000, next));
  const delta = next - rating;

  const resultEnum = result === 1 ? "win" : result === 0 ? "loss" : "draw";

  await tx
    .update(ratingsTable)
    .set({
      rating: next,
      gamesPlayed: sql`${ratingsTable.gamesPlayed} + 1`,
      wins: sql`${ratingsTable.wins} + ${result === 1 ? 1 : 0}`,
      losses: sql`${ratingsTable.losses} + ${result === 0 ? 1 : 0}`,
      draws: sql`${ratingsTable.draws} + ${result === 0.5 ? 1 : 0}`,
      winStreak: result === 1 ? sql`${ratingsTable.winStreak} + 1` : sql`0`,
      bestRating: sql`greatest(${ratingsTable.bestRating}, ${next})`,
    })
    .where(and(eq(ratingsTable.playerId, playerId), eq(ratingsTable.mode, mode)));

  await tx.insert(ratingHistoryTable).values({
    playerId,
    mode,
    matchId,
    ratingBefore: rating,
    ratingAfter: next,
    ratingDelta: delta,
    result: resultEnum,
  });

  return next;
}

// ---------------------------------------------------------------------------
// finalize_match — idempotent finalisation. Transaction-scoped core + public
// wrapper. The core assumes the match row is already (or will be) locked in tx.
// ---------------------------------------------------------------------------
async function finalizeMatchTx(
  tx: Tx,
  match: MatchRow,
  players: PlayerRow[],
  winnerId: string | null,
  abandoned: boolean,
): Promise<{ applied: boolean; match: MatchRow; emits: Emit[] }> {
  if (["finished", "abandoned", "cancelled"].includes(match.status)) {
    return { applied: false, match, emits: [] };
  }

  const p0 = players.find((p) => p.seat === 0);
  const p1 = players.find((p) => p.seat === 1);
  if (!p0 || !p1) throw appError("MATCH_NOT_READY", "Match is missing a player seat");

  let res0: 0 | 0.5 | 1;
  let res1: 0 | 0.5 | 1;
  if (winnerId === null) {
    res0 = 0.5;
    res1 = 0.5;
  } else if (winnerId === p0.playerId) {
    res0 = 1;
    res1 = 0;
  } else if (winnerId === p1.playerId) {
    res0 = 0;
    res1 = 1;
  } else {
    throw appError("WRONG_MATCH_STATE", "winner is not a participant");
  }

  const [updated] = await tx
    .update(matchesTable)
    .set({
      status: abandoned ? "abandoned" : "finished",
      winnerId,
      finishedAt: new Date(),
    })
    .where(eq(matchesTable.id, match.id))
    .returning();

  const resultFor = (p: MatchPlayer): "win" | "loss" | "draw" =>
    p.playerId === winnerId ? "win" : winnerId === null ? "draw" : "loss";

  if (match.isRated && p0.playerId && p1.playerId) {
    const r0 = p0.ratingBefore ?? 1200;
    const r1 = p1.ratingBefore ?? 1200;
    const new0 = await updateRatingTx(tx, p0.playerId, match.mode, r1, res0, match.id);
    const new1 = await updateRatingTx(tx, p1.playerId, match.mode, r0, res1, match.id);
    await tx
      .update(matchPlayersTable)
      .set({
        ratingAfter: new0,
        ratingDelta: new0 - (p0.ratingBefore ?? new0),
        result: resultFor(p0),
      })
      .where(eq(matchPlayersTable.id, p0.id));
    await tx
      .update(matchPlayersTable)
      .set({
        ratingAfter: new1,
        ratingDelta: new1 - (p1.ratingBefore ?? new1),
        result: resultFor(p1),
      })
      .where(eq(matchPlayersTable.id, p1.id));
  } else {
    for (const p of players) {
      await tx
        .update(matchPlayersTable)
        .set({ result: resultFor(p) })
        .where(eq(matchPlayersTable.id, p.id));
    }
  }

  await tx.insert(matchEventsTable).values({
    matchId: match.id,
    eventType: "match_finalized",
    payload: { winner_id: winnerId, abandoned },
  });

  const finalMatch = updated ?? match;
  const emits: Emit[] = [
    {
      kind: "update",
      matchId: match.id,
      payload: {
        status: finalMatch.status,
        winnerId,
        finishedAt: finalMatch.finishedAt,
      },
    },
    {
      kind: "event",
      matchId: match.id,
      payload: { eventType: "match_finalized", payload: { winner_id: winnerId, abandoned } },
    },
  ];
  return { applied: true, match: finalMatch, emits };
}

/**
 * Public finalize entry point. Locks the match + players, finalises, commits,
 * then flushes emits. Used by resign / finalize routes and standalone callers.
 */
export async function finalizeMatch(
  matchId: string,
  winnerId: string | null,
  abandoned = false,
): Promise<Match> {
  const { match, emits } = await db.transaction(async (tx) => {
    const locked = await lockMatch(tx, matchId);
    return finalizeMatchTx(tx, locked.match, locked.players, winnerId, abandoned);
  });
  flushEmits(emits);
  return match;
}

// ---------------------------------------------------------------------------
// touch_turn_clock — deduct elapsed time + stamp a fresh deadline. Operates on
// the already-locked match row inside the caller's transaction.
// ---------------------------------------------------------------------------
async function touchTurnClockTx(
  tx: Tx,
  match: MatchRow,
  prevSeat: number | null,
  activeSeat: number,
): Promise<Date> {
  if (prevSeat !== null && match.turnDeadline) {
    const remaining = Math.max(
      0,
      Math.floor(match.turnDeadline.getTime() - Date.now()),
    );
    const elapsed = Math.max(0, match.turnSeconds * 1000 - remaining);
    await tx
      .update(matchPlayersTable)
      .set({
        timeLeftMs: sql`greatest(0, coalesce(${matchPlayersTable.timeLeftMs}, ${match.turnSeconds * 1000}) - ${elapsed})`,
      })
      .where(
        and(
          eq(matchPlayersTable.matchId, match.id),
          eq(matchPlayersTable.seat, prevSeat),
        ),
      );
  }

  const deadline = new Date(Date.now() + match.turnSeconds * 1000);
  await tx
    .update(matchesTable)
    .set({ turnDeadline: deadline, currentTurnSeat: activeSeat })
    .where(eq(matchesTable.id, match.id));
  return deadline;
}

// ---------------------------------------------------------------------------
// applyShot — the single atomic shot application path.
// ---------------------------------------------------------------------------
export interface ShotApplyResult {
  idempotent: boolean;
  result: ShotResult;
  sunkShip: string | null;
  moveNumber: number;
  /** null while ongoing, else the winning seat's player id (null for bot). */
  winnerId: string | null;
  /** "A"|"B" style winner id from engine, or null. */
  winnerSeat: number | null;
  /** Public projection for the shooter's seat. */
  view: ReturnType<typeof publicViewForSeat>;
  /** The seat that must move next (opponent unless the shooter just won). */
  nextSeat: number;
}

/**
 * Apply a single shot atomically. Locks the match row, re-reads turn state and
 * private states inside the transaction, checks idempotency, records the move
 * (unique-violation ⇒ returns the previously-recorded result), mutates private
 * state / stats / turn / clock, and finalises when the shot wins — all in ONE
 * transaction. Socket emits are flushed only after commit.
 */
export async function applyShot(params: {
  matchId: string;
  /** Human shooter's user id. Omit for a bot shot (use shooterSeat instead). */
  shooterUserId?: string;
  /** Bot shooter's seat. Omit for a human shot. */
  shooterSeat?: number;
  x: number;
  y: number;
  idempotencyKey: string;
}): Promise<ShotApplyResult> {
  const { result, emits } = await db.transaction(async (tx) => {
    const { match, players, privates } = await lockMatch(tx, params.matchId);

    // Resolve the shooter seat (human by id, or explicit bot seat).
    let shooter: PlayerRow | undefined;
    if (params.shooterUserId !== undefined) {
      shooter = players.find((p) => p.playerId === params.shooterUserId);
      if (!shooter) throw appError("NOT_A_PARTICIPANT");
    } else if (params.shooterSeat !== undefined) {
      shooter = players.find((p) => p.seat === params.shooterSeat);
      if (!shooter) throw appError("MATCH_NOT_READY");
    } else {
      throw appError("INVALID_PAYLOAD", "shooter is required");
    }
    const target = players.find((p) => p.seat !== shooter!.seat);
    if (!target) throw appError("MATCH_NOT_READY");

    // Idempotency check INSIDE the transaction (serialised by the match lock).
    const [existingMove] = await tx
      .select()
      .from(matchMovesTable)
      .where(
        and(
          eq(matchMovesTable.matchId, params.matchId),
          eq(matchMovesTable.idempotencyKey, params.idempotencyKey),
        ),
      )
      .limit(1);
    if (existingMove) {
      const state = buildMatchState(match, players, privates);
      const winnerSeat = state.winner === null ? null : state.winner === "A" ? 0 : 1;
      const winnerId =
        winnerSeat === null
          ? null
          : players.find((p) => p.seat === winnerSeat)?.playerId ?? null;
      const res: ShotApplyResult = {
        idempotent: true,
        result: existingMove.isHit
          ? existingMove.sunkShip
            ? "sunk"
            : "hit"
          : "miss",
        sunkShip: existingMove.sunkShip,
        moveNumber: existingMove.moveNumber,
        winnerId,
        winnerSeat,
        view: publicViewForSeat(state, shooter.seat),
        nextSeat: state.turn === seatToPlayerId(0) ? 0 : 1,
      };
      return { result: res, emits: [] as Emit[] };
    }

    if (match.status !== "active") {
      throw appError("WRONG_MATCH_STATE", `Match is '${match.status}', not active`);
    }

    const state = buildMatchState(match, players, privates);
    if (state.winner !== null) throw appError("MATCH_ALREADY_OVER");
    if (state.turn !== seatToPlayerId(shooter.seat)) throw appError("NOT_YOUR_TURN");

    const outcome = fireOnce(state, shooter.seat, params.x, params.y);

    // Record the move FIRST so a unique-violation aborts the whole transaction.
    try {
      await tx.insert(matchMovesTable).values({
        matchId: match.id,
        playerId: shooter.playerId,
        moveNumber: outcome.moveIndex,
        targetX: params.x,
        targetY: params.y,
        isHit: outcome.result !== "miss",
        sunkShip: outcome.sunkShip ?? null,
        idempotencyKey: params.idempotencyKey,
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        // A concurrent writer recorded this exact move/key; re-read + return it.
        const [dup] = await tx
          .select()
          .from(matchMovesTable)
          .where(
            and(
              eq(matchMovesTable.matchId, match.id),
              eq(matchMovesTable.idempotencyKey, params.idempotencyKey),
            ),
          )
          .limit(1);
        if (dup) {
          const dupState = buildMatchState(match, players, privates);
          const wSeat = dupState.winner === null ? null : dupState.winner === "A" ? 0 : 1;
          const wId =
            wSeat === null
              ? null
              : players.find((p) => p.seat === wSeat)?.playerId ?? null;
          const res: ShotApplyResult = {
            idempotent: true,
            result: dup.isHit ? (dup.sunkShip ? "sunk" : "hit") : "miss",
            sunkShip: dup.sunkShip,
            moveNumber: dup.moveNumber,
            winnerId: wId,
            winnerSeat: wSeat,
            view: publicViewForSeat(dupState, shooter.seat),
            nextSeat: dupState.turn === seatToPlayerId(0) ? 0 : 1,
          };
          return { result: res, emits: [] as Emit[] };
        }
        throw appError("DUPLICATE_MOVE", "This move was already applied");
      }
      throw e;
    }

    // Persist the target's updated shots_received.
    const targetId = seatToPlayerId(target.seat);
    const newTargetShots = outcome.newState.players[targetId].shotsReceived;
    await tx
      .update(privateGameStatesTable)
      .set({ shotsReceived: shotMapToArray(newTargetShots) as never })
      .where(
        and(
          eq(privateGameStatesTable.matchId, match.id),
          eq(privateGameStatesTable.seat, target.seat),
        ),
      );

    // Shooter stats.
    await tx
      .update(matchPlayersTable)
      .set({
        shotsFired: sql`${matchPlayersTable.shotsFired} + 1`,
        hits: sql`${matchPlayersTable.hits} + ${outcome.result === "miss" ? 0 : 1}`,
        shipsSunk: sql`${matchPlayersTable.shipsSunk} + ${outcome.sunkShip ? 1 : 0}`,
      })
      .where(eq(matchPlayersTable.id, shooter.id));

    const nextSeat = outcome.winnerSeat === null ? target.seat : shooter.seat;
    const nextTurnPlayerId =
      outcome.winnerSeat === null ? target.playerId : shooter.playerId;

    await tx
      .update(matchesTable)
      .set({
        currentTurnPlayerId: nextTurnPlayerId,
        currentTurnSeat: nextSeat,
        turnNumber: match.turnNumber + 1,
      })
      .where(eq(matchesTable.id, match.id));

    let deadline: Date | null = null;
    if (outcome.winnerSeat === null) {
      deadline = await touchTurnClockTx(tx, match, shooter.seat, target.seat);
    }

    await tx.insert(matchEventsTable).values({
      matchId: match.id,
      actorId: shooter.playerId,
      eventType: "shot_fired",
      payload: {
        x: params.x,
        y: params.y,
        result: outcome.result,
        sunk_ship: outcome.sunkShip ?? null,
        move_number: outcome.moveIndex,
      },
    });

    const emits: Emit[] = [
      {
        kind: "move",
        matchId: match.id,
        payload: {
          playerId: shooter.playerId,
          moveNumber: outcome.moveIndex,
          x: params.x,
          y: params.y,
          isHit: outcome.result !== "miss",
          result: outcome.result,
          sunkShip: outcome.sunkShip ?? null,
        },
      },
      {
        kind: "update",
        matchId: match.id,
        payload: {
          turnNumber: match.turnNumber + 1,
          currentTurnSeat: nextSeat,
          currentTurnPlayerId: nextTurnPlayerId,
          turnDeadline: deadline,
        },
      },
    ];

    // Finalise in the SAME transaction when the shot wins.
    let winnerId: string | null = null;
    if (outcome.winnerSeat !== null) {
      winnerId = players.find((p) => p.seat === outcome.winnerSeat)?.playerId ?? null;
      const fin = await finalizeMatchTx(tx, match, players, winnerId, false);
      emits.push(...fin.emits);
    }

    const res: ShotApplyResult = {
      idempotent: false,
      result: outcome.result,
      sunkShip: outcome.sunkShip ?? null,
      moveNumber: outcome.moveIndex,
      winnerId,
      winnerSeat: outcome.winnerSeat,
      view: publicViewForSeat(outcome.newState, shooter.seat),
      nextSeat,
    };
    return { result: res, emits };
  });

  flushEmits(emits);
  return result;
}

// ---------------------------------------------------------------------------
// resolveTimeout — atomic timeout resolution (locks match, re-checks deadline).
// ---------------------------------------------------------------------------
export interface TimeoutOutcome {
  timedOut: boolean;
  winnerId: string | null;
}

export async function resolveTimeout(matchId: string): Promise<TimeoutOutcome> {
  const { outcome, emits } = await db.transaction(async (tx) => {
    const { match, players } = await lockMatch(tx, matchId);
    if (match.status !== "active") {
      throw appError("WRONG_MATCH_STATE", `Match is '${match.status}', not active`);
    }
    if (!match.turnDeadline) throw appError("NOT_TIMED_OUT", "No active turn deadline");
    if (Date.now() < match.turnDeadline.getTime()) {
      throw appError("NOT_TIMED_OUT", "The current turn has not expired yet");
    }

    const onClock =
      (match.currentTurnSeat === 0 || match.currentTurnSeat === 1
        ? players.find((p) => p.seat === match.currentTurnSeat)
        : undefined) ??
      players.find((p) => p.playerId === match.currentTurnPlayerId);
    const winner = players.find((p) => p.seat !== onClock?.seat);
    const winnerId = winner?.playerId ?? null;

    if (onClock) {
      await tx
        .update(matchPlayersTable)
        .set({ forfeited: true })
        .where(eq(matchPlayersTable.id, onClock.id));
    }
    const fin = await finalizeMatchTx(tx, match, players, winnerId, false);
    return {
      outcome: { timedOut: true, winnerId } as TimeoutOutcome,
      emits: fin.emits,
    };
  });
  flushEmits(emits);
  return outcome;
}

// ---------------------------------------------------------------------------
// resolveResign — atomic resignation (locks match, flips forfeit, finalises).
// ---------------------------------------------------------------------------
export interface ResignOutcome {
  winnerId: string | null;
  abandoned: boolean;
}

export async function resolveResign(
  matchId: string,
  userId: string,
): Promise<ResignOutcome> {
  const { outcome, emits } = await db.transaction(async (tx) => {
    const { match, players } = await lockMatch(tx, matchId);
    const me = players.find((p) => p.playerId === userId);
    if (!me) throw appError("NOT_A_PARTICIPANT");
    if (!["placing", "active", "pending"].includes(match.status)) {
      throw appError("WRONG_MATCH_STATE", `Cannot resign a '${match.status}' match`);
    }
    const opponent = players.find((p) => p.seat !== me.seat);
    const winnerId = opponent?.playerId ?? null;
    const abandoned = match.status !== "active";

    await tx
      .update(matchPlayersTable)
      .set({ forfeited: true })
      .where(eq(matchPlayersTable.id, me.id));
    await tx.insert(matchEventsTable).values({
      matchId: match.id,
      actorId: userId,
      eventType: "resigned",
      payload: { seat: me.seat },
    });

    const fin = await finalizeMatchTx(tx, match, players, winnerId, abandoned);
    const emits: Emit[] = [
      { kind: "event", matchId: match.id, payload: { eventType: "resigned", actorId: userId, payload: { seat: me.seat } } },
      ...fin.emits,
    ];
    return { outcome: { winnerId, abandoned } as ResignOutcome, emits };
  });
  flushEmits(emits);
  return outcome;
}
