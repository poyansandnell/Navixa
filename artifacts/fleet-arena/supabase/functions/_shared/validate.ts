/**
 * Zod payload schemas + a helper to parse a request body.
 *
 * Each Edge Function imports the schema it needs. Parsing failures surface as
 * AppError('INVALID_PAYLOAD') with the flattened issues in `details`.
 */

import { z } from 'npm:zod@3.23.8';
import { appError } from './errors.ts';

/** Parse+validate a JSON request body against a zod schema. */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch (_e) {
    // Allow empty bodies for schemas that accept `{}`.
    raw = {};
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw appError('INVALID_PAYLOAD', 'Payload failed validation', result.error.flatten());
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

export const uuidSchema = z.string().uuid();

const shipIdSchema = z.enum([
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
]);

const coordSchema = z.object({
  x: z.number().int().min(0).max(63),
  y: z.number().int().min(0).max(63),
});

const placementSchema = z.object({
  id: shipIdSchema,
  length: z.number().int().min(1).max(16),
  origin: coordSchema,
  orientation: z.enum(['horizontal', 'vertical']),
});

/** A submitted fleet — an array of ship placements. */
export const fleetSchema = z.array(placementSchema).min(1).max(16);

const modeSchema = z.enum(['ranked', 'casual', 'friendly', 'tournament', 'bot']);
const boardSizeSchema = z.number().int().min(8).max(16).default(10);
const turnSecondsSchema = z.number().int().min(10).max(600).default(60);

// ---------------------------------------------------------------------------
// Per-function schemas
// ---------------------------------------------------------------------------

export const joinMatchmakingSchema = z.object({
  mode: modeSchema.default('ranked'),
  boardSize: boardSizeSchema,
  region: z.string().min(1).max(16).optional(),
});

export const leaveMatchmakingSchema = z.object({
  mode: modeSchema.default('ranked'),
});

export const createPrivateMatchSchema = z.object({
  mode: z.enum(['casual', 'friendly']).default('friendly'),
  boardSize: boardSizeSchema,
  turnSeconds: turnSecondsSchema,
  isRated: z.boolean().default(false),
});

export const joinPrivateMatchSchema = z.object({
  code: z.string().trim().min(4).max(12),
});

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

export const resignMatchSchema = z.object({
  matchId: uuidSchema,
});

export const handleTimeoutSchema = z.object({
  matchId: uuidSchema,
});

export const reconnectMatchSchema = z.object({
  matchId: uuidSchema,
});

export const finalizeMatchSchema = z.object({
  matchId: uuidSchema,
});

export const botMoveSchema = z.object({
  matchId: uuidSchema,
});

export const registerPushTokenSchema = z.object({
  token: z.string().min(8).max(512),
  platform: z.enum(['ios', 'android', 'web']),
  provider: z.enum(['expo', 'fcm', 'apns']).default('expo'),
  deviceId: uuidSchema.optional(),
});

export const reportUserSchema = z.object({
  reportedId: uuidSchema,
  category: z.enum(['harassment', 'cheating', 'inappropriate_name', 'spam', 'other']),
  description: z.string().max(2000).optional(),
  matchId: uuidSchema.optional(),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal(true),
});

export const exportUserDataSchema = z.object({}).passthrough();

export const createTournamentBracketSchema = z.object({
  tournamentId: uuidSchema,
});

export const advanceTournamentSchema = z.object({
  tournamentMatchId: uuidSchema,
  winnerId: uuidSchema,
});

export const sendTurnNotificationSchema = z.object({
  matchId: uuidSchema,
  userId: uuidSchema,
});

export { z };
