// advance-tournament — record a bracket slot winner and flow them into the
// next slot. Admin/creator only. Delegates to idempotent SQL
// tournament_advance_winner().
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, advanceTournamentSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, advanceTournamentSchema);
  const db = serviceClient();

  const { data: tm } = await db
    .from('tournament_matches')
    .select('id, tournament_id, player_one_id, player_two_id, tournaments!inner(created_by)')
    .eq('id', body.tournamentMatchId)
    .maybeSingle();
  if (!tm) throw appError('NOT_FOUND', 'Bracket slot not found');

  const { data: profile } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  const createdBy = (tm as { tournaments?: { created_by?: string } }).tournaments?.created_by;
  if (!profile?.is_admin && createdBy !== user.id) {
    throw appError('FORBIDDEN', 'Only an admin or the creator may advance the bracket');
  }

  const { error } = await db.rpc('tournament_advance_winner', {
    p_tournament_match_id: body.tournamentMatchId,
    p_winner_id: body.winnerId,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('not a participant')) throw appError('INVALID_PAYLOAD', msg);
    throw appError('INTERNAL', msg);
  }

  await writeAudit({
    actorId: user.id,
    action: 'tournament_advanced',
    entityType: 'tournament_match',
    entityId: body.tournamentMatchId,
    metadata: { winner_id: body.winnerId },
  });

  return jsonResponse({ ok: true });
});
