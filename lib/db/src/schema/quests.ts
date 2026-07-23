import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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

import {
  cosmeticRarityEnum,
  cosmeticTypeEnum,
  questPeriodEnum,
  questStatusEnum,
} from "./enums";
import { profilesTable } from "./profiles";

// -----------------------------------------------------------------------------
// cosmetic_items — store catalog of cosmetics
// -----------------------------------------------------------------------------
export const cosmeticItemsTable = pgTable(
  "cosmetic_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    type: cosmeticTypeEnum("type").notNull(),
    rarity: cosmeticRarityEnum("rarity").notNull().default("common"),
    nameKey: text("name_key").notNull(),
    descriptionKey: text("description_key"),
    previewUrl: text("preview_url"),
    assetRef: text("asset_ref"),
    priceCoins: integer("price_coins"),
    priceCents: integer("price_cents"),
    isPurchasable: boolean("is_purchasable").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
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
    uniqueIndex("cosmetic_items_code_key").on(t.code),
    index("cosmetic_items_type_idx").on(t.type, t.sortOrder),
    check(
      "cosmetic_items_price_chk",
      sql`(${t.priceCoins} is null or ${t.priceCoins} >= 0) and (${t.priceCents} is null or ${t.priceCents} >= 0)`,
    ),
  ],
);

export const insertCosmeticItemSchema = createInsertSchema(
  cosmeticItemsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCosmeticItem = z.infer<typeof insertCosmeticItemSchema>;
export type CosmeticItem = typeof cosmeticItemsTable.$inferSelect;

// -----------------------------------------------------------------------------
// daily_quests — quest catalog (definitions)
// -----------------------------------------------------------------------------
export const dailyQuestsTable = pgTable(
  "daily_quests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    period: questPeriodEnum("period").notNull().default("daily"),
    titleKey: text("title_key").notNull(),
    descriptionKey: text("description_key").notNull(),
    metric: text("metric").notNull(),
    goal: integer("goal").notNull(),
    rewardXp: integer("reward_xp").notNull().default(0),
    rewardCoins: integer("reward_coins").notNull().default(0),
    rewardItemId: uuid("reward_item_id").references(
      () => cosmeticItemsTable.id,
      { onDelete: "set null" },
    ),
    isActive: boolean("is_active").notNull().default(true),
    activeFrom: date("active_from", { mode: "string" }),
    activeTo: date("active_to", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("daily_quests_code_key").on(t.code),
    index("daily_quests_active_idx").on(t.isActive, t.period),
    check("daily_quests_goal_chk", sql`${t.goal} >= 1`),
    check(
      "daily_quests_reward_chk",
      sql`${t.rewardXp} >= 0 and ${t.rewardCoins} >= 0`,
    ),
  ],
);

export const insertDailyQuestSchema = createInsertSchema(dailyQuestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDailyQuest = z.infer<typeof insertDailyQuestSchema>;
export type DailyQuest = typeof dailyQuestsTable.$inferSelect;

// -----------------------------------------------------------------------------
// achievements — achievement catalog
// -----------------------------------------------------------------------------
export const achievementsTable = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    titleKey: text("title_key").notNull(),
    descriptionKey: text("description_key").notNull(),
    icon: text("icon"),
    category: text("category").notNull().default("general"),
    points: integer("points").notNull().default(10),
    metric: text("metric"),
    goal: integer("goal"),
    isSecret: boolean("is_secret").notNull().default(false),
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
    uniqueIndex("achievements_code_key").on(t.code),
    check("achievements_points_chk", sql`${t.points} >= 0`),
  ],
);

export const insertAchievementSchema = createInsertSchema(
  achievementsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievementsTable.$inferSelect;

// -----------------------------------------------------------------------------
// user_quests — per-user quest progress
// -----------------------------------------------------------------------------
export const userQuestsTable = pgTable(
  "user_quests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    questId: uuid("quest_id")
      .notNull()
      .references(() => dailyQuestsTable.id, { onDelete: "cascade" }),
    questDate: date("quest_date", { mode: "string" })
      .notNull()
      .default(sql`current_date`),
    progress: integer("progress").notNull().default(0),
    status: questStatusEnum("status").notNull().default("in_progress"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("user_quests_key").on(t.userId, t.questId, t.questDate),
    index("user_quests_user_idx").on(t.userId, t.status),
    check("user_quests_progress_chk", sql`${t.progress} >= 0`),
  ],
);

export const insertUserQuestSchema = createInsertSchema(userQuestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserQuest = z.infer<typeof insertUserQuestSchema>;
export type UserQuest = typeof userQuestsTable.$inferSelect;

// -----------------------------------------------------------------------------
// user_achievements — unlocked achievements
// -----------------------------------------------------------------------------
export const userAchievementsTable = pgTable(
  "user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievementsTable.id, { onDelete: "cascade" }),
    progress: integer("progress").notNull().default(0),
    unlocked: boolean("unlocked").notNull().default(false),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("user_achievements_key").on(t.userId, t.achievementId),
    index("user_achievements_user_idx").on(t.userId),
    check("user_achievements_progress_chk", sql`${t.progress} >= 0`),
  ],
);

export const insertUserAchievementSchema = createInsertSchema(
  userAchievementsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievementsTable.$inferSelect;

// -----------------------------------------------------------------------------
// user_inventory — owned cosmetics
// -----------------------------------------------------------------------------
export const userInventoryTable = pgTable(
  "user_inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => cosmeticItemsTable.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("purchase"),
    acquiredAt: timestamp("acquired_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_inventory_key").on(t.userId, t.itemId),
    index("user_inventory_user_idx").on(t.userId),
    check(
      "user_inventory_source_chk",
      sql`${t.source} in ('purchase', 'reward', 'grant', 'default')`,
    ),
  ],
);

export const insertUserInventorySchema = createInsertSchema(
  userInventoryTable,
).omit({ id: true, createdAt: true });
export type InsertUserInventory = z.infer<typeof insertUserInventorySchema>;
export type UserInventory = typeof userInventoryTable.$inferSelect;

// -----------------------------------------------------------------------------
// equipped_cosmetics — which item is equipped per slot/type
// -----------------------------------------------------------------------------
export const equippedCosmeticsTable = pgTable(
  "equipped_cosmetics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    type: cosmeticTypeEnum("type").notNull(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => cosmeticItemsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("equipped_cosmetics_slot_key").on(t.userId, t.type)],
);

export const insertEquippedCosmeticSchema = createInsertSchema(
  equippedCosmeticsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEquippedCosmetic = z.infer<
  typeof insertEquippedCosmeticSchema
>;
export type EquippedCosmetic = typeof equippedCosmeticsTable.$inferSelect;
