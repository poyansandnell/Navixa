/** Notifications, user settings, push tokens, turn-reminder pushes. */
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  notificationsTable,
  userSettingsTable,
  pushTokensTable,
  matchesTable,
  matchPlayersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import {
  registerPushTokenSchema,
  updateSettingSchema,
  sendTurnNotificationSchema,
} from "../lib/schemas";
import { sendExpoPush } from "../lib/push";
import { emitNotification } from "../realtime/emitter";
import { z } from "zod";
import { uuidSchema } from "../lib/schemas";

const router: IRouter = Router();
router.use(requireAuth);

/** GET /api/notifications — caller's notifications (newest first). */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, uid), isNull(notificationsTable.deletedAt)))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(100);
    res.json({ notifications: rows });
  }),
);

/** POST /api/notifications/:id/read — mark one read. */
router.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { id } = parseBody(z.object({ id: uuidSchema }), req.params);
    await db
      .update(notificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, uid)));
    res.json({ ok: true });
  }),
);

/** POST /api/notifications/read-all — mark all read. */
router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    await db
      .update(notificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notificationsTable.userId, uid), eq(notificationsTable.isRead, false)));
    res.json({ ok: true });
  }),
);

/** GET /api/notifications/settings — caller's settings (JIT default row). */
router.get(
  "/settings",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    let [settings] = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, uid))
      .limit(1);
    if (!settings) {
      [settings] = await db
        .insert(userSettingsTable)
        .values({ userId: uid })
        .onConflictDoNothing()
        .returning();
      if (!settings) {
        [settings] = await db
          .select()
          .from(userSettingsTable)
          .where(eq(userSettingsTable.userId, uid))
          .limit(1);
      }
    }
    res.json({ settings });
  }),
);

/** PATCH /api/notifications/settings — update one setting key. */
router.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const body = parseBody(updateSettingSchema, req.body);
    const [settings] = await db
      .insert(userSettingsTable)
      .values({ userId: uid, [body.key]: body.value } as never)
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: { [body.key]: body.value } as never,
      })
      .returning();
    res.json({ settings });
  }),
);

/** POST /api/notifications/push-token — register an Expo/FCM/APNs token. */
router.post(
  "/push-token",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const body = parseBody(registerPushTokenSchema, req.body);
    await db
      .insert(pushTokensTable)
      .values({
        userId: uid,
        token: body.token,
        platform: body.platform,
        provider: body.provider,
        deviceId: body.deviceId ?? null,
      })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: {
          userId: uid,
          platform: body.platform,
          provider: body.provider,
          deviceId: body.deviceId ?? null,
          isActive: true,
        },
      });
    res.json({ ok: true });
  }),
);

/** DELETE /api/notifications/push-token — unregister a token. */
router.delete(
  "/push-token",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { token } = parseBody(z.object({ token: z.string().min(8).max(512) }), req.body);
    await db
      .delete(pushTokensTable)
      .where(and(eq(pushTokensTable.userId, uid), eq(pushTokensTable.token, token)));
    res.json({ ok: true });
  }),
);

/** POST /api/notifications/turn — notify the opponent it is their turn. */
router.post(
  "/turn",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const body = parseBody(sendTurnNotificationSchema, req.body);
    // Caller must be a participant.
    const players = await db
      .select()
      .from(matchPlayersTable)
      .where(eq(matchPlayersTable.matchId, body.matchId));
    if (!players.some((p) => p.playerId === uid)) {
      throw appError("NOT_A_PARTICIPANT");
    }
    const [match] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, body.matchId))
      .limit(1);
    if (!match) throw appError("MATCH_NOT_FOUND");

    const [settings] = await db
      .select({ pushTurns: userSettingsTable.pushTurns, on: userSettingsTable.notificationsEnabled })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, body.userId))
      .limit(1);
    const wantsPush = (settings?.on ?? true) && (settings?.pushTurns ?? true);

    const [notif] = await db
      .insert(notificationsTable)
      .values({
        userId: body.userId,
        type: "your_turn",
        title: "Your turn",
        body: "It's your move.",
        data: { matchId: body.matchId },
      })
      .returning();
    emitNotification(body.userId, notif);

    if (wantsPush) {
      const tokens = await db
        .select({ token: pushTokensTable.token })
        .from(pushTokensTable)
        .where(eq(pushTokensTable.userId, body.userId));
      void sendExpoPush(
        tokens
          .filter((t) => t.token.startsWith("Expo"))
          .map((t) => ({
            to: t.token,
            title: "Your turn",
            body: "It's your move on Navixa.",
            data: { matchId: body.matchId },
            sound: "default" as const,
          })),
      );
    }
    res.json({ ok: true });
  }),
);

export default router;
