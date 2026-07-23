/**
 * Socket.IO server, mounted on the same HTTP server at path /api/socket.io.
 *
 * Auth: the client sends a Clerk session JWT in handshake.auth.token. We verify
 * it with verifyToken() and pin the socket to the resulting userId. Sockets join
 * their own user room automatically; they may subscribe to a match room only if
 * they are a participant (or the match is finished/public).
 */
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyToken } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, matchesTable, matchPlayersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { registerIo, userRoom, matchRoom } from "./emitter";

interface SocketData {
  userId: string;
}

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/api/socket.io",
    cors: {
      origin: process.env.CLIENT_ORIGIN?.split(",") ?? true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "") ?? undefined);
      if (!token) return next(new Error("unauthorized"));
      const claims = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      if (!claims.sub) return next(new Error("unauthorized"));
      (socket.data as SocketData).userId = claims.sub;
      next();
    } catch (err) {
      logger.warn({ err }, "socket auth failed");
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket.data as SocketData).userId;
    void socket.join(userRoom(userId));

    socket.on("match:subscribe", async (raw: unknown, ack?: (r: unknown) => void) => {
      const matchId =
        typeof raw === "string"
          ? raw
          : (raw as { matchId?: string } | null)?.matchId;
      if (!matchId) {
        ack?.({ ok: false, error: "matchId required" });
        return;
      }
      try {
        const [match] = await db
          .select({ status: matchesTable.status })
          .from(matchesTable)
          .where(eq(matchesTable.id, matchId))
          .limit(1);
        if (!match) {
          ack?.({ ok: false, error: "match not found" });
          return;
        }
        const isFinished = ["finished", "abandoned", "cancelled"].includes(match.status);
        if (!isFinished) {
          const players = await db
            .select({ playerId: matchPlayersTable.playerId })
            .from(matchPlayersTable)
            .where(eq(matchPlayersTable.matchId, matchId));
          const isParticipant = players.some((p) => p.playerId === userId);
          if (!isParticipant) {
            ack?.({ ok: false, error: "forbidden" });
            return;
          }
        }
        void socket.join(matchRoom(matchId));
        ack?.({ ok: true });
      } catch (err) {
        logger.error({ err, matchId }, "match:subscribe failed");
        ack?.({ ok: false, error: "internal" });
      }
    });

    socket.on("match:unsubscribe", (raw: unknown, ack?: (r: unknown) => void) => {
      const matchId =
        typeof raw === "string"
          ? raw
          : (raw as { matchId?: string } | null)?.matchId;
      if (matchId) void socket.leave(matchRoom(matchId));
      ack?.({ ok: true });
    });
  });

  registerIo(io);
  logger.info("socket.io attached at /api/socket.io");
  return io;
}
