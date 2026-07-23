/**
 * Navixa — idempotent development seed.
 *
 * Ported from the Supabase seed.sql (DEV / PREVIEW ONLY). All inserts use
 * onConflictDoNothing (or targeted upserts) so seedDatabase() is safe to call
 * on every boot in development.
 *
 * User ids are Clerk-style TEXT (e.g. "user_demo_01"). These demo accounts are
 * NOT real Clerk users — they exist only so the app has data to render locally.
 * Do NOT run this against production.
 */
import { and, eq, sql } from "drizzle-orm";

import { db } from "./index";
import {
  achievementsTable,
  appConfigTable,
  bannedUsernamesTable,
  cosmeticItemsTable,
  dailyQuestsTable,
  friendRequestsTable,
  friendshipsTable,
  profilesTable,
  ratingsTable,
  userAchievementsTable,
  userInventoryTable,
  userQuestsTable,
  userSettingsTable,
} from "./schema";

interface DemoPlayer {
  id: string;
  username: string;
  displayName: string;
  country: string;
  locale: string;
  rating: number;
  wins: number;
  losses: number;
}

const DEMO_PLAYERS: DemoPlayer[] = [
  { id: "user_demo_01", username: "nordic_ace", displayName: "Nordic Ace", country: "SE", locale: "sv", rating: 2145, wins: 210, losses: 90 },
  { id: "user_demo_02", username: "kapten_kalle", displayName: "Kapten Kalle", country: "SE", locale: "sv", rating: 1980, wins: 150, losses: 110 },
  { id: "user_demo_03", username: "sjoslag_sara", displayName: "Sjoslag Sara", country: "SE", locale: "sv", rating: 1810, wins: 88, losses: 70 },
  { id: "user_demo_04", username: "oslo_orca", displayName: "Oslo Orca", country: "NO", locale: "en", rating: 2260, wins: 300, losses: 120 },
  { id: "user_demo_05", username: "helsinki_hydra", displayName: "Helsinki Hydra", country: "FI", locale: "en", rating: 1725, wins: 60, losses: 62 },
  { id: "user_demo_06", username: "copenhagen_cove", displayName: "Copenhagen Cove", country: "DK", locale: "en", rating: 1555, wins: 40, losses: 55 },
  { id: "user_demo_07", username: "london_leviathan", displayName: "London Leviathan", country: "GB", locale: "en", rating: 2410, wins: 402, losses: 150 },
  { id: "user_demo_08", username: "berlin_barracuda", displayName: "Berlin Barracuda", country: "DE", locale: "en", rating: 2050, wins: 175, losses: 130 },
  { id: "user_demo_09", username: "paris_privateer", displayName: "Paris Privateer", country: "FR", locale: "en", rating: 1890, wins: 120, losses: 95 },
  { id: "user_demo_10", username: "madrid_mariner", displayName: "Madrid Mariner", country: "ES", locale: "en", rating: 1420, wins: 30, losses: 48 },
  { id: "user_demo_11", username: "roma_reef", displayName: "Roma Reef", country: "IT", locale: "en", rating: 1660, wins: 55, losses: 60 },
  { id: "user_demo_12", username: "nyc_nautilus", displayName: "NYC Nautilus", country: "US", locale: "en", rating: 2320, wins: 340, losses: 140 },
  { id: "user_demo_13", username: "texas_torpedo", displayName: "Texas Torpedo", country: "US", locale: "en", rating: 1770, wins: 92, losses: 88 },
  { id: "user_demo_14", username: "toronto_tide", displayName: "Toronto Tide", country: "CA", locale: "en", rating: 1610, wins: 48, losses: 52 },
  { id: "user_demo_15", username: "saopaulo_swell", displayName: "Sao Paulo Swell", country: "BR", locale: "en", rating: 1980, wins: 160, losses: 120 },
  { id: "user_demo_16", username: "tokyo_typhoon", displayName: "Tokyo Typhoon", country: "JP", locale: "en", rating: 2500, wins: 480, losses: 160 },
  { id: "user_demo_17", username: "seoul_squall", displayName: "Seoul Squall", country: "KR", locale: "en", rating: 2180, wins: 240, losses: 130 },
  { id: "user_demo_18", username: "sydney_surge", displayName: "Sydney Surge", country: "AU", locale: "en", rating: 1345, wins: 22, losses: 40 },
  { id: "user_demo_19", username: "mumbai_monsoon", displayName: "Mumbai Monsoon", country: "IN", locale: "en", rating: 1500, wins: 35, losses: 45 },
  { id: "user_demo_20", username: "cape_current", displayName: "Cape Current", country: "ZA", locale: "en", rating: 1290, wins: 15, losses: 33 },
];

