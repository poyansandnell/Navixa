import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { devicePlatformEnum } from "./enums";

// -----------------------------------------------------------------------------
// profiles — public player identity, 1:1 with the Clerk user.
// id is the Clerk user id (TEXT, e.g. "user_abc123").
// -----------------------------------------------------------------------------
export const profilesTable = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    countryCode: char("country_code", { length: 2 }),
    locale: text("locale").notNull().default("en"),
    isAdmin: boolean("is_admin").notNull().default(false),
    isBot: boolean("is_bot").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
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
    uniqueIndex("profiles_username_key")
      .on(t.username)
      .where(sql`${t.deletedAt} is null`),
    index("profiles_country_idx").on(t.countryCode),
    index("profiles_last_seen_idx").on(t.lastSeenAt.desc()),
    check(
      "profiles_username_len_chk",
      sql`char_length(${t.username}) between 3 and 24`,
    ),
    check(
      "profiles_username_fmt_chk",
      sql`${t.username} ~ '^[a-zA-Z0-9_]+$'`,
    ),
    check(
      "profiles_country_chk",
      sql`${t.countryCode} is null or ${t.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    check("profiles_xp_chk", sql`${t.xp} >= 0`),
    check("profiles_level_chk", sql`${t.level} >= 1`),
  ],
);

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;

// -----------------------------------------------------------------------------
// user_settings — private per-user preferences (1:1)
// -----------------------------------------------------------------------------
export const userSettingsTable = pgTable(
  "user_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    theme: text("theme").notNull().default("system"),
    soundEnabled: boolean("sound_enabled").notNull().default(true),
    musicEnabled: boolean("music_enabled").notNull().default(true),
    hapticsEnabled: boolean("haptics_enabled").notNull().default(true),
    notificationsEnabled: boolean("notifications_enabled")
      .notNull()
      .default(true),
    pushMatches: boolean("push_matches").notNull().default(true),
    pushTurns: boolean("push_turns").notNull().default(true),
    pushSocial: boolean("push_social").notNull().default(true),
    pushMarketing: boolean("push_marketing").notNull().default(false),
    showOnlineStatus: boolean("show_online_status").notNull().default(true),
    allowFriendRequests: boolean("allow_friend_requests")
      .notNull()
      .default(true),
    allowSpectators: boolean("allow_spectators").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "user_settings_theme_chk",
      sql`${t.theme} in ('system', 'light', 'dark')`,
    ),
  ],
);

export const insertUserSettingsSchema = createInsertSchema(
  userSettingsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettingsTable.$inferSelect;

// -----------------------------------------------------------------------------
// devices — known devices for a user
// -----------------------------------------------------------------------------
export const devicesTable = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    platform: devicePlatformEnum("platform").notNull(),
    deviceName: text("device_name"),
    osVersion: text("os_version"),
    appVersion: text("app_version"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
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
  (t) => [index("devices_user_idx").on(t.userId)],
);

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;

// -----------------------------------------------------------------------------
// push_tokens — Expo/FCM/APNs push tokens
// -----------------------------------------------------------------------------
export const pushTokensTable = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devicesTable.id, {
      onDelete: "set null",
    }),
    token: text("token").notNull(),
    platform: devicePlatformEnum("platform").notNull(),
    provider: text("provider").notNull().default("expo"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("push_tokens_token_key").on(t.token),
    index("push_tokens_user_idx")
      .on(t.userId)
      .where(sql`${t.isActive}`),
    check(
      "push_tokens_provider_chk",
      sql`${t.provider} in ('expo', 'fcm', 'apns')`,
    ),
  ],
);

export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokensTable.$inferSelect;
