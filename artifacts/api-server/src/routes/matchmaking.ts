/**
 * Matchmaking: atomic join (ports matchmaking_find_or_queue) + leave.
 *
 * Join uses a transaction with SELECT ... FOR UPDATE SKIP LOCKED over
 * matchmaking_queue to pair by mode/board/rating window without double-matching.
 */
import { Router, type IRouter } from "express";
import { and, eq, ne, or, sql } from "drizzle-orm";
import {
  db,
  matchmakingQueueTable,
  matchesTable,
  matchPlayersTable,
  matchEventsTable,
  ratingsTable,
  blocksTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody } from "../lib/http";
import {
  joinMatchmakingSchema,
  leaveMatchmakingSchema,
  TEMPO_TURN_SECONDS,
} from "../lib/schemas";
import { emitMatchmakingMatched } from "../realtime/emitter";
import { notifyTurn } from "../game/notify";

const router: IRouter = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// POST /api/matchmaking/join
// ---------------------------------------------------------------------------
router.post(
  "/join",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const body = parseBody(joinMatchmakingSchema, req.body);

    const [ratingRow] = await db
      .select({ rating: ratingsTable.rating })
      .from(ratingsTable)
      .where(and(eq(ratingsTable.playerId, userId), eq(ratingsTable.mode, body.mode)))
      .limit(1);
    const playerRating = ratingRow?.rating ?? 1200;

    const matchId = await db.transaction(async (tx) => {
      // Upsert the caller into the queue (idempotent while searching).
      const [self] = await tx
        .insert(matchmakingQueueTable)
        .values({
          playerId: userId,
          mode: body.mode,
          tempo: body.tempo,
          rating: playerRating,
          region: body.region ?? null,
          boardSize: body.boardSize,
          status: "searching",
        })
        .onConflictDoUpdate({
          target: [matchmakingQueueTable.playerId, matchmakingQueueTable.mode],
          targetWhere: sql`${matchmakingQueueTable.status} = 'searching'`,
          set: {
            tempo: body.tempo,
            rating: playerRating,
            region: body.region ?? null,
            boardSize: body.boardSize,
          },
        })
        .returning();

      const waited = (Date.now() - self.enqueuedAt.getTime()) / 1000;
      let window = 50 + Math.floor(waited / 5.0) * 25;
      window = Math.min(window, 1000);

      // Find a lockable opponent.
      const [opponent] = await tx
        .select()
        .from(matchmakingQueueTable)
        .where(
          and(
            eq(matchmakingQueueTable.status, "searching"),
            eq(matchmakingQueueTable.mode, body.mode),
            eq(matchmakingQueueTable.tempo, body.tempo),
            eq(matchmakingQueueTable.boardSize, body.boardSize),
            ne(matchmakingQueueTable.playerId, userId),
            body.region
              ? or(
                  sql`${matchmakingQueueTable.region} is null`,
                  eq(matchmakingQueueTable.region, body.region),
                )
              : undefined,
            sql`abs(${matchmakingQueueTable.rating} - ${playerRating}) <= ${window}`,
            sql`${matchmakingQueueTable.expiresAt} > now()`,
            sql`not exists (select 1 from ${blocksTable} bl where (bl.blocker_id = ${userId} and bl.blocked_id = ${matchmakingQueueTable.playerId}) or (bl.blocker_id = ${matchmakingQueueTable.playerId} and bl.blocked_id = ${userId}))`,
          ),
        )
        .orderBy(
          sql`abs(${matchmakingQueueTable.rating} - ${playerRating}) asc`,
          matchmakingQueueTable.enqueuedAt,
        )
        .for("update", { skipLocked: true })
        .limit(1);

      if (!opponent) return null;

      // Re-lock own row to avoid double-matching.
      const locked = await tx
        .select({ id: matchmakingQueueTable.id })
        .from(matchmakingQueueTable)
        .where(
          and(
            eq(matchmakingQueueTable.id, self.id),
            eq(matchmakingQueueTable.status, "searching"),
          ),
        )
        .for("update", { skipLocked: true })
        .limit(1);
      if (locked.length === 0) return null;

      // Create the match + seats.
      const turnSeconds = TEMPO_TURN_SECONDS[body.tempo];
      const [match] = await tx
        .insert(matchesTable)
        .values({
          mode: body.mode,
          tempo: body.tempo,
          status: "placing",
          boardSize: body.boardSize,
          turnSeconds,
          isRated: body.mode === "ranked",
        })
        .returning();

      // Daily matches do not track a per-player total clock (timeLeftMs null);
      // only the 24h per-turn deadline applies.
      const timeLeftMs = body.tempo === "daily" ? null : match.turnSeconds * 1000;
      await tx.insert(matchPlayersTable).values([
        {
          matchId: match.id,
          playerId: userId,
          seat: 0,
          ratingBefore: playerRating,
          timeLeftMs,
        },
        {
          matchId: match.id,
          playerId: opponent.playerId,
          seat: 1,
          ratingBefore: opponent.rating,
          timeLeftMs,
        },
      ]);

      await tx
        .update(matchmakingQueueTable)
        .set({ status: "matched", matchedMatchId: match.id })
        .where(
          or(
            eq(matchmakingQueueTable.id, self.id),
            eq(matchmakingQueueTable.id, opponent.id),
          ),
        );

      await tx.insert(matchEventsTable).values({
        matchId: match.id,
        eventType: "match_created",
        payload: { mode: body.mode, source: "matchmaking" },
      });

      return { matchId: match.id, opponentId: opponent.playerId, tempo: body.tempo };
    });

    if (matchId) {
      // Notify both players via their user rooms.
      emitMatchmakingMatched(userId, matchId.matchId);
      emitMatchmakingMatched(matchId.opponentId, matchId.matchId);
      // Daily matches: push both players that a match was found so they place
      // their fleet. The per-turn push follows once the game activates.
      if (matchId.tempo === "daily") {
        void notifyTurn({
          matchId: matchId.matchId,
          tempo: "daily",
          toUserId: userId,
          opponentId: matchId.opponentId,
        });
        void notifyTurn({
          matchId: matchId.matchId,
          tempo: "daily",
          toUserId: matchId.opponentId,
          opponentId: userId,
        });
      }
      res.json({ matched: true, matchId: matchId.matchId, status: "matched" });
      return;
    }
    res.json({ matched: false, matchId: null, status: "searching" });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/matchmaking/leave
// ---------------------------------------------------------------------------
router.post(
  "/leave",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const body = parseBody(leaveMatchmakingSchema, req.body);
    const cancelled = await db
      .update(matchmakingQueueTable)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(matchmakingQueueTable.playerId, userId),
          eq(matchmakingQueueTable.mode, body.mode),
          eq(matchmakingQueueTable.status, "searching"),
        ),
      )
      .returning({ id: matchmakingQueueTable.id });
    res.json({ cancelled: cancelled.length > 0 });
  }),
);

export default router;
