import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { moderationActionTypeEnum } from "./enums";
import { profilesTable } from "./profiles";
import { reportsTable } from "./social";

// -----------------------------------------------------------------------------
// moderation_actions — admin actions taken against users
// -----------------------------------------------------------------------------
export const moderationActionsTable = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetId: text("target_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    reportId: uuid("report_id").references(() => reportsTable.id, {
      onDelete: "set null",
    }),
    action: moderationActionTypeEnum("action").notNull(),
    reason: text("reason"),
    notes: text("notes"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
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
    index("moderation_actions_target_idx").on(t.targetId),
    index("moderation_actions_active_idx")
      .on(t.targetId)
      .where(sql`${t.isActive} = true`),
  ],
);

export const insertModerationActionSchema = createInsertSchema(
  moderationActionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertModerationAction = z.infer<
  typeof insertModerationActionSchema
>;
export type ModerationAction = typeof moderationActionsTable.$inferSelect;

// -----------------------------------------------------------------------------
// audit_logs — append-only record of privileged/security events
// -----------------------------------------------------------------------------
export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_logs_actor_idx").on(t.actorId, t.createdAt.desc()),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_action_idx").on(t.action, t.createdAt.desc()),
  ],
);

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;

// -----------------------------------------------------------------------------
// app_config — server-side feature flags & tunables (key/value)
// -----------------------------------------------------------------------------
export const appConfigTable = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAppConfigSchema = createInsertSchema(appConfigTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertAppConfig = z.infer<typeof insertAppConfigSchema>;
export type AppConfig = typeof appConfigTable.$inferSelect;

// -----------------------------------------------------------------------------
// banned_usernames — forbidden username substrings (case-insensitive).
// -----------------------------------------------------------------------------
export const bannedUsernamesTable = pgTable(
  "banned_usernames",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pattern: text("pattern").notNull(),
    reason: text("reason"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("banned_usernames_pattern_key").on(t.pattern),
    index("banned_usernames_active_idx")
      .on(t.isActive)
      .where(sql`${t.isActive} = true`),
  ],
);

export const insertBannedUsernameSchema = createInsertSchema(
  bannedUsernamesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBannedUsername = z.infer<typeof insertBannedUsernameSchema>;
export type BannedUsername = typeof bannedUsernamesTable.$inferSelect;
