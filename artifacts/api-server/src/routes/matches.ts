/** Match lifecycle: create private/bot, join, submit fleet, fire, reconnect,
 *  resign, timeout, finalize. Server-authoritative. */
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db,
  matchesTable,
  matchPlayersTable,
  matchEventsTable,
  privateGameStatesTable,
  profilesTable,
  ratingsTable,
} from "@workspace/db";
import { allSunk, type Fleet } from "@workspace/game-engine";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import {
  createPrivateMatchSchema,
  joinPrivateMatchSchema,
  createBotMatchSchema,
  submitFleetSchema,
  fireShotSchema,
  uuidSchema,
  TEMPO_TURN_SECONDS,
} from "../lib/schemas";
import {
  loadMatch,
  loadPrivateStates,
  applyShot,
  finalizeMatch,
  recordEvent,
  resolveResign,
  resolveTimeout,
} from "../game/service";
import {
  buildMatchState,
  requireParticipant,
  assertValidFleet,
  publicViewForSeat,
  seatToPlayerId,
} from "../game/helpers";
import { ensureBotFleet, scheduleBotMove } from "../game/bot";
import { genInviteCode } from "../game/invite";
import { notifyTurn } from "../game/notify";
import { emitMatchUpdate } from "../realtime/emitter";
import { z } from "zod";

const router: IRouter = Router();
router.use(requireAuth);

const matchIdParam = z.object({ matchId: uuidSchema });

async function ratingFor(playerId: string, mode: string): Promise<number> {
  const [r] = await db
    .select({ rating: ratingsTable.rating })
    .from(ratingsTable)
    .where(and(eq(ratingsTable.playerId, playerId), eq(ratingsTable.mode, mode as never)))
    .limit(1);
  return r?.rating ?? 1200;
}

