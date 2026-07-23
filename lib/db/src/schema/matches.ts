import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { matchModeEnum, matchResultEnum, matchStatusEnum } from "./enums";
import { profilesTable } from "./profiles";

// -----------------------------------------------------------------------------
// Board / shot JSONB shapes (mirror the game-engine types). Kept structural
// here to avoid a hard dependency on @workspace/game-engine from the db lib.
// -----------------------------------------------------------------------------
export interface BoardPlacement {
  id: string;
  length: number;
  origin: { x: number; y: number };
  orientation: "horizontal" | "vertical";
}
export type BoardState = BoardPlacement[];

export interface ShotRecord {
  index: number;
  by: string;
  coord: { x: number; y: number };
  result: "miss" | "hit" | "sunk";
  sunkShip?: string;
}

// -----------------------------------------------------------------------------
// matches — public metadata for a game
// -----------------------------------------------------------------------------
export const matchesTable = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mode: matchModeEnum("mode").notNull().default("ranked"),
    status: matchStatusEnum("status").notNull().default("pending"),
    boardSize: smallint("board_size").notNull().default(10),
    ruleset: text("ruleset").notNull().default("classic"),
    tournamentMatchId: uuid("tournament_match_id"),
    currentTurnPlayerId: text("current_turn_player_id").references(
      () => profilesTable.id,
      { onDelete: "set null" },
    ),
    turnNumber: integer("turn_number").notNull().default(0),
    winnerId: text("winner_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    isRated: boolean("is_rated").notNull().default(true),
    isPrivate: boolean("is_private").notNull().default(false),
    turnSeconds: integer("turn_seconds").notNull().default(60),
    // edge-function support columns
    inviteCode: text("invite_code"),
    turnDeadline: timestamp("turn_deadline", { withTimezone: true }),
    currentTurnSeat: smallint("current_turn_seat"),
    // annul support columns
    annulledAt: timestamp("annulled_at", { withTimezone: true }),
    annulledBy: text("annulled_by").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    annulReason: text("annul_reason"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("matches_status_idx").on(t.status),
    index("matches_mode_idx").on(t.mode),
    index("matches_created_idx").on(t.createdAt.desc()),
    index("matches_winner_idx").on(t.winnerId),
    uniqueIndex("matches_invite_code_key")
      .on(t.inviteCode)
      .where(
        sql`${t.inviteCode} is not null and ${t.status} in ('pending', 'placing')`,
      ),
    check("matches_board_size_chk", sql`${t.boardSize} between 8 and 16`),
    check(
      "matches_turn_seconds_chk",
      sql`${t.turnSeconds} between 10 and 600`,
    ),
    check("matches_turn_number_chk", sql`${t.turnNumber} >= 0`),
    check(
      "matches_current_turn_seat_chk",
      sql`${t.currentTurnSeat} is null or ${t.currentTurnSeat} in (0, 1)`,
    ),
  ],
);

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;

