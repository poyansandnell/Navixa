// create-tournament-bracket — build a seeded single-elimination bracket.
// Admin-only. Delegates to the idempotent SQL create_tournament_bracket().
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, createTournamentBracketSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, createTournamentBracketSchema);
  const db = serviceClient();

  // Only admins or the tournament creator may generate a bracket.
  const { data: profile } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  const { data: tournament } = await db
    .from('tournaments')
    .select('id, created_by, status')
    .eq('id', body.tournamentId)
    .maybeSingle();
  if (!tournament) throw appError('TOURNAMENT_NOT_FOUND');
  if (!profile?.is_admin && tournament.created_by !== user.id) {
    throw appError('FORBIDDEN', 'Only an admin or the creator may seed the bracket');
  }

  const { data: rounds, error } = await db.rpc('create_tournament_bracket', {
    p_tournament_id: body.tournamentId,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('at least 2')) throw appError('CONFLICT', 'Need at least 2 entries');
    throw appError('INTERNAL', msg);
  }

  await writeAudit({
    actorId: user.id,
    action: 'tournament_bracket_created',
    entityType: 'tournament',
    entityId: body.tournamentId,
    metadata: { rounds },
  });

  return jsonResponse({ ok: true, rounds: rounds ?? 0, alreadyExisted: rounds === 0 });
});
