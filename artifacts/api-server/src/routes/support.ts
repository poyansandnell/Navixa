/**
 * Support tickets — PUBLIC inbound contact endpoint. No auth is required, but
 * when a valid Clerk session is present the ticket is attributed to that user.
 * Rate limited per (IP + email) to curb abuse.
 */
import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, supportTicketsTable, profilesTable } from "@workspace/db";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import { supportTicketSchema } from "../lib/schemas";

const router: IRouter = Router();

// -----------------------------------------------------------------------------
// Per-(IP+email) sliding-window rate limiter: at most SUPPORT_MAX tickets per
// window. In-memory is fine for a single instance; use a shared store if scaled.
// A periodic sweep evicts stale keys so unique-key flood traffic can't grow the
// Map without bound.
// -----------------------------------------------------------------------------
const SUPPORT_MAX = 5;
const SUPPORT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const supportHits = new Map<string, number[]>();

/** Drop entries whose newest timestamp has aged out of the window. */
function sweepSupportHits(now: number): void {
  const cutoff = now - SUPPORT_WINDOW_MS;
  for (const [key, hits] of supportHits) {
    const newest = hits[hits.length - 1] ?? 0;
    if (newest <= cutoff) supportHits.delete(key);
  }
}

// Background eviction (unref'd so it never keeps the process alive).
setInterval(() => sweepSupportHits(Date.now()), SUPPORT_WINDOW_MS).unref();

function supportRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - SUPPORT_WINDOW_MS;
  const hits = (supportHits.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= SUPPORT_MAX) {
    supportHits.set(key, hits);
    return true;
  }
  hits.push(now);
  supportHits.set(key, hits);
  return false;
}

/** POST /api/support/tickets — public support/contact submission. */
router.post(
  "/tickets",
  asyncHandler(async (req, res) => {
    const body = parseBody(supportTicketSchema, req.body);

    // req.ip is trustworthy: app has `trust proxy` set for the single Replit hop.
    const ip = req.ip ?? "unknown";
    const rateKey = `${ip}:${body.email.toLowerCase()}`;
    if (supportRateLimited(rateKey)) {
      throw appError(
        "RATE_LIMITED",
        `Too many support requests; max ${SUPPORT_MAX} per hour.`,
      );
    }

    // Attach the caller's user id when a valid session exists AND the profile
    // is real (FK is set-null on delete, so guard against dangling ids).
    let userId: string | null = null;
    const { userId: authUserId } = getAuth(req);
    if (authUserId) {
      const [profile] = await db
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(eq(profilesTable.id, authUserId))
        .limit(1);
      if (profile) userId = profile.id;
    }

    const [ticket] = await db
      .insert(supportTicketsTable)
      .values({
        userId,
        email: body.email,
        subject: body.subject,
        message: body.message,
        category: body.category,
      })
      .returning({ id: supportTicketsTable.id });

    res.json({ ok: true, ticketId: ticket!.id });
  }),
);

export default router;
