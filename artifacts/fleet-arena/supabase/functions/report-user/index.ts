// report-user — file an abuse report against another user.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, reportUserSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, reportUserSchema);
  const db = serviceClient();

  if (body.reportedId === user.id) {
    throw appError('INVALID_PAYLOAD', 'You cannot report yourself');
  }

  // Confirm the reported user exists.
  const { data: target } = await db
    .from('profiles')
    .select('id')
    .eq('id', body.reportedId)
    .maybeSingle();
  if (!target) throw appError('NOT_FOUND', 'Reported user not found');

  const { data: report, error } = await db
    .from('reports')
    .insert({
      reporter_id: user.id,
      reported_id: body.reportedId,
      match_id: body.matchId ?? null,
      category: body.category,
      description: body.description ?? null,
      status: 'open',
    })
    .select('id')
    .single();
  if (error) throw appError('INTERNAL', error.message);

  await writeAudit({
    actorId: user.id,
    action: 'user_reported',
    entityType: 'report',
    entityId: report.id,
    metadata: { reported_id: body.reportedId, category: body.category },
  });

  return jsonResponse({ ok: true, reportId: report.id });
});