const COSMETIC_ITEMS = [
  { code: "theme_classic", type: "board_theme", rarity: "common", nameKey: "cosmetic.theme_classic.name", descriptionKey: "cosmetic.theme_classic.desc", priceCoins: 0, priceCents: null, isDefault: true, sortOrder: 0 },
  { code: "theme_neon", type: "board_theme", rarity: "rare", nameKey: "cosmetic.theme_neon.name", descriptionKey: "cosmetic.theme_neon.desc", priceCoins: 500, priceCents: null, isDefault: false, sortOrder: 1 },
  { code: "theme_abyss", type: "board_theme", rarity: "epic", nameKey: "cosmetic.theme_abyss.name", descriptionKey: "cosmetic.theme_abyss.desc", priceCoins: null, priceCents: 299, isDefault: false, sortOrder: 2 },
  { code: "ship_wooden", type: "ship_skin", rarity: "common", nameKey: "cosmetic.ship_wooden.name", descriptionKey: "cosmetic.ship_wooden.desc", priceCoins: 0, priceCents: null, isDefault: true, sortOrder: 0 },
  { code: "ship_ironclad", type: "ship_skin", rarity: "rare", nameKey: "cosmetic.ship_ironclad.name", descriptionKey: "cosmetic.ship_ironclad.desc", priceCoins: 750, priceCents: null, isDefault: false, sortOrder: 1 },
  { code: "ship_stealth", type: "ship_skin", rarity: "legendary", nameKey: "cosmetic.ship_stealth.name", descriptionKey: "cosmetic.ship_stealth.desc", priceCoins: null, priceCents: 499, isDefault: false, sortOrder: 2 },
  { code: "frame_gold", type: "avatar_frame", rarity: "epic", nameKey: "cosmetic.frame_gold.name", descriptionKey: "cosmetic.frame_gold.desc", priceCoins: 1200, priceCents: null, isDefault: false, sortOrder: 0 },
  { code: "emote_ggwp", type: "emote", rarity: "common", nameKey: "cosmetic.emote_ggwp.name", descriptionKey: "cosmetic.emote_ggwp.desc", priceCoins: 100, priceCents: null, isDefault: false, sortOrder: 0 },
  { code: "victory_fireworks", type: "victory_effect", rarity: "epic", nameKey: "cosmetic.victory_fireworks.name", descriptionKey: "cosmetic.victory_fireworks.desc", priceCoins: null, priceCents: 199, isDefault: false, sortOrder: 0 },
  { code: "title_admiral", type: "title", rarity: "legendary", nameKey: "cosmetic.title_admiral.name", descriptionKey: "cosmetic.title_admiral.desc", priceCoins: 2000, priceCents: null, isDefault: false, sortOrder: 0 },
] as const;

const ACHIEVEMENTS = [
  { code: "first_blood", titleKey: "achievement.first_blood.title", descriptionKey: "achievement.first_blood.desc", category: "combat", points: 10, metric: "hits", goal: 1 },
  { code: "first_win", titleKey: "achievement.first_win.title", descriptionKey: "achievement.first_win.desc", category: "progress", points: 20, metric: "wins", goal: 1 },
  { code: "ten_wins", titleKey: "achievement.ten_wins.title", descriptionKey: "achievement.ten_wins.desc", category: "progress", points: 50, metric: "wins", goal: 10 },
  { code: "hundred_wins", titleKey: "achievement.hundred_wins.title", descriptionKey: "achievement.hundred_wins.desc", category: "progress", points: 200, metric: "wins", goal: 100 },
  { code: "sharpshooter", titleKey: "achievement.sharpshooter.title", descriptionKey: "achievement.sharpshooter.desc", category: "skill", points: 75, metric: "accuracy_pct", goal: 50 },
  { code: "flawless", titleKey: "achievement.flawless.title", descriptionKey: "achievement.flawless.desc", category: "skill", points: 100, metric: "flawless_wins", goal: 1 },
] as const;

