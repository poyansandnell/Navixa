// resign-match — the caller forfeits; the opponent is declared winner.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, resignMatchSchema } from '../_shared/validate.ts';
import { loadMatch, requireParticipant } from '../_shared/match-helpers.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, resignMatchSchema);
  const db = serviceClient();

  const { match, players } = await loadMatch(db, body.matchId);
  const me = requireParticipant(players, user.id);

  if (!['placing', 'active', 'pending'].includes(match.status)) {
    throw appError('WRONG_MATCH_STATE', `Cannot resign a '${match.status}' match`);
  }

  const opponent = players.find((p) => p.seat !== me.seat);
  const winnerId = opponent?.player_id ?? null;

  // Mark this player as forfeited before finalising.
  await db.from('match_players').update({ forfeited: true }).eq('id', me.id);

  await db.from('match_events').insert({
    match_id: match.id,
    actor_id: user.id,
    event_type: 'resigned',
    payload: { seat: me.seat },
  });

  // If the match never started (still placing/pending), treat as abandoned.
  const abandoned = match.status !== 'active';

  const { error } = await db.rpc('finalize_match', {
    p_match_id: match.id,
    p_winner_id: winnerId,
    p_abandoned: abandoned,
  });
  if (error) throw appError('INTERNAL', error.message);

  await writeAudit({
    actorId: user.id,
    action: 'match_resigned',
    entityType: 'match',
    entityId: match.id,
    metadata: { winner_id: winnerId, abandoned },
  });

  return jsonResponse({ ok: true, winnerId, abandoned });
});
