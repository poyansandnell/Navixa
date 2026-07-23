/**
 * Server-side turn-timeout sweep.
 *
 * A ~1s interval finds active matches whose server-stamped turn_deadline has
 * expired and finalises them via resolveTimeout() (which locks the match row
 * and re-checks the deadline inside a transaction, so it is race-safe against a
 * concurrent human shot or bot move). This replaces any reliance on clients
 * reporting timeouts.
 */
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db, matchesTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { resolveTimeout } from "./service";

let sweepTimer: NodeJS.Timeout | null = null;

/** Start the ~1s server-side timeout sweep. Idempotent. */
export function startTimeoutSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    sweepOnce().catch((err) => logger.error({ err }, "timeout sweep failed"));
  }, 1000);
  sweepTimer.unref?.();
}

async function sweepOnce(): Promise<void> {
  const expired = await db
    .select({ id: matchesTable.id })
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.status, "active"),
        isNotNull(matchesTable.turnDeadline),
        lt(matchesTable.turnDeadline, new Date()),
      ),
    )
    .limit(50);

  for (const { id } of expired) {
    try {
      await resolveTimeout(id);
    } catch {
      // NOT_TIMED_OUT races / already finalised are fine.
    }
  }
}
