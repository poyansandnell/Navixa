/**
 * Turn / match-end push notifications for DAILY (async) matches.
 *
 * Blitz matches are realtime (both players are expected to be connected via
 * Socket.IO), so they are skipped. For daily matches we notify the player whose
 * turn it now is, and both players when the match ends — respecting each user's
 * notificationsEnabled + pushTurns settings.
 *
 * These are fire-and-forget helpers meant to be called AFTER a transaction
 * commits, alongside the socket emits. They never throw.
 */
import { and, eq } from "drizzle-orm";
import {
  db,
  profilesTable,
  userSettingsTable,
  pushTokensTable,
  notificationsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { sendExpoPush } from "../lib/push";
import { emitNotification } from "../realtime/emitter";

/** Whether a tempo should trigger push notifications. */
export function isPushTempo(tempo: string | null | undefined): boolean {
  return tempo === "daily";
}

async function pushEnabled(userId: string): Promise<boolean> {
  const [s] = await db
    .select({
      on: userSettingsTable.notificationsEnabled,
      turns: userSettingsTable.pushTurns,
    })
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId))
    .limit(1);
  return (s?.on ?? true) && (s?.turns ?? true);
}

async function usernameOf(userId: string | null): Promise<string> {
  if (!userId) return "din motståndare";
  const [p] = await db
    .select({ username: profilesTable.username })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);
  return p?.username ?? "din motståndare";
}

async function activeExpoTokens(userId: string): Promise<string[]> {
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(and(eq(pushTokensTable.userId, userId), eq(pushTokensTable.isActive, true)));
  return rows
    .map((r) => r.token)
    .filter((t) => t.startsWith("Expo") || t.startsWith("ExponentPushToken["));
}

/**
 * Notify `toUserId` that it is now their turn in a daily match. Records an
 * in-app notification, emits it over the socket, and sends an Expo push.
 */
export async function notifyTurn(params: {
  matchId: string;
  tempo: string | null | undefined;
  toUserId: string | null;
  opponentId: string | null;
}): Promise<void> {
  try {
    if (!isPushTempo(params.tempo) || !params.toUserId) return;
    const opponentUsername = await usernameOf(params.opponentId);
    const title = "Din tur!";
    const body = `Det är din tur mot ${opponentUsername} i Navixa`;

    const [notif] = await db
      .insert(notificationsTable)
      .values({
        userId: params.toUserId,
        type: "your_turn",
        title,
        body,
        data: { matchId: params.matchId },
      })
      .returning();
    if (notif) emitNotification(params.toUserId, notif);

    if (!(await pushEnabled(params.toUserId))) return;
    const tokens = await activeExpoTokens(params.toUserId);
    void sendExpoPush(
      tokens.map((to) => ({
        to,
        title,
        body,
        data: { matchId: params.matchId },
        sound: "default" as const,
      })),
    );
  } catch (err) {
    logger.error({ err, matchId: params.matchId }, "notifyTurn failed");
  }
}

/**
 * Notify both human participants that a daily match has ended.
 */
export async function notifyMatchEnd(params: {
  matchId: string;
  tempo: string | null | undefined;
  participants: { userId: string | null; opponentId: string | null }[];
}): Promise<void> {
  try {
    if (!isPushTempo(params.tempo)) return;
    for (const p of params.participants) {
      if (!p.userId) continue;
      const opponentUsername = await usernameOf(p.opponentId);
      const title = "Matchen är klar";
      const body = `Matchen mot ${opponentUsername} är klar`;

      const [notif] = await db
        .insert(notificationsTable)
        .values({
          userId: p.userId,
          type: "match_result",
          title,
          body,
          data: { matchId: params.matchId },
        })
        .returning();
      if (notif) emitNotification(p.userId, notif);

      if (!(await pushEnabled(p.userId))) continue;
      const tokens = await activeExpoTokens(p.userId);
      void sendExpoPush(
        tokens.map((to) => ({
          to,
          title,
          body,
          data: { matchId: params.matchId },
          sound: "default" as const,
        })),
      );
    }
  } catch (err) {
    logger.error({ err, matchId: params.matchId }, "notifyMatchEnd failed");
  }
}
