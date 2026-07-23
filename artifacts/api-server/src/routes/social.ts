/** Social: friends, requests, blocks, leaderboards, reports. */
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  friendRequestsTable,
  friendshipsTable,
  blocksTable,
  reportsTable,
  ratingsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody, parseQuery } from "../lib/http";
import { appError } from "../lib/errors";
import {
  sendFriendRequestSchema,
  blockUserSchema,
  idParamSchema,
  reportUserSchema,
  leaderboardQuerySchema,
} from "../lib/schemas";
import { emitFriendEvent } from "../realtime/emitter";

const router: IRouter = Router();
router.use(requireAuth);

/** GET /api/social/friends — the caller's friends with profile + rating. */
router.get(
  "/friends",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const rows = await db
      .select()
      .from(friendshipsTable)
      .where(or(eq(friendshipsTable.userA, uid), eq(friendshipsTable.userB, uid)));
    const otherIds = rows.map((r) => (r.userA === uid ? r.userB : r.userA));
    const profiles = otherIds.length
      ? await db.select().from(profilesTable).where(inArray(profilesTable.id, otherIds))
      : [];
    const ratings = otherIds.length
      ? await db
          .select()
          .from(ratingsTable)
          .where(and(inArray(ratingsTable.playerId, otherIds), eq(ratingsTable.mode, "ranked")))
      : [];
    const profMap = new Map(profiles.map((p) => [p.id, p]));
    const ratingMap = new Map(ratings.map((r) => [r.playerId, r.rating]));
    const friends = rows
      .map((row) => {
        const otherId = row.userA === uid ? row.userB : row.userA;
        const profile = profMap.get(otherId);
        return profile
          ? {
              friendshipId: row.id,
              profile,
              rating: ratingMap.get(otherId) ?? null,
            }
          : null;
      })
      .filter(Boolean);
    res.json({ friends });
  }),
);

/** GET /api/social/requests — pending incoming + outgoing. */
router.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const rows = await db
      .select()
      .from(friendRequestsTable)
      .where(
        and(
          eq(friendRequestsTable.status, "pending"),
          or(
            eq(friendRequestsTable.senderId, uid),
            eq(friendRequestsTable.receiverId, uid),
          ),
        ),
      )
      .orderBy(desc(friendRequestsTable.createdAt));
    const otherIds = Array.from(
      new Set(rows.map((r) => (r.senderId === uid ? r.receiverId : r.senderId))),
    );
    const profiles = otherIds.length
      ? await db.select().from(profilesTable).where(inArray(profilesTable.id, otherIds))
      : [];
    const profMap = new Map(profiles.map((p) => [p.id, p]));
    const incoming = rows
      .filter((r) => r.receiverId === uid)
      .map((r) => ({ request: r, profile: profMap.get(r.senderId) ?? null }));
    const outgoing = rows
      .filter((r) => r.senderId === uid)
      .map((r) => ({ request: r, profile: profMap.get(r.receiverId) ?? null }));
    res.json({ incoming, outgoing });
  }),
);

/** POST /api/social/requests — send a friend request. */
router.post(
  "/requests",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const body = parseBody(sendFriendRequestSchema, req.body);
    if (body.receiverId === uid) throw appError("INVALID_PAYLOAD", "Cannot friend yourself");
    const [request] = await db
      .insert(friendRequestsTable)
      .values({
        senderId: uid,
        receiverId: body.receiverId,
        message: body.message ?? null,
        status: "pending",
      })
      .returning();
    emitFriendEvent(body.receiverId, { type: "request_received", requestId: request.id });
    res.json({ request });
  }),
);

/** POST /api/social/requests/:id/accept — receiver accepts (ports accept_friend_request). */
router.post(
  "/requests/:id/accept",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { id } = parseBody(idParamSchema, req.params);
    const friendship = await db.transaction(async (tx) => {
      const [reqRow] = await tx
        .select()
        .from(friendRequestsTable)
        .where(eq(friendRequestsTable.id, id))
        .for("update")
        .limit(1);
      if (!reqRow) throw appError("NOT_FOUND", "Friend request not found");
      if (reqRow.receiverId !== uid) throw appError("FORBIDDEN", "Only the receiver may accept");
      if (reqRow.status !== "pending") throw appError("CONFLICT", "Request is not pending");
      await tx
        .update(friendRequestsTable)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(eq(friendRequestsTable.id, id));
      const a = reqRow.senderId < reqRow.receiverId ? reqRow.senderId : reqRow.receiverId;
      const b = reqRow.senderId < reqRow.receiverId ? reqRow.receiverId : reqRow.senderId;
      const [fr] = await tx
        .insert(friendshipsTable)
        .values({ userA: a, userB: b })
        .onConflictDoUpdate({
          target: [friendshipsTable.userA, friendshipsTable.userB],
          set: { updatedAt: new Date() },
        })
        .returning();
      return { fr, senderId: reqRow.senderId };
    });
    emitFriendEvent(friendship.senderId, { type: "request_accepted", by: uid });
    res.json({ friendship: friendship.fr });
  }),
);

/** POST /api/social/requests/:id/reject */
router.post(
  "/requests/:id/reject",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { id } = parseBody(idParamSchema, req.params);
    await db
      .update(friendRequestsTable)
      .set({ status: "declined", respondedAt: new Date() })
      .where(and(eq(friendRequestsTable.id, id), eq(friendRequestsTable.receiverId, uid)));
    res.json({ ok: true });
  }),
);

/** POST /api/social/requests/:id/cancel */
router.post(
  "/requests/:id/cancel",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { id } = parseBody(idParamSchema, req.params);
    await db
      .update(friendRequestsTable)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(and(eq(friendRequestsTable.id, id), eq(friendRequestsTable.senderId, uid)));
    res.json({ ok: true });
  }),
);

