/** Profile domain: JIT bootstrap, own profile, public profiles, ratings, stats. */
import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { and, eq, ilike, isNull, ne, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  userSettingsTable,
  ratingsTable,
  bannedUsernamesTable,
  matchPlayersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody, parseQuery } from "../lib/http";
import { appError } from "../lib/errors";
import { sanitizeProfile } from "../lib/sanitizeProfile";
import {
  bootstrapProfileSchema,
  updateProfileSchema,
  searchUsersQuerySchema,
  idParamSchema,
} from "../lib/schemas";

import {
  normalizeUsername,
  usernameKey,
  usernameProblem,
} from "../lib/username";

const router: IRouter = Router();
router.use(requireAuth);

/** sha256 hex of a normalised (trimmed, lowercased) email. */
export function hashEmail(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

/**
 * Resolve the caller's primary email: prefer the request body, then Clerk
 * session claims, then a Clerk API lookup. Returns null if none is available.
 */
async function resolveEmail(
  req: Parameters<typeof getAuth>[0],
  userId: string,
  bodyEmail?: string,
): Promise<string | null> {
  if (bodyEmail) return bodyEmail;
  const claims = getAuth(req).sessionClaims as Record<string, unknown> | null;
  const claimEmail = claims?.email ?? claims?.email_address;
  if (typeof claimEmail === "string" && claimEmail.includes("@")) return claimEmail;
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    );
    return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

/**
 * Full availability check for a normalised username: format, banned patterns,
 * and case-insensitive uniqueness among non-deleted profiles. Note that the
 * DB unique index on lower(username) is the final guarantee against races.
 */
async function usernameUnavailableReason(
  normalized: string,
): Promise<"USERNAME_INVALID" | "USERNAME_TAKEN" | null> {
  if (usernameProblem(normalized)) return "USERNAME_INVALID";
  const banned = await db
    .select({ pattern: bannedUsernamesTable.pattern })
    .from(bannedUsernamesTable)
    .where(eq(bannedUsernamesTable.isActive, true));
  const key = usernameKey(normalized);
  if (banned.some((b) => key.includes(b.pattern.toLowerCase()))) {
    return "USERNAME_INVALID";
  }
  const [taken] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(
      and(
        sql`lower(${profilesTable.username}) = ${key}`,
        isNull(profilesTable.deletedAt),
      ),
    )
    .limit(1);
  return taken ? "USERNAME_TAKEN" : null;
}

async function assertUsernameOk(normalized: string): Promise<void> {
  const problem = usernameProblem(normalized);
  if (problem) throw appError("USERNAME_INVALID", problem);
  const reason = await usernameUnavailableReason(normalized);
  if (reason === "USERNAME_INVALID") {
    throw appError("USERNAME_INVALID", "Username is not allowed");
  }
  if (reason === "USERNAME_TAKEN") {
    throw appError("USERNAME_TAKEN", "Username is taken");
  }
}

/** POST /api/profile/bootstrap — JIT-create the profile + settings + ratings. */
router.post(
  "/bootstrap",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const body = parseBody(bootstrapProfileSchema, req.body);

    const [existing] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    if (existing) {
      // Backfill the email hash for pre-existing profiles that lack one.
      if (!existing.emailHash) {
        const email = await resolveEmail(req, userId, body.email);
        if (email) {
          const emailHash = hashEmail(email);
          await db
            .update(profilesTable)
            .set({ emailHash })
            .where(and(eq(profilesTable.id, userId), isNull(profilesTable.emailHash)))
            .catch(() => undefined);
        }
      }
      res.json({ created: false, profile: sanitizeProfile(existing) });
      return;
    }

    const username = normalizeUsername(body.username);
    await assertUsernameOk(username);

    const email = await resolveEmail(req, userId, body.email);
    const emailHash = email ? hashEmail(email) : null;

    let profile;
    try {
      [profile] = await db
        .insert(profilesTable)
        .values({
          id: userId,
          username,
          displayName: (body.displayName ?? username).trim(),
          locale: body.locale ?? "en",
          emailHash,
        })
        .returning();
    } catch (err) {
      // Unique-violation on lower(username): another signup raced us.
      if ((err as { code?: string }).code === "23505") {
        throw appError("USERNAME_TAKEN", "Username is taken");
      }
      throw err;
    }

    await db
      .insert(userSettingsTable)
      .values({ userId })
      .onConflictDoNothing();
    await db
      .insert(ratingsTable)
      .values({ playerId: userId, mode: "ranked" })
      .onConflictDoNothing();

    res.json({ created: true, profile: sanitizeProfile(profile) });
  }),
);

/**
 * GET /api/profile/username-available?username=… — live availability check
 * for onboarding. Applies the same normalisation/validation as bootstrap.
 */
