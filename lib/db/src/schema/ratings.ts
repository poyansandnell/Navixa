import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { matchModeEnum, matchResultEnum } from "./enums";
import { matchesTable } from "./matches";
import { profilesTable } from "./profiles";

// -----------------------------------------------------------------------------
// ratings — current rating per player per mode
// -----------------------------------------------------------------------------
export const ratingsTable = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: text("player_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    mode: matchModeEnum("mode").notNull().default("ranked"),
    rating: integer("rating").notNull().default(1200),
    rd: integer("rd").notNull().default(350),
    volatility: numeric("volatility", { precision: 6, scale: 5 })
      .notNull()
      .default("0.06000"),
    gamesPlayed: integer("games_played").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    winStreak: integer("win_streak").notNull().default(0),
    bestRating: integer("best_rating").notNull().default(1200),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("ratings_player_mode_key").on(t.playerId, t.mode),
    index("ratings_mode_rating_idx").on(t.mode, t.rating.desc()),
    check("ratings_rating_chk", sql`${t.rating} between 0 and 4000`),
    check(
      "ratings_counts_chk",
      sql`${t.gamesPlayed} >= 0 and ${t.wins} >= 0 and ${t.losses} >= 0 and ${t.draws} >= 0`,
    ),
  ],
);

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;

// -----------------------------------------------------------------------------
// rating_history — one row per rating change
// -----------------------------------------------------------------------------
export const ratingHistoryTable = pgTable(
  "rating_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: text("player_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    mode: matchModeEnum("mode").notNull().default("ranked"),
    matchId: uuid("match_id").references(() => matchesTable.id, {
      onDelete: "set null",
    }),
    ratingBefore: integer("rating_before").notNull(),
    ratingAfter: integer("rating_after").notNull(),
    ratingDelta: integer("rating_delta").notNull(),
    result: matchResultEnum("result"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rating_history_player_idx").on(t.playerId, t.createdAt.desc()),
    index("rating_history_match_idx").on(t.matchId),
  ],
);

export const insertRatingHistorySchema = createInsertSchema(
  ratingHistoryTable,
).omit({ id: true, createdAt: true });
export type InsertRatingHistory = z.infer<typeof insertRatingHistorySchema>;
export type RatingHistory = typeof ratingHistoryTable.$inferSelect;

// -----------------------------------------------------------------------------
// leaderboard_snapshots — periodic frozen rankings
// -----------------------------------------------------------------------------
export const leaderboardSnapshotsTable = pgTable(
  "leaderboard_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: text("scope").notNull().default("global"),
    mode: matchModeEnum("mode").notNull().default("ranked"),
    playerId: text("player_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    rating: integer("rating").notNull(),
    gamesPlayed: integer("games_played").notNull().default(0),
    snapshotDate: date("snapshot_date", { mode: "string" })
      .notNull()
      .default(sql`current_date`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("leaderboard_snapshot_key").on(
      t.snapshotDate,
      t.scope,
      t.mode,
      t.playerId,
    ),
    index("leaderboard_snapshot_rank_idx").on(
      t.snapshotDate,
      t.scope,
      t.mode,
      t.rank,
    ),
    check("leaderboard_rank_chk", sql`${t.rank} >= 1`),
  ],
);

export const insertLeaderboardSnapshotSchema = createInsertSchema(
  leaderboardSnapshotsTable,
).omit({ id: true, createdAt: true });
export type InsertLeaderboardSnapshot = z.infer<
  typeof insertLeaderboardSnapshotSchema
>;
export type LeaderboardSnapshot = typeof leaderboardSnapshotsTable.$inferSelect;
