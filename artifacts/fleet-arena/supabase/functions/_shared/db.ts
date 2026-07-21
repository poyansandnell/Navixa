/**
 * Service-role Supabase client for trusted server mutations.
 *
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected into the Edge
 * Function runtime by the platform. The service_role key bypasses RLS, so this
 * client must ONLY be used server-side and its result never leaked to clients
 * (in particular, private_game_states must never be returned to a client).
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

let cached: SupabaseClient | null = null;

/** Lazily construct and cache the service-role client. */
export function serviceClient(): SupabaseClient {
  if (cached) return cached;

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in function env');
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Write an audit_logs row for a critical/privileged event. Never throws. */
export async function writeAudit(params: {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await serviceClient()
      .from('audit_logs')
      .insert({
        actor_id: params.actorId ?? null,
        action: params.action,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        metadata: params.metadata ?? {},
      });
  } catch (_e) {
    // Audit logging must never break the request path.
  }
}
