/**
 * Thin wrapper around Deno.serve that handles CORS preflight, POST-only
 * enforcement, and consistent error serialisation.
 */

import { handlePreflight } from './cors.ts';
import { errorResponse, appError } from './errors.ts';

export type Handler = (req: Request) => Promise<Response>;

export function serveJson(handler: Handler): void {
  Deno.serve(async (req: Request) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    if (req.method !== 'POST') {
      return errorResponse(appError('INVALID_PAYLOAD', 'Only POST is supported'));
    }

    try {
      return await handler(req);
    } catch (err) {
      return errorResponse(err);
    }
  });
}
