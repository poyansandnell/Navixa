import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { friendRequestStatusEnum, reportStatusEnum } from "./enums";
import { profilesTable } from "./profiles";

// -----------------------------------------------------------------------------
// friend_requests — directional invite
// -----------------------------------------------------------------------------
export const friendRequestsTable = pgTable(
  "friend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: text("sender_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    status: friendRequestStatusEnum("status").notNull().default("pending"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("friend_requests_pending_key")
      .on(t.senderId, t.receiverId)
      .where(sql`${t.status} = 'pending'`),
    index("friend_requests_receiver_idx").on(t.receiverId, t.status),
    index("friend_requests_sender_idx").on(t.senderId, t.status),
    check(
      "friend_requests_not_self_chk",
      sql`${t.senderId} <> ${t.receiverId}`,
    ),
    check(
      "friend_requests_message_len_chk",
      sql`${t.message} is null or char_length(${t.message}) <= 280`,
    ),
  ],
);

export const insertFriendRequestSchema = createInsertSchema(
  friendRequestsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFriendRequest = z.infer<typeof insertFriendRequestSchema>;
export type FriendRequest = typeof friendRequestsTable.$inferSelect;

// -----------------------------------------------------------------------------
// friendships — accepted friendships (canonical: user_a < user_b)
// -----------------------------------------------------------------------------
export const friendshipsTable = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userA: text("user_a")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    userB: text("user_b")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("friendships_pair_key").on(t.userA, t.userB),
    index("friendships_user_a_idx").on(t.userA),
    index("friendships_user_b_idx").on(t.userB),
    check("friendships_order_chk", sql`${t.userA} < ${t.userB}`),
  ],
);

export const insertFriendshipSchema = createInsertSchema(friendshipsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type Friendship = typeof friendshipsTable.$inferSelect;

// -----------------------------------------------------------------------------
// blocks — one user blocking another
// -----------------------------------------------------------------------------
export const blocksTable = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("blocks_pair_key").on(t.blockerId, t.blockedId),
    index("blocks_blocked_idx").on(t.blockedId),
    check("blocks_not_self_chk", sql`${t.blockerId} <> ${t.blockedId}`),
  ],
);

export const insertBlockSchema = createInsertSchema(blocksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocksTable.$inferSelect;

// -----------------------------------------------------------------------------
// reports — user-generated abuse reports.
// match_id references matches (FK added at the DB level in the matches domain;
// kept as a plain uuid column here to avoid a circular import).
// -----------------------------------------------------------------------------
export const reportsTable = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    reportedId: text("reported_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    matchId: uuid("match_id"),
    category: text("category").notNull(),
    description: text("description"),
    status: reportStatusEnum("status").notNull().default("open"),
    handledBy: text("handled_by").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("reports_reported_idx").on(t.reportedId),
    index("reports_status_idx").on(t.status),
    check("reports_not_self_chk", sql`${t.reporterId} <> ${t.reportedId}`),
    check(
      "reports_category_chk",
      sql`${t.category} in ('harassment', 'cheating', 'inappropriate_name', 'spam', 'other')`,
    ),
    check(
      "reports_desc_len_chk",
      sql`${t.description} is null or char_length(${t.description}) <= 2000`,
    ),
  ],
);

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
