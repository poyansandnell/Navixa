/**
 * Realtime emitter singleton.
 *
 * The Socket.IO server is created in src/realtime/socket.ts and registered here
 * so any route handler / bot scheduler / timeout sweep can emit events from the
 * same code path that writes the DB, without importing the HTTP server.
 *
 * Rooms:
 *   user:<userId>   — matchmaking results, notifications, friend events
 *   match:<matchId> — per-match row updates, moves, events
 */
import type { Server } from "socket.io";
import { logger } from "../lib/logger";

let io: Server | null = null;

export function registerIo(server: Server): void {
  io = server;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function matchRoom(matchId: string): string {
  return `match:${matchId}`;
}

function emit(room: string, event: string, payload: unknown): void {
  if (!io) {
    logger.warn({ room, event }, "emit before io registered");
    return;
  }
  io.to(room).emit(event, payload);
}

/** matchmaking:matched — sent to a user's room when they are paired. */
export function emitMatchmakingMatched(userId: string, matchId: string): void {
  emit(userRoom(userId), "matchmaking:matched", { matchId });
}

/** match:update — match row changed (status / turn / deadline). */
export function emitMatchUpdate(
  matchId: string,
  payload: Record<string, unknown>,
): void {
  emit(matchRoom(matchId), "match:update", { matchId, ...payload });
}

/** match:move — a new move landed on a match. */
export function emitMatchMove(
  matchId: string,
  payload: Record<string, unknown>,
): void {
  emit(matchRoom(matchId), "match:move", { matchId, ...payload });
}

/** match:event — a match_events row was inserted. */
export function emitMatchEvent(
  matchId: string,
  payload: Record<string, unknown>,
): void {
  emit(matchRoom(matchId), "match:event", { matchId, ...payload });
}

/** notification:new — a notification row was created for a user. */
export function emitNotification(userId: string, payload: unknown): void {
  emit(userRoom(userId), "notification:new", payload);
}

/** friend:event — a friend request / acceptance / removal targeting a user. */
export function emitFriendEvent(userId: string, payload: unknown): void {
  emit(userRoom(userId), "friend:event", payload);
}
