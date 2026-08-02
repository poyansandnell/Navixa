/**
 * One-off, token-guarded bootstrap endpoint for creating the Apple App Review
 * account directly in the production Clerk instance + database.
 *
 * Security model:
 *   - Disabled entirely unless the REVIEW_SETUP_TOKEN env var is set.
 *   - Caller must present the exact token in the `x-setup-token` header
 *     (constant-time comparison).
 *   - Locked to a single fixed identity (REVIEW_EMAIL below) — the endpoint
 *     cannot create arbitrary accounts even if the token leaks. Only the
 *     password comes from the request body, so no secrets live in git.
 *   - Idempotent: if the Clerk user already exists it is reused (no
 *     duplicates); the profile row is created only if missing.
 *   - The review email is explicitly marked verified so sign-in requires no
 *     email code or extra onboarding.
 *
 * Once the account exists, remove REVIEW_SETUP_TOKEN from the production
 * environment to disable this endpoint completely.
 */
import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, profilesTable, userSettingsTable, ratingsTable } from "@workspace/db";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import { hashEmail } from "./profile";

const router: IRouter = Router();

/** The only identity this endpoint can create. Not secret. */
const REVIEW_EMAIL = "apple.review@catchme.se";
const REVIEW_USERNAME = "AppleReview";

const bodySchema = z.object({
  password: z.string().min(10).max(128),
});

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** POST /api/review-account/bootstrap */
router.post(
  "/bootstrap",
  asyncHandler(async (req, res) => {
    const expected = process.env.REVIEW_SETUP_TOKEN;
    if (!expected) throw appError("NOT_FOUND", "Route not found");
    if (!tokenMatches(req.header("x-setup-token"), expected)) {
      throw appError("UNAUTHORIZED", "Invalid setup token");
    }

    const { password } = parseBody(bodySchema, req.body);

    // 1) Clerk user — reuse if it already exists (idempotent).
    const existing = await clerkClient.users.getUserList({
      emailAddress: [REVIEW_EMAIL],
    });
    let userId: string;
    let createdClerkUser = false;
    if (existing.data.length > 0) {
      userId = existing.data[0].id;
    } else {
      const user = await clerkClient.users.createUser({
        emailAddress: [REVIEW_EMAIL],
        password,
        firstName: "Apple",
        lastName: "Review",
      });
      userId = user.id;
      createdClerkUser = true;
    }

    // 2) Ensure the email address is verified so login needs no email code.
    const user = await clerkClient.users.getUser(userId);
    const emailObj = user.emailAddresses.find(
      (e) => e.emailAddress.toLowerCase() === REVIEW_EMAIL,
    );
    let emailVerified = emailObj?.verification?.status === "verified";
    if (emailObj && !emailVerified) {
      await clerkClient.emailAddresses.updateEmailAddress(emailObj.id, {
        verified: true,
      });
      emailVerified = true;
    }

    // 3) Profile + settings + ratings rows (skip if present).
    const [profile] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    let createdProfile = false;
    if (!profile) {
      await db.insert(profilesTable).values({
        id: userId,
        username: REVIEW_USERNAME,
        displayName: "Apple Review",
        locale: "en",
        emailHash: hashEmail(REVIEW_EMAIL),
      });
      await db.insert(userSettingsTable).values({ userId }).onConflictDoNothing();
      await db
        .insert(ratingsTable)
        .values({ playerId: userId, mode: "ranked" })
        .onConflictDoNothing();
      createdProfile = true;
    }

    res.json({ ok: true, userId, createdClerkUser, createdProfile, emailVerified });
  }),
);

export default router;
