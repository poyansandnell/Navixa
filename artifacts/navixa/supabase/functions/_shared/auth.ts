/**
 * JWT verification for Edge Functions.
 *
 * We verify the caller's access token by constructing a supabase-js client with
 * the incoming Authorization header and calling auth.getUser(). This validates
 * the JWT against the project's auth server and returns the authenticated user.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { appError } from './errors.ts';

export interface AuthedUser {
  id: string;
  email: string | null;
}

/**
 * Verify the request's Authorization: Bearer <jwt> header and return the user.
 * Throws AppError(UNAUTHORIZED / SESSION_EXPIRED) when invalid.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    throw appError('UNAUTHORIZED', 'Missing bearer token');
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw appError('INTERNAL', 'Missing SUPABASE_URL / SUPABASE_ANON_KEY');
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw appError('SESSION_EXPIRED', error?.message ?? 'Invalid or expired session');
  }

  return { id: data.user.id, email: data.user.email ?? null };
}
