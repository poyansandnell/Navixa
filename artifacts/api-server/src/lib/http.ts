/**
 * HTTP helpers: an async wrapper that funnels thrown AppErrors into the stable
 * error envelope, and a zod body parser.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { z } from "zod";
import { appError, sendError } from "./errors";

/** Wrap an async route handler so thrown errors become error envelopes. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err: unknown) => {
      // Log unexpected (non-AppError) failures at error level.
      req.log?.error?.({ err }, "request handler failed");
      sendError(res, err);
    });
  };
}

/** Parse+validate a request body against a zod schema (throws INVALID_PAYLOAD). */
export function parseBody<S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
): z.output<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw appError(
      "INVALID_PAYLOAD",
      "Payload failed validation",
      result.error.flatten(),
    );
  }
  return result.data;
}

/** Parse+validate query params against a zod schema. */
export function parseQuery<S extends z.ZodTypeAny>(
  schema: S,
  query: unknown,
): z.output<S> {
  const result = schema.safeParse(query ?? {});
  if (!result.success) {
    throw appError(
      "INVALID_PAYLOAD",
      "Query failed validation",
      result.error.flatten(),
    );
  }
  return result.data;
}
