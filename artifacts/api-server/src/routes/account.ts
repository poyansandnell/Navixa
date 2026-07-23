/** Account: GDPR-style data export + full account deletion. */
import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  profilesTable,
  userSettingsTable,
  ratingsTable,
  ratingHistoryTable,
  matchPlayersTable,
  friendshipsTable,
  friendRequestsTable,
  blocksTable,
  userInventoryTable,
  equippedCosmeticsTable,
  userQuestsTable,
  notificationsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import { deleteAccountSchema } from "../lib/schemas";

const router: IRouter = Router();
router.use(requireAuth);

/** GET /api/account/export — a JSON dump of the caller's own data. */
router.get(
  "/export",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const [
      profile,
      settings,
      ratings,
      ratingHistory,
      matchParticipation,
      friendships,
      friendRequests,
      blocks,
      inventory,
      equipped,
      quests,
      notifications,
    ] = await Promise.all([
      db.select().from(profilesTable).where(eq(profilesTable.id, uid)),
      db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, uid)),
      db.select().from(ratingsTable).where(eq(ratingsTable.playerId, uid)),
      db.select().from(ratingHistoryTable).where(eq(ratingHistoryTable.playerId, uid)),
      db.select().from(matchPlayersTable).where(eq(matchPlayersTable.playerId, uid)),
      db
        .select()
        .from(friendshipsTable)
        .where(or(eq(friendshipsTable.userA, uid), eq(friendshipsTable.userB, uid))),
      db
        .select()
        .from(friendRequestsTable)
        .where(
          or(eq(friendRequestsTable.senderId, uid), eq(friendRequestsTable.receiverId, uid)),
        ),
      db.select().from(blocksTable).where(eq(blocksTable.blockerId, uid)),
      db.select().from(userInventoryTable).where(eq(userInventoryTable.userId, uid)),
      db.select().from(equippedCosmeticsTable).where(eq(equippedCosmeticsTable.userId, uid)),
      db.select().from(userQuestsTable).where(eq(userQuestsTable.userId, uid)),
      db.select().from(notificationsTable).where(eq(notificationsTable.userId, uid)),
    ]);
    res.json({
      exportedAt: new Date().toISOString(),
      userId: uid,
      profile: profile[0] ?? null,
      settings: settings[0] ?? null,
      ratings,
      ratingHistory,
      matchParticipation,
      friendships,
      friendRequests,
      blocks,
      inventory,
      equipped,
      quests,
      notifications,
    });
  }),
);

/**
 * POST /api/account/delete — delete the caller's account.
 *
 * Behaviour change vs Supabase: Supabase used auth.admin.deleteUser; here we
 * delete the Clerk user via clerkClient.users.deleteUser. The profile row is
 * hard-deleted; FK cascades (onDelete cascade) remove owned rows, while match
 * history keeps the seat with a null player id (set null) for opponent replays.
 */
router.post(
  "/delete",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    parseBody(deleteAccountSchema, req.body);

    const [profile] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, uid))
      .limit(1);
    if (!profile) throw appError("NOT_FOUND", "Profile not found");

    // Remove the DB profile (cascades own settings/ratings/inventory/etc.).
    await db.delete(profilesTable).where(eq(profilesTable.id, uid));

    // Remove the Clerk identity (fire-and-forget errors are surfaced).
    try {
      await clerkClient.users.deleteUser(uid);
    } catch (err) {
      req.log.error({ err }, "clerk user deletion failed after profile removal");
    }

    res.json({ ok: true });
  }),
);

export default router;
