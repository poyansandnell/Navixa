/**
 * Auth middlewares.
 *
 * requireAuth: reads the Clerk auth context (populated by clerkMiddleware) and
 * rejects unauthenticated requests. The authenticated Clerk user id is exposed
 * on `res.locals.userId` for handlers.
 *
 * requireAdmin: additionally checks the caller's profiles.is_admin flag,
 * server-side, on every request.
 */
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db, profilesTable, moderationActionsTable } from "@workspace/db";
import { sendError, appError } from "../lib/errors";

/**
 * Suspension/ban enforcement. Any active moderation action of type
 * suspend/ban (not yet expired) blocks all authenticated API access with
 * ACCOUNT_SUSPENDED (403). Results are cached briefly to avoid a DB query on
 * every request; a fresh ban takes effect within SUSPENSION_CACHE_TTL_MS.
 */
const SUSPENSION_CACHE_TTL_MS = 30_000;
const suspensionCache = new Map<string, { suspended: boolean; expires: number }>();

async function isSuspended(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = suspensionCache.get(userId);
  if (cached && cached.expires > now) return cached.suspended;
  const rows = await db
    .select({ id: moderationActionsTable.id })
    .from(moderationActionsTable)
    .where(
      and(
        eq(moderationActionsTable.targetId, userId),
        eq(moderationActionsTable.isActive, true),
        or(
          eq(moderationActionsTable.action, "suspend"),
          eq(moderationActionsTable.action, "ban"),
        ),
        or(
          isNull(moderationActionsTable.expiresAt),
          gt(moderationActionsTable.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  const suspended = rows.length > 0;
  if (suspensionCache.size > 10_000) suspensionCache.clear();
  suspensionCache.set(userId, { suspended, expires: now + SUSPENSION_CACHE_TTL_MS });
  return suspended;
}

/** Drop the cached suspension state (call after moderation changes). */
export function invalidateSuspensionCache(userId: string) {
  suspensionCache.delete(userId);
}

/** Return the authenticated Clerk user id, or throw UNAUTHORIZED. */
export function requireUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw appError("UNAUTHORIZED", "Authentication required");
  return userId;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      sendError(res, appError("UNAUTHORIZED", "Authentication required"));
      return;
    }
    isSuspended(userId)
      .then((suspended) => {
        if (suspended) {
          sendError(
            res,
            appError("ACCOUNT_SUSPENDED", "This account has been suspended"),
          );
          return;
        }
        res.locals.userId = userId;
        next();
      })
      .catch((err: unknown) => sendError(res, err));
  } catch (err) {
    sendError(res, err);
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { userId } = getAuth(req);
  if (!userId) {
    sendError(res, appError("UNAUTHORIZED", "Authentication required"));
    return;
  }
  db.select({ isAdmin: profilesTable.isAdmin })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1)
    .then((rows) => {
      if (!rows[0]?.isAdmin) {
        sendError(res, appError("FORBIDDEN", "Admin privileges required"));
        return;
      }
      res.locals.userId = userId;
      next();
    })
    .catch((err: unknown) => sendError(res, err));
}
