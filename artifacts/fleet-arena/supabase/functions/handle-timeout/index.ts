// handle-timeout — server-verified turn timeout.
//
// Any participant may report a suspected timeout. The server checks the match's
// turn_deadline (which it alone stamps) against now(). If the clock really has
// expired, the player on the clock loses (opponent wins). Otherwise NOT_TIMED_OUT.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, handleTimeoutSchema } from '../_shared/validate.ts';
import { loadMatch, requireParticipant } from '../_shared/match-helpers.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, handleTimeoutSchema);
  const db = serviceClient();

  const { match, players } = await loadMatch(db, body.matchId);
  requireParticipant(players, user.id);

  if (match.status !== 'active') {
    throw appError('WRONG_MATCH_STATE', `Match is '${match.status}', not active`);
  }
  if (!match.turn_deadline) {
    throw appError('NOT_TIMED_OUT', 'No active turn deadline');
  }

  const deadline = new Date(match.turn_deadline).getTime();
  if (Date.now() < deadline) {
    throw appError('NOT_TIMED_OUT', 'The current turn has not expired yet');
  }

  // Whoever is on the clock loses on time (prefer seat; robust for bot seats).
  const onClock =
    (match.current_turn_seat === 0 || match.current_turn_seat === 1
      ? players.find((p) => p.seat === match.current_turn_seat)
      : undefined) ??
    players.find((p) => p.player_id === match.current_turn_player_id);
  const winner = players.find((p) => p.seat !== onClock?.seat);
  const winnerId = winner?.player_id ?? null;

  if (onClock) {
    await db.from('match_players').update({ forfeited: true }).eq('id', onClock.id);
  }

  await db.from('match_events').insert({
    match_id: match.id,
    actor_id: onClock?.player_id ?? null,
    event_type: 'timeout',
    payload: { loser_seat: onClock?.seat ?? null, deadline: match.turn_deadline },
  });

  const { error } = await db.rpc('finalize_match', {
    p_match_id: match.id,
    p_winner_id: winnerId,
    p_abandoned: false,
  });
  if (error) throw appError('INTERNAL', error.message);

  await writeAudit({
    actorId: user.id,
    action: 'match_timeout',
    entityType: 'match',
    entityId: match.id,
    metadata: { winner_id: winnerId, loser_id: onClock?.player_id ?? null },
  });

  return jsonResponse({ ok: true, timedOut: true, winnerId });
});
