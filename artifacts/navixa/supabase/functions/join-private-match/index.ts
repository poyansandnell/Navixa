// join-private-match — join an open private match by its invite code.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, joinPrivateMatchSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, joinPrivateMatchSchema);
  const db = serviceClient();

  const code = body.code.toUpperCase();

  const { data: match, error } = await db.rpc('join_private_match', {
    p_joiner_id: user.id,
    p_code: code,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('not found')) throw appError('INVITE_NOT_FOUND');
    if (msg.includes('full')) throw appError('MATCH_FULL');
    throw appError('INTERNAL', msg);
  }
  if (!match) throw appError('INVITE_NOT_FOUND');

  const row = match as { id: string; status: string };

  await writeAudit({
    actorId: user.id,
    action: 'private_match_joined',
    entityType: 'match',
    entityId: row.id,
    metadata: { code },
  });

  return jsonResponse({ matchId: row.id, status: row.status });
});