router.get(
  "/username-available",
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.username === "string" ? req.query.username : "";
    const normalized = normalizeUsername(raw);
    const reason = normalized
      ? await usernameUnavailableReason(normalized)
      : "USERNAME_INVALID";
    res.json({
      available: reason === null,
      reason,
      normalized,
    });
  }),
);

/** GET /api/profile/me — own profile (creates nothing). */
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    if (!profile) throw appError("NOT_FOUND", "Profile not bootstrapped");
    res.json({ profile: sanitizeProfile(profile) });
  }),
);

/** PATCH /api/profile/me — update own profile metadata. */
router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const body = parseBody(updateProfileSchema, req.body);
    const [profile] = await db
      .update(profilesTable)
      .set({
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.countryCode !== undefined ? { countryCode: body.countryCode } : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
      })
      .where(eq(profilesTable.id, userId))
      .returning();
    if (!profile) throw appError("NOT_FOUND", "Profile not found");
    res.json({ profile: sanitizeProfile(profile) });
  }),
);

/** POST /api/profile/presence — touch last_seen_at. */
router.post(
  "/presence",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    await db
      .update(profilesTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(profilesTable.id, userId));
    res.json({ ok: true });
  }),
);

/** GET /api/profile/search?q=&limit= — search users by username. */
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const userId = res.locals.userId as string;
    const q = parseQuery(searchUsersQuerySchema, req.query);
    const users = await db
      .select()
      .from(profilesTable)
      .where(
        and(
          ilike(profilesTable.username, `%${q.q}%`),
          isNull(profilesTable.deletedAt),
          ne(profilesTable.id, userId),
          // Server-side block filter: hide blocked users in either direction.
          sql`not exists (
            select 1 from blocks bl
            where (bl.blocker_id = ${userId} and bl.blocked_id = ${profilesTable.id})
               or (bl.blocker_id = ${profilesTable.id} and bl.blocked_id = ${userId})
          )`,
        ),
      )
      .limit(q.limit);
    res.json({ users: users.map(sanitizeProfile) });
  }),
);

/** GET /api/profile/:id — public profile. */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = parseBody(idParamSchema, req.params);
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, id))
      .limit(1);
    if (!profile) throw appError("NOT_FOUND", "Profile not found");
    res.json({ profile: sanitizeProfile(profile) });
  }),
);

/** GET /api/profile/:id/rating — ranked rating for a player. */
router.get(
  "/:id/rating",
  asyncHandler(async (req, res) => {
    const { id } = parseBody(idParamSchema, req.params);
    const [rating] = await db
      .select()
      .from(ratingsTable)
      .where(and(eq(ratingsTable.playerId, id), eq(ratingsTable.mode, "ranked")))
      .limit(1);
    res.json({ rating: rating ?? null });
  }),
);

/** GET /api/profile/:id/stats — aggregate lifetime stats (ports player_stats). */
router.get(
  "/:id/stats",
  asyncHandler(async (req, res) => {
    const { id } = parseBody(idParamSchema, req.params);
    const [agg] = await db
      .select({
        matchesPlayed: sql<number>`count(*)::int`,
        wins: sql<number>`count(*) filter (where ${matchPlayersTable.result} = 'win')::int`,
        losses: sql<number>`count(*) filter (where ${matchPlayersTable.result} = 'loss')::int`,
        draws: sql<number>`count(*) filter (where ${matchPlayersTable.result} = 'draw')::int`,
        totalShots: sql<number>`coalesce(sum(${matchPlayersTable.shotsFired}), 0)::int`,
        totalHits: sql<number>`coalesce(sum(${matchPlayersTable.hits}), 0)::int`,
        shipsSunk: sql<number>`coalesce(sum(${matchPlayersTable.shipsSunk}), 0)::int`,
      })
      .from(matchPlayersTable)
      .where(
        and(
          eq(matchPlayersTable.playerId, id),
          sql`${matchPlayersTable.result} is not null`,
        ),
      );

    const [rating] = await db
      .select({ rating: ratingsTable.rating, best: ratingsTable.bestRating })
      .from(ratingsTable)
      .where(and(eq(ratingsTable.playerId, id), eq(ratingsTable.mode, "ranked")))
      .limit(1);

    const matchesPlayed = agg?.matchesPlayed ?? 0;
    const wins = agg?.wins ?? 0;
    const totalShots = agg?.totalShots ?? 0;
    const totalHits = agg?.totalHits ?? 0;
    res.json({
      stats: {
        matchesPlayed,
        wins,
        losses: agg?.losses ?? 0,
        draws: agg?.draws ?? 0,
        winRate: matchesPlayed === 0 ? 0 : Number((wins / matchesPlayed).toFixed(4)),
        totalShots,
        totalHits,
        accuracy: totalShots === 0 ? 0 : Number((totalHits / totalShots).toFixed(4)),
        shipsSunk: agg?.shipsSunk ?? 0,
        currentRating: rating?.rating ?? 1200,
        bestRating: rating?.best ?? 1200,
      },
    });
  }),
);

export default router;
