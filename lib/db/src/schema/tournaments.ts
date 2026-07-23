import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
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

import {
  matchModeEnum,
  matchStatusEnum,
  tournamentFormatEnum,
  tournamentStatusEnum,
} from "./enums";
import { matchesTable } from "./matches";
import { profilesTable } from "./profiles";

// -----------------------------------------------------------------------------
// tournaments
// -----------------------------------------------------------------------------
export const tournamentsTable = pgTable(
  "tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    format: tournamentFormatEnum("format")
      .notNull()
      .default("single_elimination"),
    status: tournamentStatusEnum("status").notNull().default("draft"),
    mode: matchModeEnum("mode").notNull().default("tournament"),
    maxPlayers: integer("max_players").notNull().default(16),
    minPlayers: integer("min_players").notNull().default(2),
    boardSize: smallint("board_size").notNull().default(10),
    entryFeeCoins: integer("entry_fee_coins").notNull().default(0),
    prizePool: jsonb("prize_pool")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdBy: text("created_by").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    registrationOpensAt: timestamp("registration_opens_at", {
      withTimezone: true,
    }),
    registrationClosesAt: timestamp("registration_closes_at", {
      withTimezone: true,
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
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
    index("tournaments_status_idx").on(t.status),
    index("tournaments_starts_idx").on(t.startsAt),
    check(
      "tournaments_players_chk",
      sql`${t.maxPlayers} >= ${t.minPlayers} and ${t.minPlayers} >= 2`,
    ),
    check("tournaments_board_chk", sql`${t.boardSize} between 8 and 16`),
    check("tournaments_fee_chk", sql`${t.entryFeeCoins} >= 0`),
  ],
);

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;

// -----------------------------------------------------------------------------
// tournament_entries — registered players
// -----------------------------------------------------------------------------
export const tournamentEntriesTable = pgTable(
  "tournament_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournamentsTable.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    seed: integer("seed"),
    finalRank: integer("final_rank"),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    eliminated: boolean("eliminated").notNull().default(false),
    registeredAt: timestamp("registered_at", { withTimezone: true })
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
    uniqueIndex("tournament_entries_key").on(t.tournamentId, t.playerId),
    index("tournament_entries_tournament_idx").on(t.tournamentId),
  ],
);

export const insertTournamentEntrySchema = createInsertSchema(
  tournamentEntriesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTournamentEntry = z.infer<typeof insertTournamentEntrySchema>;
export type TournamentEntry = typeof tournamentEntriesTable.$inferSelect;

// -----------------------------------------------------------------------------
// tournament_rounds
// -----------------------------------------------------------------------------
export const tournamentRoundsTable = pgTable(
  "tournament_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournamentsTable.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    name: text("name"),
    status: tournamentStatusEnum("status").notNull().default("upcoming"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("tournament_rounds_key").on(t.tournamentId, t.roundNumber),
    check("tournament_rounds_number_chk", sql`${t.roundNumber} >= 1`),
  ],
);

export const insertTournamentRoundSchema = createInsertSchema(
  tournamentRoundsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTournamentRound = z.infer<typeof insertTournamentRoundSchema>;
export type TournamentRound = typeof tournamentRoundsTable.$inferSelect;

// -----------------------------------------------------------------------------
// tournament_matches — bracket slots
// -----------------------------------------------------------------------------
export const tournamentMatchesTable = pgTable(
  "tournament_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournamentsTable.id, { onDelete: "cascade" }),
    roundId: uuid("round_id")
      .notNull()
      .references(() => tournamentRoundsTable.id, { onDelete: "cascade" }),
    bracketPosition: integer("bracket_position").notNull(),
    matchId: uuid("match_id").references(() => matchesTable.id, {
      onDelete: "set null",
    }),
    playerOneId: text("player_one_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    playerTwoId: text("player_two_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    winnerId: text("winner_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    nextMatchId: uuid("next_match_id").references(
      (): AnyPgColumn => tournamentMatchesTable.id,
      { onDelete: "set null" },
    ),
    nextSlot: smallint("next_slot"),
    status: matchStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("tournament_matches_slot_key").on(
      t.roundId,
      t.bracketPosition,
    ),
    index("tournament_matches_tournament_idx").on(t.tournamentId),
    index("tournament_matches_match_idx").on(t.matchId),
    check("tm_bracket_pos_chk", sql`${t.bracketPosition} >= 1`),
    check(
      "tm_next_slot_chk",
      sql`${t.nextSlot} is null or ${t.nextSlot} in (1, 2)`,
    ),
  ],
);

export const insertTournamentMatchSchema = createInsertSchema(
  tournamentMatchesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTournamentMatch = z.infer<typeof insertTournamentMatchSchema>;
export type TournamentMatch = typeof tournamentMatchesTable.$inferSelect;
