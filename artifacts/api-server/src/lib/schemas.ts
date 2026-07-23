/** Zod schemas mirroring the Supabase edge function contracts. */
import { z } from "zod";

export const uuidSchema = z.string().uuid();

const shipIdSchema = z.enum([
  "carrier",
  "battleship",
  "cruiser",
  "submarine",
  "destroyer",
]);

const coordSchema = z.object({
  x: z.number().int().min(0).max(63),
  y: z.number().int().min(0).max(63),
});

const placementSchema = z.object({
  id: shipIdSchema,
  length: z.number().int().min(1).max(16),
  origin: coordSchema,
  orientation: z.enum(["horizontal", "vertical"]),
});

export const fleetSchema = z.array(placementSchema).min(1).max(16);

const modeSchema = z.enum(["ranked", "casual", "friendly", "tournament", "bot"]);
const tempoSchema = z.enum(["blitz", "daily"]);
const boardSizeSchema = z.number().int().min(8).max(16).default(10);
const turnSecondsSchema = z.number().int().min(10).max(86400).default(60);

/** Turn duration in seconds implied by a tempo. */
export const TEMPO_TURN_SECONDS: Record<"blitz" | "daily", number> = {
  blitz: 60,
  daily: 86400,
};

// --- Profile ---------------------------------------------------------------
export const bootstrapProfileSchema = z.object({
  username: z.string().trim().min(3).max(24),
  displayName: z.string().trim().min(1).max(48).optional(),
  locale: z.string().trim().min(2).max(8).optional(),
  // Optional; when omitted the server reads it from the Clerk session claims.
  email: z.string().email().max(320).optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(48).optional(),
  bio: z.string().max(500).nullish(),
  avatarUrl: z.string().max(200000).nullish(),
  countryCode: z.string().length(2).nullish(),
  locale: z.string().trim().min(2).max(8).optional(),
});

// --- Matchmaking -----------------------------------------------------------
export const joinMatchmakingSchema = z.object({
  mode: modeSchema.default("ranked"),
  tempo: tempoSchema.default("daily"),
  boardSize: boardSizeSchema,
  region: z.string().min(1).max(16).optional(),
});

export const leaveMatchmakingSchema = z.object({
  mode: modeSchema.default("ranked"),
});

// --- Private match ---------------------------------------------------------
export const createPrivateMatchSchema = z.object({
  mode: z.enum(["casual", "friendly"]).default("friendly"),
  tempo: tempoSchema.default("blitz"),
  boardSize: boardSizeSchema,
  // Optional explicit override; when omitted, derived from tempo.
  turnSeconds: turnSecondsSchema.optional(),
  isRated: z.boolean().default(false),
});

export const joinPrivateMatchSchema = z.object({
  code: z.string().trim().min(4).max(12),
});

export const createBotMatchSchema = z.object({
  difficulty: z.enum(["beginner", "normal", "expert"]).default("normal"),
  boardSize: boardSizeSchema,
  turnSeconds: turnSecondsSchema,
});

// --- Match play ------------------------------------------------------------
export const submitFleetSchema = z.object({
  matchId: uuidSchema,
  fleet: fleetSchema,
  boardHash: z.string().max(128).optional(),
  salt: z.string().max(128).optional(),
});

export const fireShotSchema = z.object({
  matchId: uuidSchema,
  x: z.number().int().min(0).max(63),
  y: z.number().int().min(0).max(63),
  idempotencyKey: z.string().min(8).max(128),
});

// --- Push / notifications --------------------------------------------------
export const registerPushTokenSchema = z.object({
  token: z.string().min(8).max(512),
  platform: z.enum(["ios", "android", "web"]),
  provider: z.enum(["expo", "fcm", "apns"]).default("expo"),
  deviceId: uuidSchema.optional(),
});

export const sendTurnNotificationSchema = z.object({
  matchId: uuidSchema,
  userId: z.string().min(1).max(255),
});

export const updateSettingSchema = z.object({
  key: z.enum([
    "theme",
    "soundEnabled",
    "musicEnabled",
    "hapticsEnabled",
    "notificationsEnabled",
    "pushMatches",
    "pushTurns",
    "pushSocial",
    "pushMarketing",
    "showOnlineStatus",
    "allowFriendRequests",
    "allowSpectators",
  ]),
  value: z.union([z.boolean(), z.string()]),
});

// --- Social ----------------------------------------------------------------
export const idParamSchema = z.object({ id: z.string().min(1).max(255) });

export const sendFriendRequestSchema = z.object({
  receiverId: z.string().min(1).max(255),
  message: z.string().max(500).optional(),
});

export const blockUserSchema = z.object({
  blockedId: z.string().min(1).max(255),
  reason: z.string().max(500).optional(),
});

export const contactMatchSchema = z.object({
  hashes: z
    .array(z.string().regex(/^[a-f0-9]{64}$/, "must be a 64-char lowercase hex sha256"))
    .min(1)
    .max(500),
});

export const supportTicketSchema = z.object({
  email: z.string().trim().email().max(320),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2000),
  category: z
    .enum(["question", "bug", "account", "payment", "other"])
    .default("other"),
});

export const searchUsersQuerySchema = z.object({
  q: z.string().trim().min(1).max(48),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const leaderboardQuerySchema = z.object({
  scope: z.string().trim().min(2).max(16).default("global"),
  mode: modeSchema.default("ranked"),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// --- Reports ---------------------------------------------------------------
export const reportUserSchema = z.object({
  reportedId: z.string().min(1).max(255),
  category: z.enum([
    "harassment",
    "cheating",
    "inappropriate_name",
    "spam",
    "other",
  ]),
  description: z.string().max(2000).optional(),
  matchId: uuidSchema.optional(),
});

// --- Quests / shop ---------------------------------------------------------
export const claimQuestSchema = z.object({ userQuestId: uuidSchema });
export const equipCosmeticSchema = z.object({
  type: z.enum([
    "board_theme",
    "ship_skin",
    "avatar_frame",
    "emote",
    "victory_effect",
    "title",
    "flag",
  ]),
  itemId: uuidSchema,
});

// --- Tournaments -----------------------------------------------------------
export const tournamentIdParamSchema = z.object({ id: uuidSchema });
export const createTournamentBracketSchema = z.object({
  tournamentId: uuidSchema,
});
export const advanceTournamentSchema = z.object({
  tournamentMatchId: uuidSchema,
  winnerId: z.string().min(1).max(255),
});

// --- Account ---------------------------------------------------------------
export const deleteAccountSchema = z.object({ confirm: z.literal(true) });

// --- Admin -----------------------------------------------------------------
export const adminEnvelopeSchema = z.object({
  action: z.string().min(1).max(64),
  payload: z.unknown().optional(),
});