const DAILY_QUESTS = [
  { code: "daily_play_3", period: "daily", titleKey: "quest.daily_play_3.title", descriptionKey: "quest.daily_play_3.desc", metric: "matches_played", goal: 3, rewardXp: 100, rewardCoins: 50 },
  { code: "daily_win_1", period: "daily", titleKey: "quest.daily_win_1.title", descriptionKey: "quest.daily_win_1.desc", metric: "wins", goal: 1, rewardXp: 150, rewardCoins: 75 },
  { code: "daily_hits_20", period: "daily", titleKey: "quest.daily_hits_20.title", descriptionKey: "quest.daily_hits_20.desc", metric: "hits", goal: 20, rewardXp: 120, rewardCoins: 60 },
  { code: "weekly_win_10", period: "weekly", titleKey: "quest.weekly_win_10.title", descriptionKey: "quest.weekly_win_10.desc", metric: "wins", goal: 10, rewardXp: 800, rewardCoins: 400 },
] as const;

const APP_CONFIG = [
  { key: "maintenance_mode", value: false, description: "When true, blocks new matches", isPublic: true },
  { key: "min_supported_version", value: "1.0.0", description: "Minimum client version", isPublic: true },
  { key: "matchmaking_enabled", value: true, description: "Global matchmaking toggle", isPublic: true },
  { key: "season", value: { id: 1, name: "Season 1" }, description: "Current ranked season", isPublic: true },
] as const;

const BANNED_USERNAMES = [
  { pattern: "admin", reason: "Impersonation of staff" },
  { pattern: "moderator", reason: "Impersonation of staff" },
  { pattern: "navixa", reason: "Impersonation of the brand" },
  { pattern: "support", reason: "Impersonation of staff" },
  { pattern: "nigger", reason: "Hate speech" },
  { pattern: "faggot", reason: "Hate speech" },
] as const;

const FRIEND_PAIRS: [string, string][] = [
  ["user_demo_01", "user_demo_02"],
  ["user_demo_01", "user_demo_03"],
  ["user_demo_04", "user_demo_07"],
  ["user_demo_12", "user_demo_13"],
  ["user_demo_16", "user_demo_17"],
];

/**
 * Seed development data. Idempotent — safe to call repeatedly.
 */
