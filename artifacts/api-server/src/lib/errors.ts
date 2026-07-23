/**
 * Central error model. Every AppError serialises to a stable JSON envelope
 * `{ error: { code, message, details? } }` so the Expo client can switch on a
 * machine-readable `code` (mirrors the Supabase Edge Function contract).
 */
import type { Response } from "express";

export type ErrorCode =
  // Auth / session
  | "UNAUTHORIZED"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  // Validation
  | "INVALID_PAYLOAD"
  | "INVALID_FLEET"
  | "INVALID_COORD"
  // Match lifecycle
  | "MATCH_NOT_FOUND"
  | "MATCH_ALREADY_STARTED"
  | "MATCH_ALREADY_OVER"
  | "MATCH_FULL"
  | "MATCH_NOT_READY"
  | "NOT_A_PARTICIPANT"
  | "WRONG_MATCH_STATE"
  // Turn / move
  | "NOT_YOUR_TURN"
  | "CELL_ALREADY_FIRED"
  | "OUT_OF_BOUNDS"
  | "FLEET_ALREADY_SUBMITTED"
  | "FLEET_NOT_SUBMITTED"
  | "DUPLICATE_MOVE"
  | "STALE_MOVE"
  // Clock
  | "NOT_TIMED_OUT"
  // Matchmaking / private
  | "ALREADY_IN_QUEUE"
  | "INVITE_NOT_FOUND"
  // Tournament
  | "TOURNAMENT_NOT_FOUND"
  | "BRACKET_EXISTS"
  // Misc
  | "USERNAME_TAKEN"
  | "USERNAME_INVALID"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  INVALID_PAYLOAD: 400,
  INVALID_FLEET: 400,
  INVALID_COORD: 400,
  MATCH_NOT_FOUND: 404,
  MATCH_ALREADY_STARTED: 409,
  MATCH_ALREADY_OVER: 409,
  MATCH_FULL: 409,
  MATCH_NOT_READY: 409,
  NOT_A_PARTICIPANT: 403,
  WRONG_MATCH_STATE: 409,
  NOT_YOUR_TURN: 409,
  CELL_ALREADY_FIRED: 409,
  OUT_OF_BOUNDS: 400,
  FLEET_ALREADY_SUBMITTED: 409,
  FLEET_NOT_SUBMITTED: 409,
  DUPLICATE_MOVE: 409,
  STALE_MOVE: 409,
  NOT_TIMED_OUT: 409,
  ALREADY_IN_QUEUE: 409,
  INVITE_NOT_FOUND: 404,
  TOURNAMENT_NOT_FOUND: 404,
  BRACKET_EXISTS: 409,
  USERNAME_TAKEN: 409,
  USERNAME_INVALID: 400,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code] ?? 500;
    this.details = details;
  }
}

export function appError(
  code: ErrorCode,
  message?: string,
  details?: unknown,
): AppError {
  return new AppError(code, message, details);
}

/** Write an error envelope onto an Express response. */
export function sendError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    const payload: { code: ErrorCode; message: string; details?: unknown } = {
      code: err.code,
      message: err.message,
    };
    if (err.details !== undefined) payload.details = err.details;
    res.status(err.status).json({ error: payload });
    return;
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  res.status(500).json({ error: { code: "INTERNAL", message } });
}

/** Map a game-engine error message into an AppError with the right code. */
export function mapEngineError(err: unknown): AppError {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "not-your-turn") return appError("NOT_YOUR_TURN");
  if (msg === "match-already-over") return appError("MATCH_ALREADY_OVER");
  if (msg === "cell-already-fired") return appError("CELL_ALREADY_FIRED");
  if (msg === "stale-move-index") return appError("STALE_MOVE", msg);
  if (msg.startsWith("out-of-bounds")) return appError("OUT_OF_BOUNDS", msg);
  return appError("INTERNAL", msg);
}
