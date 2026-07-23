/** Tournaments: browse, detail (bracket), register. */
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  tournamentsTable,
  tournamentEntriesTable,
  tournamentRoundsTable,
  tournamentMatchesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import { tournamentIdParamSchema } from "../lib/schemas";

const router: IRouter = Router();
router.use(requireAuth);

/** GET /api/tournaments — visible tournaments (newest first). */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const tournaments = await db
      .select()
      .from(tournamentsTable)
      .where(isNull(tournamentsTable.deletedAt))
      .orderBy(desc(tournamentsTable.createdAt))
      .limit(50);
    res.json({ tournaments });
  }),
);

/** GET /api/tournaments/:id — full detail with entries + bracket. */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = parseBody(tournamentIdParamSchema, req.params);
    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, id))
      .limit(1);
    if (!tournament) throw appError("NOT_FOUND", "Tournament not found");
    const [entries, rounds, matches] = await Promise.all([
      db
        .select()
        .from(tournamentEntriesTable)
        .where(eq(tournamentEntriesTable.tournamentId, id)),
      db
        .select()
        .from(tournamentRoundsTable)
        .where(eq(tournamentRoundsTable.tournamentId, id))
        .orderBy(tournamentRoundsTable.roundNumber),
      db
        .select()
        .from(tournamentMatchesTable)
        .where(eq(tournamentMatchesTable.tournamentId, id))
        .orderBy(tournamentMatchesTable.bracketPosition),
    ]);
    res.json({ tournament, entries, rounds, matches });
  }),
);

/** POST /api/tournaments/:id/register — register the caller. */
router.post(
  "/:id/register",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { id } = parseBody(tournamentIdParamSchema, req.params);
    const entry = await db.transaction(async (tx) => {
      const [t] = await tx
        .select()
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, id))
        .for("update")
        .limit(1);
      if (!t) throw appError("NOT_FOUND", "Tournament not found");
      if (!["draft", "registration", "upcoming"].includes(t.status)) {
        throw appError("CONFLICT", "Registration is closed");
      }
      const existing = await tx
        .select({ id: tournamentEntriesTable.id })
        .from(tournamentEntriesTable)
        .where(
          and(
            eq(tournamentEntriesTable.tournamentId, id),
            eq(tournamentEntriesTable.playerId, uid),
          ),
        )
        .limit(1);
      if (existing.length > 0) return { alreadyRegistered: true };
      const count = await tx
        .select({ id: tournamentEntriesTable.id })
        .from(tournamentEntriesTable)
        .where(eq(tournamentEntriesTable.tournamentId, id));
      if (count.length >= t.maxPlayers) throw appError("CONFLICT", "Tournament is full");
      await tx
        .insert(tournamentEntriesTable)
        .values({ tournamentId: id, playerId: uid });
      return { alreadyRegistered: false };
    });
    res.json({ ok: true, ...entry });
  }),
);

export default router;
