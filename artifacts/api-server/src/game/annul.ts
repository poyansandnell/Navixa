/** annul_match — void a match and revert its rating effects. Idempotent. */
import { and, eq, ne, sql } from "drizzle-orm";
import {
  db,
  matchesTable,
  ratingsTable,
  ratingHistoryTable,
} from "@workspace/db";
import { appError } from "../lib/errors";

export async function annulMatch(
  matchId: string,
  adminId: string,
  reason: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, matchId))
      .for("update")
      .limit(1);
    if (!match) throw appError("MATCH_NOT_FOUND");
    if (match.status === "annulled") return;

    const history = await tx
      .select()
      .from(ratingHistoryTable)
      .where(
        and(
          eq(ratingHistoryTable.matchId, matchId),
          ne(ratingHistoryTable.ratingDelta, 0),
        ),
      );

    for (const rh of history) {
      // Skip if a compensating row already exists.
      const comp = await tx
        .select({ id: ratingHistoryTable.id })
        .from(ratingHistoryTable)
        .where(
          and(
            eq(ratingHistoryTable.matchId, matchId),
            eq(ratingHistoryTable.playerId, rh.playerId),
            eq(ratingHistoryTable.ratingDelta, -rh.ratingDelta),
            sql`${ratingHistoryTable.createdAt} > ${rh.createdAt}`,
          ),
        )
        .limit(1);
      if (comp.length > 0) continue;

      await tx
        .update(ratingsTable)
        .set({
          rating: sql`greatest(0, least(4000, ${ratingsTable.rating} - ${rh.ratingDelta}))`,
          gamesPlayed: sql`greatest(0, ${ratingsTable.gamesPlayed} - 1)`,
          wins: sql`greatest(0, ${ratingsTable.wins} - ${rh.result === "win" ? 1 : 0})`,
          losses: sql`greatest(0, ${ratingsTable.losses} - ${rh.result === "loss" ? 1 : 0})`,
          draws: sql`greatest(0, ${ratingsTable.draws} - ${rh.result === "draw" ? 1 : 0})`,
        })
        .where(
          and(
            eq(ratingsTable.playerId, rh.playerId),
            eq(ratingsTable.mode, rh.mode),
          ),
        );

      await tx.insert(ratingHistoryTable).values({
        playerId: rh.playerId,
        mode: rh.mode,
        matchId,
        ratingBefore: rh.ratingAfter,
        ratingAfter: rh.ratingAfter - rh.ratingDelta,
        ratingDelta: -rh.ratingDelta,
        result: "aborted",
      });
    }

    await tx
      .update(matchesTable)
      .set({
        status: "annulled",
        annulledAt: new Date(),
        annulledBy: adminId,
        annulReason: reason,
      })
      .where(eq(matchesTable.id, matchId));
  });
}