/** DELETE /api/social/friends/:id — remove a friendship by id. */
router.delete(
  "/friends/:id",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { id } = parseBody(idParamSchema, req.params);
    await db
      .delete(friendshipsTable)
      .where(
        and(
          eq(friendshipsTable.id, id),
          or(eq(friendshipsTable.userA, uid), eq(friendshipsTable.userB, uid)),
        ),
      );
    res.json({ ok: true });
  }),
);

/** GET /api/social/blocks — the caller's blocked ids. */
router.get(
  "/blocks",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const rows = await db
      .select()
      .from(blocksTable)
      .where(eq(blocksTable.blockerId, uid));
    res.json({ blocks: rows });
  }),
);

/** POST /api/social/blocks — block a user (and drop any friendship). */
router.post(
  "/blocks",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const body = parseBody(blockUserSchema, req.body);
    if (body.blockedId === uid) throw appError("INVALID_PAYLOAD", "Cannot block yourself");
    await db
      .insert(blocksTable)
      .values({ blockerId: uid, blockedId: body.blockedId, reason: body.reason ?? null })
      .onConflictDoNothing();
    const a = uid < body.blockedId ? uid : body.blockedId;
    const b = uid < body.blockedId ? body.blockedId : uid;
    await db
      .delete(friendshipsTable)
      .where(and(eq(friendshipsTable.userA, a), eq(friendshipsTable.userB, b)));
    res.json({ ok: true });
  }),
);

/** DELETE /api/social/blocks/:id — unblock (id is the blocked user id). */
router.delete(
  "/blocks/:id",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { id } = parseBody(idParamSchema, req.params);
    await db
      .delete(blocksTable)
      .where(and(eq(blocksTable.blockerId, uid), eq(blocksTable.blockedId, id)));
    res.json({ ok: true });
  }),
);

/** GET /api/social/relationship/:id */
router.get(
  "/relationship/:id",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { id } = parseBody(idParamSchema, req.params);
    if (id === uid) {
      res.json({ relationship: "self", requestId: null });
      return;
    }
    const a = uid < id ? uid : id;
    const b = uid < id ? id : uid;
    const [fs] = await db
      .select({ id: friendshipsTable.id })
      .from(friendshipsTable)
      .where(and(eq(friendshipsTable.userA, a), eq(friendshipsTable.userB, b)))
      .limit(1);
    const [blk] = await db
      .select({ id: blocksTable.id })
      .from(blocksTable)
      .where(and(eq(blocksTable.blockerId, uid), eq(blocksTable.blockedId, id)))
      .limit(1);
    const pending = await db
      .select()
      .from(friendRequestsTable)
      .where(
        and(
          eq(friendRequestsTable.status, "pending"),
          or(
            and(eq(friendRequestsTable.senderId, uid), eq(friendRequestsTable.receiverId, id)),
            and(eq(friendRequestsTable.senderId, id), eq(friendRequestsTable.receiverId, uid)),
          ),
        ),
      );
    if (blk) {
      res.json({ relationship: "blocked", requestId: null });
      return;
    }
    if (fs) {
      res.json({ relationship: "friends", requestId: null });
      return;
    }
    if (pending.length > 0) {
      const p = pending[0];
      res.json({
        relationship: p.senderId === uid ? "request_sent" : "request_received",
        requestId: p.id,
      });
      return;
    }
    res.json({ relationship: "none", requestId: null });
  }),
);

/** POST /api/social/reports — file an abuse report (ports report-user). */
router.post(
  "/reports",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const body = parseBody(reportUserSchema, req.body);
    if (body.reportedId === uid) throw appError("INVALID_PAYLOAD", "Cannot report yourself");
    const [target] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, body.reportedId))
      .limit(1);
    if (!target) throw appError("NOT_FOUND", "Reported user not found");
    const [report] = await db
      .insert(reportsTable)
      .values({
        reporterId: uid,
        reportedId: body.reportedId,
        matchId: body.matchId ?? null,
        category: body.category,
        description: body.description ?? null,
        status: "open",
      })
      .returning({ id: reportsTable.id });
    res.json({ ok: true, reportId: report.id });
  }),
);

/** GET /api/social/leaderboard — live ranked leaderboard page. */
router.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const q = parseQuery(leaderboardQuerySchema, req.query);
    const offset = q.page * q.pageSize;
    const rows = await db
      .select({
        playerId: ratingsTable.playerId,
        rating: ratingsTable.rating,
        gamesPlayed: ratingsTable.gamesPlayed,
        wins: ratingsTable.wins,
        losses: ratingsTable.losses,
        username: profilesTable.username,
        displayName: profilesTable.displayName,
        avatarUrl: profilesTable.avatarUrl,
        countryCode: profilesTable.countryCode,
        level: profilesTable.level,
      })
      .from(ratingsTable)
      .innerJoin(profilesTable, eq(profilesTable.id, ratingsTable.playerId))
      .where(
        and(
          eq(ratingsTable.mode, q.mode),
          sql`${ratingsTable.gamesPlayed} > 0`,
          sql`${profilesTable.deletedAt} is null`,
          eq(profilesTable.isBot, false),
          q.scope === "global" ? undefined : eq(profilesTable.countryCode, q.scope),
        ),
      )
      .orderBy(desc(ratingsTable.rating), desc(ratingsTable.gamesPlayed))
      .limit(q.pageSize)
      .offset(offset);
    const entries = rows.map((r, i) => ({ ...r, rank: offset + i + 1 }));
    res.json({ entries, page: q.page, pageSize: q.pageSize });
  }),
);

export default router;