export async function seedDatabase(): Promise<void> {
  // ---- Catalog tables (safe in any non-production environment) ----
  await db.insert(cosmeticItemsTable).values([...COSMETIC_ITEMS]).onConflictDoNothing({ target: cosmeticItemsTable.code });
  await db.insert(achievementsTable).values([...ACHIEVEMENTS]).onConflictDoNothing({ target: achievementsTable.code });
  await db.insert(dailyQuestsTable).values([...DAILY_QUESTS]).onConflictDoNothing({ target: dailyQuestsTable.code });
  await db.insert(appConfigTable).values([...APP_CONFIG]).onConflictDoNothing({ target: appConfigTable.key });
  await db.insert(bannedUsernamesTable).values([...BANNED_USERNAMES]).onConflictDoNothing({ target: bannedUsernamesTable.pattern });

  // ---- Demo profiles + settings + ratings ----
  for (const d of DEMO_PLAYERS) {
    await db
      .insert(profilesTable)
      .values({
        id: d.id,
        username: d.username,
        displayName: d.displayName,
        countryCode: d.country,
        locale: d.locale,
        xp: d.wins * 25,
        level: Math.max(1, Math.floor(d.wins / 20) + 1),
      })
      .onConflictDoUpdate({
        target: profilesTable.id,
        set: {
          username: d.username,
          displayName: d.displayName,
          countryCode: d.country,
          locale: d.locale,
          xp: d.wins * 25,
          level: Math.max(1, Math.floor(d.wins / 20) + 1),
          deletedAt: null,
        },
      });

    await db.insert(userSettingsTable).values({ userId: d.id }).onConflictDoNothing();

    await db
      .insert(ratingsTable)
      .values({
        playerId: d.id,
        mode: "ranked",
        rating: d.rating,
        gamesPlayed: d.wins + d.losses,
        wins: d.wins,
        losses: d.losses,
        bestRating: d.rating + 40,
      })
      .onConflictDoNothing({
        target: [ratingsTable.playerId, ratingsTable.mode],
      });
  }

  // ---- Friendships (canonical user_a < user_b) ----
  for (const [a, b] of FRIEND_PAIRS) {
    const [ua, ub] = a < b ? [a, b] : [b, a];
    await db
      .insert(friendshipsTable)
      .values({ userA: ua, userB: ub })
      .onConflictDoNothing({
        target: [friendshipsTable.userA, friendshipsTable.userB],
      });
  }

  // ---- A pending friend request ----
  const existingReq = await db
    .select({ id: friendRequestsTable.id })
    .from(friendRequestsTable)
    .where(
      and(
        eq(friendRequestsTable.senderId, "user_demo_05"),
        eq(friendRequestsTable.receiverId, "user_demo_06"),
        eq(friendRequestsTable.status, "pending"),
      ),
    )
    .limit(1);
  if (existingReq.length === 0) {
    await db.insert(friendRequestsTable).values({
      senderId: "user_demo_05",
      receiverId: "user_demo_06",
      status: "pending",
      message: "GG earlier, add me?",
    });
  }

  // ---- Grant default cosmetics to all demo players + equip them ----
  const defaultItems = await db
    .select({ id: cosmeticItemsTable.id })
    .from(cosmeticItemsTable)
    .where(eq(cosmeticItemsTable.isDefault, true));
  for (const d of DEMO_PLAYERS) {
    for (const item of defaultItems) {
      await db
        .insert(userInventoryTable)
        .values({ userId: d.id, itemId: item.id, source: "default" })
        .onConflictDoNothing({
          target: [userInventoryTable.userId, userInventoryTable.itemId],
        });
    }
  }

  // ---- Give the top player a couple of premium cosmetics ----
  const premium = await db
    .select({ id: cosmeticItemsTable.id })
    .from(cosmeticItemsTable)
    .where(
      sql`${cosmeticItemsTable.code} in ('theme_abyss', 'title_admiral', 'frame_gold')`,
    );
  for (const item of premium) {
    await db
      .insert(userInventoryTable)
      .values({ userId: "user_demo_16", itemId: item.id, source: "grant" })
      .onConflictDoNothing({
        target: [userInventoryTable.userId, userInventoryTable.itemId],
      });
  }

  // ---- A couple of achievement unlocks for the top player ----
  const unlockedAchievements = await db
    .select({ id: achievementsTable.id, goal: achievementsTable.goal })
    .from(achievementsTable)
    .where(
      sql`${achievementsTable.code} in ('first_blood', 'first_win', 'ten_wins', 'hundred_wins')`,
    );
  for (const a of unlockedAchievements) {
    await db
      .insert(userAchievementsTable)
      .values({
        userId: "user_demo_16",
        achievementId: a.id,
        progress: a.goal ?? 1,
        unlocked: true,
      })
      .onConflictDoNothing({
        target: [
          userAchievementsTable.userId,
          userAchievementsTable.achievementId,
        ],
      });
  }

  // ---- One in-progress user quest ----
  const playQuest = await db
    .select({ id: dailyQuestsTable.id })
    .from(dailyQuestsTable)
    .where(eq(dailyQuestsTable.code, "daily_play_3"))
    .limit(1);
  if (playQuest.length > 0) {
    await db
      .insert(userQuestsTable)
      .values({
        userId: "user_demo_01",
        questId: playQuest[0].id,
        progress: 1,
        status: "in_progress",
      })
      .onConflictDoNothing({
        target: [
          userQuestsTable.userId,
          userQuestsTable.questId,
          userQuestsTable.questDate,
        ],
      });
  }
}
