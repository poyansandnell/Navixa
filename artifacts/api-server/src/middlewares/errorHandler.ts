/** Terminal error + 404 handlers producing the `{ error: { code, message } }` envelope. */
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, appError, sendError } from "../lib/errors";

/** 404 for unmatched /api routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, appError("NOT_FOUND", "Route not found"));
}

/** Convert thrown errors (AppError, ZodError, unknown) into the envelope. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;
  if (err instanceof ZodError) {
    sendError(
      res,
      appError("INVALID_PAYLOAD", "Request validation failed", err.flatten()),
    );
    return;
  }
  if (!(err instanceof AppError)) {
    req.log?.error({ err }, "unhandled error");
  }
  sendError(res, err);
}
