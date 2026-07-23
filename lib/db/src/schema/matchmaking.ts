import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { matchModeEnum, queueStatusEnum } from "./enums";
import { matchesTable } from "./matches";
import { profilesTable } from "./profiles";

// -----------------------------------------------------------------------------
// matchmaking_queue — pending players looking for a game
// -----------------------------------------------------------------------------
export const matchmakingQueueTable = pgTable(
  "matchmaking_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: text("player_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    mode: matchModeEnum("mode").notNull().default("ranked"),
    rating: integer("rating").notNull().default(1200),
    region: text("region"),
    boardSize: smallint("board_size").notNull().default(10),
    status: queueStatusEnum("status").notNull().default("searching"),
    matchedMatchId: uuid("matched_match_id").references(() => matchesTable.id, {
      onDelete: "set null",
    }),
    enqueuedAt: timestamp("enqueued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`(now() + interval '5 minutes')`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("mmq_active_player_key")
      .on(t.playerId, t.mode)
      .where(sql`${t.status} = 'searching'`),
    index("mmq_search_idx")
      .on(t.mode, t.status, t.rating)
      .where(sql`${t.status} = 'searching'`),
    check("mmq_board_size_chk", sql`${t.boardSize} between 8 and 16`),
  ],
);

export const insertMatchmakingQueueSchema = createInsertSchema(
  matchmakingQueueTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMatchmakingQueue = z.infer<
  typeof insertMatchmakingQueueSchema
>;
export type MatchmakingQueue = typeof matchmakingQueueTable.$inferSelect;
