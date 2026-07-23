/** Profile domain: JIT bootstrap, own profile, public profiles, ratings, stats. */
import { Router, type IRouter } from "express";
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
import {
  bootstrapProfileSchema,
  updateProfileSchema,
  searchUsersQuerySchema,
  idParamSchema,
} from "../lib/schemas";

const router: IRouter = Router();
router.use(requireAuth);

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

async function assertUsernameOk(username: string): Promise<void> {
  const u = username.trim();
  if (u.length < 3 || u.length > 24 || !USERNAME_RE.test(u)) {
    throw appError("USERNAME_INVALID", "3-24 chars, letters/digits/underscore");
  }
  const banned = await db
    .select({ pattern: bannedUsernamesTable.pattern })
    .from(bannedUsernamesTable)
    .where(eq(bannedUsernamesTable.isActive, true));
  const lower = u.toLowerCase();
  if (banned.some((b) => lower.includes(b.pattern.toLowerCase()))) {
    throw appError("USERNAME_INVALID", "Username is not allowed");
  }
  const [taken] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(and(ilike(profilesTable.username, u), isNull(profilesTable.deletedAt)))
    .limit(1);
  if (taken) throw appError("USERNAME_TAKEN", "Username is taken");
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
      res.json({ created: false, profile: existing });
      return;
    }

    await assertUsernameOk(body.username);

    const [profile] = await db
      .insert(profilesTable)
      .values({
        id: userId,
        username: body.username.trim(),
        displayName: (body.displayName ?? body.username).trim(),
        locale: body.locale ?? "en",
      })
      .returning();

    await db
      .insert(userSettingsTable)
      .values({ userId })
      .onConflictDoNothing();
    await db
      .insert(ratingsTable)
      .values({ playerId: userId, mode: "ranked" })
      .onConflictDoNothing();

    res.json({ created: true, profile });
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
    res.json({ profile });
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
    res.json({ profile });
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
        ),
      )
      .limit(q.limit);
    res.json({ users });
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
    res.json({ profile });
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
