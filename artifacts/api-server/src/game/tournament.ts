/** Tournament bracket generation + winner advancement (ports SQL fns). */
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  tournamentsTable,
  tournamentEntriesTable,
  tournamentRoundsTable,
  tournamentMatchesTable,
  ratingsTable,
} from "@workspace/db";
import { appError } from "../lib/errors";

/** Build a seeded single-elimination bracket. Idempotent. Returns round count. */
export async function createTournamentBracket(tournamentId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .for("update")
      .limit(1);
    if (!t) throw appError("NOT_FOUND", "Tournament not found");

    const existingRounds = await tx
      .select({ id: tournamentRoundsTable.id })
      .from(tournamentRoundsTable)
      .where(eq(tournamentRoundsTable.tournamentId, tournamentId))
      .limit(1);
    if (existingRounds.length > 0) return 0;

    const entries = await tx
      .select({
        playerId: tournamentEntriesTable.playerId,
        registeredAt: tournamentEntriesTable.registeredAt,
        rating: ratingsTable.rating,
      })
      .from(tournamentEntriesTable)
      .leftJoin(
        ratingsTable,
        and(
          eq(ratingsTable.playerId, tournamentEntriesTable.playerId),
          eq(ratingsTable.mode, t.mode),
        ),
      )
      .where(eq(tournamentEntriesTable.tournamentId, tournamentId));

    const players = entries
      .sort((a, b) => {
        const ra = a.rating ?? 1200;
        const rb = b.rating ?? 1200;
        if (rb !== ra) return rb - ra;
        return a.registeredAt.getTime() - b.registeredAt.getTime();
      })
      .map((e) => e.playerId);

    const n = players.length;
    if (n < 2) throw appError("CONFLICT", "Tournament needs at least 2 entries");

    let bracket = 1;
    while (bracket < n) bracket *= 2;
    const rounds = Math.ceil(Math.log(bracket) / Math.log(2));

    // Persist seeds.
    for (let pos = 0; pos < n; pos++) {
      await tx
        .update(tournamentEntriesTable)
        .set({ seed: pos + 1 })
        .where(
          and(
            eq(tournamentEntriesTable.tournamentId, tournamentId),
            eq(tournamentEntriesTable.playerId, players[pos]),
          ),
        );
    }

    // Build rounds from the final backwards to wire next_match_id.
    let prevRoundMatchIds: string[] = [];
    for (let roundNo = rounds; roundNo >= 1; roundNo--) {
      const [round] = await tx
        .insert(tournamentRoundsTable)
        .values({
          tournamentId,
          roundNumber: roundNo,
          name: `Round ${roundNo}`,
          status: "upcoming",
        })
        .returning({ id: tournamentRoundsTable.id });

      const slots = bracket / Math.pow(2, roundNo);
      const thisRoundIds: string[] = [];
      for (let pos = 1; pos <= slots; pos++) {
        const nextId =
          prevRoundMatchIds.length > 0
            ? prevRoundMatchIds[Math.ceil(pos / 2) - 1]
            : null;
        const [tm] = await tx
          .insert(tournamentMatchesTable)
          .values({
            tournamentId,
            roundId: round.id,
            bracketPosition: pos,
            status: "pending",
            nextMatchId: nextId,
            nextSlot: nextId === null ? null : pos % 2 === 1 ? 1 : 2,
          })
          .returning({ id: tournamentMatchesTable.id });
        thisRoundIds.push(tm.id);
      }
      prevRoundMatchIds = thisRoundIds;
    }

    // Seat first-round players (1 vs N, 2 vs N-1) with byes.
    const [firstRound] = await tx
      .select({ id: tournamentRoundsTable.id })
      .from(tournamentRoundsTable)
      .where(
        and(
          eq(tournamentRoundsTable.tournamentId, tournamentId),
          eq(tournamentRoundsTable.roundNumber, 1),
        ),
      )
      .limit(1);
    const firstMatches = await tx
      .select({ id: tournamentMatchesTable.id })
      .from(tournamentMatchesTable)
      .where(eq(tournamentMatchesTable.roundId, firstRound.id))
      .orderBy(tournamentMatchesTable.bracketPosition);

    let slot = 0;
    let high = 1;
    let low = bracket;
    while (high < low) {
      const p1 = high <= n ? players[high - 1] : null;
      const p2 = low <= n ? players[low - 1] : null;
      const target = firstMatches[slot];
      if (target) {
        await tx
          .update(tournamentMatchesTable)
          .set({ playerOneId: p1, playerTwoId: p2 })
          .where(eq(tournamentMatchesTable.id, target.id));
      }
      slot++;
      high++;
      low--;
    }

    await tx
      .update(tournamentsTable)
      .set({ status: "ongoing" })
      .where(eq(tournamentsTable.id, tournamentId));

    return rounds;
  });
}

/** Advance a bracket winner into the next slot. Idempotent. */
export async function advanceTournamentWinner(
  tournamentMatchId: string,
  winnerId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [tm] = await tx
      .select()
      .from(tournamentMatchesTable)
      .where(eq(tournamentMatchesTable.id, tournamentMatchId))
      .for("update")
      .limit(1);
    if (!tm) throw appError("NOT_FOUND", "Tournament match not found");
    if (tm.playerOneId !== winnerId && tm.playerTwoId !== winnerId) {
      throw appError("INVALID_PAYLOAD", "Winner is not a participant of this slot");
    }

    await tx
      .update(tournamentMatchesTable)
      .set({ winnerId, status: "finished" })
      .where(eq(tournamentMatchesTable.id, tournamentMatchId));

    await tx
      .update(tournamentEntriesTable)
      .set({ wins: sql`${tournamentEntriesTable.wins} + 1` })
      .where(
        and(
          eq(tournamentEntriesTable.tournamentId, tm.tournamentId),
          eq(tournamentEntriesTable.playerId, winnerId),
        ),
      );

    const losers = [tm.playerOneId, tm.playerTwoId].filter(
      (id): id is string => !!id && id !== winnerId,
    );
    if (losers.length > 0) {
      await tx
        .update(tournamentEntriesTable)
        .set({
          losses: sql`${tournamentEntriesTable.losses} + 1`,
          eliminated: true,
        })
        .where(
          and(
            eq(tournamentEntriesTable.tournamentId, tm.tournamentId),
            inArray(tournamentEntriesTable.playerId, losers),
          ),
        );
    }

    if (tm.nextMatchId) {
      if (tm.nextSlot === 1) {
        await tx
          .update(tournamentMatchesTable)
          .set({ playerOneId: winnerId })
          .where(
            and(
              eq(tournamentMatchesTable.id, tm.nextMatchId),
              sql`${tournamentMatchesTable.playerOneId} is null`,
            ),
          );
      } else if (tm.nextSlot === 2) {
        await tx
          .update(tournamentMatchesTable)
          .set({ playerTwoId: winnerId })
          .where(
            and(
              eq(tournamentMatchesTable.id, tm.nextMatchId),
              sql`${tournamentMatchesTable.playerTwoId} is null`,
            ),
          );
      }
    }
  });
}
