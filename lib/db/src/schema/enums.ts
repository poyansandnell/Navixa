import { pgEnum } from "drizzle-orm/pg-core";

export const matchStatusEnum = pgEnum("match_status", [
  "pending",
  "placing",
  "active",
  "finished",
  "abandoned",
  "cancelled",
  "annulled",
]);

export const matchResultEnum = pgEnum("match_result", [
  "win",
  "loss",
  "draw",
  "aborted",
]);

export const matchModeEnum = pgEnum("match_mode", [
  "ranked",
  "casual",
  "friendly",
  "tournament",
  "bot",
]);

export const friendRequestStatusEnum = pgEnum("friend_request_status", [
  "pending",
  "accepted",
  "declined",
  "cancelled",
]);

export const queueStatusEnum = pgEnum("queue_status", [
  "searching",
  "matched",
  "cancelled",
  "expired",
]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "registration",
  "upcoming",
  "ongoing",
  "completed",
  "cancelled",
]);

export const tournamentFormatEnum = pgEnum("tournament_format", [
  "single_elimination",
  "double_elimination",
  "round_robin",
  "swiss",
]);

export const questPeriodEnum = pgEnum("quest_period", [
  "daily",
  "weekly",
  "event",
]);

export const questStatusEnum = pgEnum("quest_status", [
  "in_progress",
  "completed",
  "claimed",
  "expired",
]);

export const cosmeticTypeEnum = pgEnum("cosmetic_type", [
  "board_theme",
  "ship_skin",
  "avatar_frame",
  "emote",
  "victory_effect",
  "title",
  "flag",
]);

export const cosmeticRarityEnum = pgEnum("cosmetic_rarity", [
  "common",
  "rare",
  "epic",
  "legendary",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "friend_request",
  "friend_accepted",
  "match_found",
  "your_turn",
  "match_result",
  "tournament_start",
  "tournament_result",
  "quest_complete",
  "achievement_unlocked",
  "system",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "reviewing",
  "actioned",
  "dismissed",
]);

export const moderationActionTypeEnum = pgEnum("moderation_action_type", [
  "warn",
  "mute",
  "suspend",
  "ban",
  "shadow_ban",
  "unban",
  "note",
]);

export const devicePlatformEnum = pgEnum("device_platform", [
  "ios",
  "android",
  "web",
]);
