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
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { sendError, appError } from "../lib/errors";

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
    res.locals.userId = userId;
    next();
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