// -----------------------------------------------------------------------------
// match_players — participants (2 per match, but table generalised)
// -----------------------------------------------------------------------------
export const matchPlayersTable = pgTable(
  "match_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matchesTable.id, { onDelete: "cascade" }),
    playerId: text("player_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    seat: smallint("seat").notNull(),
    isReady: boolean("is_ready").notNull().default(false),
    result: matchResultEnum("result"),
    ratingBefore: integer("rating_before"),
    ratingAfter: integer("rating_after"),
    ratingDelta: integer("rating_delta"),
    shotsFired: integer("shots_fired").notNull().default(0),
    hits: integer("hits").notNull().default(0),
    shipsSunk: integer("ships_sunk").notNull().default(0),
    forfeited: boolean("forfeited").notNull().default(false),
    // edge-function support columns
    timeLeftMs: integer("time_left_ms"),
    isBot: boolean("is_bot").notNull().default(false),
    botDifficulty: text("bot_difficulty"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("match_players_match_seat_key").on(t.matchId, t.seat),
    uniqueIndex("match_players_match_player_key")
      .on(t.matchId, t.playerId)
      .where(sql`${t.playerId} is not null`),
    index("match_players_player_idx").on(t.playerId),
    check("match_players_seat_chk", sql`${t.seat} between 0 and 1`),
    check(
      "match_players_stats_chk",
      sql`${t.shotsFired} >= 0 and ${t.hits} >= 0 and ${t.shipsSunk} >= 0`,
    ),
    check(
      "match_players_bot_difficulty_chk",
      sql`${t.botDifficulty} is null or ${t.botDifficulty} in ('beginner', 'normal', 'expert')`,
    ),
  ],
);

export const insertMatchPlayerSchema = createInsertSchema(
  matchPlayersTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMatchPlayer = z.infer<typeof insertMatchPlayerSchema>;
export type MatchPlayer = typeof matchPlayersTable.$inferSelect;

// -----------------------------------------------------------------------------
// private_game_states — SECRET per-player board.
// player_id is nullable (bot seats have no profile row).
// -----------------------------------------------------------------------------
export const privateGameStatesTable = pgTable(
  "private_game_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matchesTable.id, { onDelete: "cascade" }),
    playerId: text("player_id").references(() => profilesTable.id, {
      onDelete: "cascade",
    }),
    board: jsonb("board").$type<BoardState>().notNull(),
    shotsReceived: jsonb("shots_received")
      .$type<ShotRecord[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    boardHash: text("board_hash"),
    salt: text("salt"),
    // edge-function support columns
    fleetSubmitted: boolean("fleet_submitted").notNull().default(true),
    seat: smallint("seat"),
    isBot: boolean("is_bot").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("private_game_states_key").on(t.matchId, t.playerId),
    uniqueIndex("private_game_states_seat_key")
      .on(t.matchId, t.seat)
      .where(sql`${t.seat} is not null`),
  ],
);

export const insertPrivateGameStateSchema = createInsertSchema(
  privateGameStatesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrivateGameState = z.infer<
  typeof insertPrivateGameStateSchema
>;
export type PrivateGameState = typeof privateGameStatesTable.$inferSelect;

// -----------------------------------------------------------------------------
// match_moves — every shot
// -----------------------------------------------------------------------------
export const matchMovesTable = pgTable(
  "match_moves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matchesTable.id, { onDelete: "cascade" }),
    playerId: text("player_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    moveNumber: integer("move_number").notNull(),
    targetX: smallint("target_x").notNull(),
    targetY: smallint("target_y").notNull(),
    isHit: boolean("is_hit").notNull().default(false),
    sunkShip: text("sunk_ship"),
    // edge-function support column
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("match_moves_number_key").on(t.matchId, t.moveNumber),
    index("match_moves_match_idx").on(t.matchId, t.moveNumber),
    index("match_moves_player_idx").on(t.playerId),
    uniqueIndex("match_moves_idem_key")
      .on(t.matchId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    check(
      "match_moves_coords_chk",
      sql`${t.targetX} >= 0 and ${t.targetY} >= 0`,
    ),
    check("match_moves_number_chk", sql`${t.moveNumber} >= 0`),
  ],
);

export const insertMatchMoveSchema = createInsertSchema(matchMovesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMatchMove = z.infer<typeof insertMatchMoveSchema>;
export type MatchMove = typeof matchMovesTable.$inferSelect;

// -----------------------------------------------------------------------------
// match_events — audit/timeline
// -----------------------------------------------------------------------------
export const matchEventsTable = pgTable(
  "match_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matchesTable.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("match_events_match_idx").on(t.matchId, t.createdAt)],
);

export const insertMatchEventSchema = createInsertSchema(matchEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMatchEvent = z.infer<typeof insertMatchEventSchema>;
export type MatchEvent = typeof matchEventsTable.$inferSelect;
