/** Match history + replay (public post-finish data only). */
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  matchesTable,
  matchPlayersTable,
  matchMovesTable,
  profilesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import { uuidSchema } from "../lib/schemas";
import { publicProfileColumns } from "../lib/sanitizeProfile";
import { z } from "zod";

const router: IRouter = Router();
router.use(requireAuth);

/** GET /api/history — the caller's finished matches, newest first. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const mine = await db
      .select({ matchId: matchPlayersTable.matchId })
      .from(matchPlayersTable)
      .where(eq(matchPlayersTable.playerId, uid));
    const matchIds = Array.from(new Set(mine.map((r) => r.matchId)));
    if (matchIds.length === 0) {
      res.json({ matches: [] });
      return;
    }
    const matches = await db
      .select()
      .from(matchesTable)
      .where(
        and(
          inArray(matchesTable.id, matchIds),
          inArray(matchesTable.status, ["finished", "abandoned"]),
        ),
      )
      .orderBy(desc(matchesTable.finishedAt));
    const finishedIds = matches.map((m) => m.id);
    if (finishedIds.length === 0) {
      res.json({ matches: [] });
      return;
    }
    const players = await db
      .select()
      .from(matchPlayersTable)
      .where(inArray(matchPlayersTable.matchId, finishedIds));
    const oppIds = Array.from(
      new Set(
        players
          .map((p) => p.playerId)
          .filter((id): id is string => !!id && id !== uid),
      ),
    );
    const profiles = oppIds.length
      ? await db
          .select(publicProfileColumns)
          .from(profilesTable)
          .where(inArray(profilesTable.id, oppIds))
      : [];
    const profMap = new Map(profiles.map((p) => [p.id, p]));
    const byMatch = new Map<string, typeof players>();
    for (const p of players) {
      const list = byMatch.get(p.matchId) ?? [];
      list.push(p);
      byMatch.set(p.matchId, list);
    }
    const out = matches.map((m) => {
      const list = byMatch.get(m.id) ?? [];
      const me = list.find((p) => p.playerId === uid) ?? list[0];
      const opponent = list.find((p) => p.seat !== me?.seat) ?? null;
      return {
        ...m,
        me,
        opponent,
        opponentProfile: opponent?.playerId
          ? profMap.get(opponent.playerId) ?? null
          : null,
      };
    });
    res.json({ matches: out });
  }),
);

/** GET /api/history/:matchId — full detail + move log for replay. */
router.get(
  "/:matchId",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { matchId } = parseBody(z.object({ matchId: uuidSchema }), req.params);
    const [match] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, matchId))
      .limit(1);
    if (!match) throw appError("MATCH_NOT_FOUND");
    const players = await db
      .select()
      .from(matchPlayersTable)
      .where(eq(matchPlayersTable.matchId, matchId));
    if (!players.some((p) => p.playerId === uid)) {
      // Only participants (or finished/public) may view; keep it simple.
      if (!["finished", "abandoned"].includes(match.status)) {
        throw appError("NOT_A_PARTICIPANT");
      }
    }
    const moves = await db
      .select()
      .from(matchMovesTable)
      .where(eq(matchMovesTable.matchId, matchId))
      .orderBy(matchMovesTable.moveNumber);
    const oppIds = Array.from(
      new Set(players.map((p) => p.playerId).filter((id): id is string => !!id)),
    );
    const profiles = oppIds.length
      ? await db
          .select(publicProfileColumns)
          .from(profilesTable)
          .where(inArray(profilesTable.id, oppIds))
      : [];
    res.json({ match, players, moves, profiles });
  }),
);

export default router;