// ---------------------------------------------------------------------------
// POST /api/matches/private — create a private match with a share code.
// ---------------------------------------------------------------------------
router.post(
  "/private",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const body = parseBody(createPrivateMatchSchema, req.body);
    const turnSeconds = body.turnSeconds ?? TEMPO_TURN_SECONDS[body.tempo];

    let code = "";
    let match:
      | typeof matchesTable.$inferSelect
      | undefined;
    for (let attempt = 0; attempt < 25 && !match; attempt++) {
      code = genInviteCode(6);
      const dup = await db
        .select({ id: matchesTable.id })
        .from(matchesTable)
        .where(
          and(
            eq(matchesTable.inviteCode, code),
            inArray(matchesTable.status, ["pending", "placing"]),
          ),
        )
        .limit(1);
      if (dup.length > 0) continue;
      [match] = await db
        .insert(matchesTable)
        .values({
          mode: body.mode,
          tempo: body.tempo,
          status: "pending",
          boardSize: body.boardSize,
          isRated: body.isRated,
          isPrivate: true,
          turnSeconds,
          inviteCode: code,
        })
        .returning();
    }
    if (!match) throw appError("INTERNAL", "could not allocate an invite code");

    await db.insert(matchPlayersTable).values({
      matchId: match.id,
      playerId: userId,
      seat: 0,
      ratingBefore: await ratingFor(userId, body.mode),
      timeLeftMs: body.tempo === "daily" ? null : turnSeconds * 1000,
    });
    await recordEvent(match.id, "match_created", userId, {
      source: "private",
      code,
      tempo: body.tempo,
    });

    res.json({
      matchId: match.id,
      code,
      tempo: body.tempo,
      deepLink: `navixa://join/${code}`,
      universalLink: `https://navixa.app/join/${code}`,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/matches/private/join — join by invite code.
// ---------------------------------------------------------------------------
router.post(
  "/private/join",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const body = parseBody(joinPrivateMatchSchema, req.body);
    const code = body.code.toUpperCase();

    const out = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matchesTable)
        .where(
          and(
            eq(matchesTable.inviteCode, code),
            eq(matchesTable.isPrivate, true),
            inArray(matchesTable.status, ["pending", "placing"]),
          ),
        )
        .for("update")
        .limit(1);
      if (!match) throw appError("INVITE_NOT_FOUND");

      const players = await tx
        .select()
        .from(matchPlayersTable)
        .where(eq(matchPlayersTable.matchId, match.id));
      if (players.some((p) => p.playerId === userId)) {
        return { id: match.id, status: match.status };
      }
      if (players.length >= 2) throw appError("MATCH_FULL");

      await tx.insert(matchPlayersTable).values({
        matchId: match.id,
        playerId: userId,
        seat: 1,
        ratingBefore: await ratingFor(userId, match.mode),
        timeLeftMs: match.tempo === "daily" ? null : match.turnSeconds * 1000,
      });
      const [updated] = await tx
        .update(matchesTable)
        .set({ status: "placing" })
        .where(eq(matchesTable.id, match.id))
        .returning();
      await tx.insert(matchEventsTable).values({
        matchId: match.id,
        actorId: userId,
        eventType: "player_joined",
        payload: { seat: 1, source: "private" },
      });
      return { id: match.id, status: updated?.status ?? "placing" };
    });

    emitMatchUpdate(out.id, { status: out.status });
    res.json({ matchId: out.id, status: out.status });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/matches/bot — create a training match vs a server bot.
// ---------------------------------------------------------------------------
router.post(
  "/bot",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const body = parseBody(createBotMatchSchema, req.body);

    const [match] = await db
      .insert(matchesTable)
      .values({
        mode: "bot",
        tempo: "blitz",
        status: "placing",
        boardSize: body.boardSize,
        isRated: false,
        isPrivate: true,
        turnSeconds: body.turnSeconds,
      })
      .returning();

    await db.insert(matchPlayersTable).values([
      {
        matchId: match.id,
        playerId: userId,
        seat: 0,
        isBot: false,
        timeLeftMs: body.turnSeconds * 1000,
      },
      {
        matchId: match.id,
        playerId: null,
        seat: 1,
        isBot: true,
        botDifficulty: body.difficulty,
        isReady: true,
        timeLeftMs: body.turnSeconds * 1000,
      },
    ]);
    await recordEvent(match.id, "match_created", userId, {
      source: "bot",
      difficulty: body.difficulty,
    });

    res.json({ matchId: match.id, status: match.status });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/matches/submit-fleet
// ---------------------------------------------------------------------------
router.post(
  "/submit-fleet",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const body = parseBody(submitFleetSchema, req.body);

    const { match, players } = await loadMatch(body.matchId);
    const me = requireParticipant(players, userId);
    if (match.status !== "placing") {
      throw appError("WRONG_MATCH_STATE", `Cannot submit fleet while '${match.status}'`);
    }

    const existing = await loadPrivateStates(match.id);
    if (existing.some((s) => s.playerId === userId)) {
      throw appError("FLEET_ALREADY_SUBMITTED");
    }

    assertValidFleet(body.fleet as Fleet, match);

    try {
      await db.insert(privateGameStatesTable).values({
        matchId: match.id,
        playerId: userId,
        seat: me.seat,
        isBot: false,
        board: body.fleet as never,
        shotsReceived: [],
        boardHash: body.boardHash ?? null,
        salt: body.salt ?? null,
        fleetSubmitted: true,
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        throw appError("FLEET_ALREADY_SUBMITTED");
      }
      throw e;
    }

    await db
      .update(matchPlayersTable)
      .set({ isReady: true })
      .where(eq(matchPlayersTable.id, me.id));
    await recordEvent(match.id, "fleet_submitted", userId, { seat: me.seat });

    const botSeat = players.find((p) => p.isBot);
    if (botSeat && !existing.some((s) => s.seat === botSeat.seat)) {
      await ensureBotFleet(match, botSeat.seat);
    }

    const submittedCount = existing.length + 1 + (botSeat ? 1 : 0);
    let activated = false;
    if (submittedCount >= 2) {
      const firstSeat = players.find((p) => p.seat === 0);
      const deadline = new Date(Date.now() + match.turnSeconds * 1000);
      const upd = await db
        .update(matchesTable)
        .set({
          status: "active",
          startedAt: new Date(),
          currentTurnPlayerId: firstSeat?.playerId ?? null,
          currentTurnSeat: 0,
          turnDeadline: deadline,
        })
        .where(and(eq(matchesTable.id, match.id), eq(matchesTable.status, "placing")))
        .returning();
      if (upd.length > 0) {
        activated = true;
        await recordEvent(match.id, "match_started", null, {});
        emitMatchUpdate(match.id, {
          status: "active",
          currentTurnSeat: 0,
          currentTurnPlayerId: firstSeat?.playerId ?? null,
          turnDeadline: deadline,
        });
        // Daily matches: push the first mover (seat 0) that it is their turn.
        if (match.tempo === "daily") {
          const secondSeat = players.find((p) => p.seat !== 0);
          void notifyTurn({
            matchId: match.id,
            tempo: match.tempo,
            toUserId: firstSeat?.playerId ?? null,
            opponentId: secondSeat?.playerId ?? null,
          });
        }
      }
    }

    res.json({ ok: true, ready: true, matchStarted: activated });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/matches/active — the caller's ongoing matches (setup + active).
// No secret board data. Sorted: your-turn first, then by soonest deadline.
// ---------------------------------------------------------------------------
router.get(
  "/active",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;

    // Matches the caller participates in that are still in play.
    const rows = await db
      .select({
        match: matchesTable,
        seat: matchPlayersTable.seat,
      })
      .from(matchPlayersTable)
      .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
      .where(
        and(
          eq(matchPlayersTable.playerId, userId),
          isNull(matchesTable.deletedAt),
          inArray(matchesTable.status, ["pending", "placing", "active"]),
        ),
      )
      .orderBy(desc(matchesTable.updatedAt));

    if (rows.length === 0) {
      res.json({ matches: [] });
      return;
    }

    const matchIds = rows.map((r) => r.match.id);
    // All opponents (seat rows that are not the caller).
    const opponentRows = await db
      .select({
        matchId: matchPlayersTable.matchId,
        playerId: matchPlayersTable.playerId,
        isBot: matchPlayersTable.isBot,
      })
      .from(matchPlayersTable)
      .where(
        and(
          inArray(matchPlayersTable.matchId, matchIds),
          or(
            sql`${matchPlayersTable.playerId} <> ${userId}`,
            isNull(matchPlayersTable.playerId),
          ),
        ),
      );
    const opponentIds = [
      ...new Set(opponentRows.map((o) => o.playerId).filter((id): id is string => !!id)),
    ];
    const oppProfiles = opponentIds.length
      ? await db
          .select({
            id: profilesTable.id,
            username: profilesTable.username,
            avatarUrl: profilesTable.avatarUrl,
          })
          .from(profilesTable)
          .where(inArray(profilesTable.id, opponentIds))
      : [];
    const oppRatings = opponentIds.length
      ? await db
          .select({ playerId: ratingsTable.playerId, rating: ratingsTable.rating })
          .from(ratingsTable)
          .where(
            and(
              inArray(ratingsTable.playerId, opponentIds),
              eq(ratingsTable.mode, "ranked"),
            ),
          )
      : [];
    const profMap = new Map(oppProfiles.map((p) => [p.id, p]));
    const ratingMap = new Map(oppRatings.map((r) => [r.playerId, r.rating]));
    const oppByMatch = new Map<string, (typeof opponentRows)[number]>();
    for (const o of opponentRows) if (!oppByMatch.has(o.matchId)) oppByMatch.set(o.matchId, o);

    const matches = rows.map(({ match, seat }) => {
      const opp = oppByMatch.get(match.id);
      const prof = opp?.playerId ? profMap.get(opp.playerId) : undefined;
      const yourTurn =
        match.status === "active" &&
        (match.currentTurnPlayerId === userId || match.currentTurnSeat === seat);
      return {
        matchId: match.id,
        tempo: match.tempo,
        mode: match.mode,
        status: match.status,
        boardSize: match.boardSize,
        turnSeconds: match.turnSeconds,
        seat,
        yourTurn,
        turnDeadline: match.turnDeadline,
        updatedAt: match.updatedAt,
        opponent: opp
          ? {
              id: opp.playerId,
              isBot: opp.isBot,
              username: prof?.username ?? (opp.isBot ? "Bot" : null),
              avatarUrl: prof?.avatarUrl ?? null,
              rating: opp.playerId ? ratingMap.get(opp.playerId) ?? null : null,
            }
          : null,
      };
    });

    // Your-turn first, then soonest deadline, then most recently updated.
    matches.sort((a, b) => {
      if (a.yourTurn !== b.yourTurn) return a.yourTurn ? -1 : 1;
      const ad = a.turnDeadline ? a.turnDeadline.getTime() : Infinity;
      const bd = b.turnDeadline ? b.turnDeadline.getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    res.json({ matches });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/matches/fire — atomic, race-safe (see game/service.ts::applyShot).
// ---------------------------------------------------------------------------
router.post(
  "/fire",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const body = parseBody(fireShotSchema, req.body);

    // Participant check up-front (cheap, read-only) for a clean 403.
    const { players } = await loadMatch(body.matchId);
    const me = requireParticipant(players, userId);
    const opponent = players.find((p) => p.seat !== me.seat);

    const outcome = await applyShot({
      matchId: body.matchId,
      shooterUserId: userId,
      x: body.x,
      y: body.y,
      idempotencyKey: body.idempotencyKey,
    });

    // Bot only moves when the game is still ongoing and it is now the bot's turn.
    const botToMove =
      (opponent?.isBot ?? false) &&
      outcome.winnerSeat === null &&
      outcome.nextSeat !== me.seat;
    if (botToMove) scheduleBotMove(body.matchId);

    res.json({
      idempotent: outcome.idempotent,
      result: outcome.result,
      sunkShip: outcome.sunkShip,
      moveNumber: outcome.moveNumber,
      winner: outcome.winnerSeat === null ? null : seatToPlayerId(outcome.winnerSeat),
      winnerId: outcome.winnerId,
      view: outcome.view,
      botToMove,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/matches/:matchId/reconnect
// ---------------------------------------------------------------------------
router.get(
  "/:matchId/reconnect",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const { matchId } = parseBody(matchIdParam, req.params);
    const { match, players } = await loadMatch(matchId);
    const me = requireParticipant(players, userId);

    await db
      .update(matchPlayersTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(matchPlayersTable.id, me.id));

    const playerSummaries = players.map((p) => ({
      seat: p.seat,
      playerId: p.playerId,
      isBot: p.isBot,
      isReady: p.isReady,
      timeLeftMs: p.timeLeftMs,
    }));

    // Non-active matches: keep a stable shape — `view` and `clock` are present
    // but null so the client can rely on the keys existing.
    if (match.status !== "active") {
      res.json({
        matchId: match.id,
        status: match.status,
        mode: match.mode,
        boardSize: match.boardSize,
        turnSeconds: match.turnSeconds,
        seat: me.seat,
        yourTurn: false,
        winnerId: match.winnerId,
        players: playerSummaries,
        clock: null,
        view: null,
      });
      return;
    }

    const privates = await loadPrivateStates(match.id);
    const state = buildMatchState(match, players, privates);
    const now = Date.now();
    const deadlineMs = match.turnDeadline ? match.turnDeadline.getTime() : null;
    res.json({
      matchId: match.id,
      status: match.status,
      mode: match.mode,
      boardSize: match.boardSize,
      turnSeconds: match.turnSeconds,
      seat: me.seat,
      yourTurn: state.turn === seatToPlayerId(me.seat),
      winnerId: match.winnerId,
      players: playerSummaries,
      clock: {
        turnDeadline: match.turnDeadline,
        currentTurnRemainingMs: deadlineMs ? Math.max(0, deadlineMs - now) : null,
        players: players.map((p) => ({ seat: p.seat, timeLeftMs: p.timeLeftMs })),
      },
      view: publicViewForSeat(state, me.seat),
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/matches/:matchId/resign
// ---------------------------------------------------------------------------
router.post(
  "/:matchId/resign",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const { matchId } = parseBody(matchIdParam, req.params);
    const out = await resolveResign(matchId, userId);
    res.json({ ok: true, winnerId: out.winnerId, abandoned: out.abandoned });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/matches/:matchId/timeout
// ---------------------------------------------------------------------------
router.post(
  "/:matchId/timeout",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const { matchId } = parseBody(matchIdParam, req.params);
    const { players } = await loadMatch(matchId);
    requireParticipant(players, userId);
    const out = await resolveTimeout(matchId);
    res.json({ ok: true, timedOut: out.timedOut, winnerId: out.winnerId });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/matches/:matchId/finalize — recompute + finalise when fully sunk.
// ---------------------------------------------------------------------------
router.post(
  "/:matchId/finalize",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const { matchId } = parseBody(matchIdParam, req.params);
    const { match, players } = await loadMatch(matchId);
    requireParticipant(players, userId);

    if (["finished", "abandoned", "cancelled"].includes(match.status)) {
      res.json({ ok: true, alreadyFinal: true, winnerId: match.winnerId });
      return;
    }
    if (match.status !== "active") {
      throw appError("WRONG_MATCH_STATE", `Cannot finalise a '${match.status}' match`);
    }

    const privates = await loadPrivateStates(match.id);
    const state = buildMatchState(match, players, privates);
    let winnerSeat: number | null = null;
    for (const p of players) {
      const opp = players.find((o) => o.seat !== p.seat);
      if (!opp) continue;
      const oppId = seatToPlayerId(opp.seat);
      if (allSunk(state.players[oppId].fleet, state.players[oppId].shotsReceived)) {
        winnerSeat = p.seat;
        break;
      }
    }
    if (winnerSeat === null) {
      throw appError("WRONG_MATCH_STATE", "No fleet is fully sunk yet");
    }
    const winnerId = players.find((p) => p.seat === winnerSeat)?.playerId ?? null;
    await finalizeMatch(match.id, winnerId, false);
    res.json({ ok: true, alreadyFinal: false, winnerId });
  }),
);

export default router;
