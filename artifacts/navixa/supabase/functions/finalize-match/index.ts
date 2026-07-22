// finalize-match — idempotently finalise a match by recomputing the winner
// server-side from the private boards. Safe to call multiple times.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, finalizeMatchSchema } from '../_shared/validate.ts';
import {
  loadMatch,
  loadPrivateStates,
  requireParticipant,
  buildMatchState,
  seatToPlayerId,
} from '../_shared/match-helpers.ts';
import { allSunk } from '../_shared/engine/match.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, finalizeMatchSchema);
  const db = serviceClient();

  const { match, players } = await loadMatch(db, body.matchId);
  requireParticipant(players, user.id);

  // Already finalised — return current result idempotently.
  if (['finished', 'abandoned', 'cancelled'].includes(match.status)) {
    return jsonResponse({ ok: true, alreadyFinal: true, winnerId: match.winner_id });
  }

  if (match.status !== 'active') {
    throw appError('WRONG_MATCH_STATE', `Cannot finalise a '${match.status}' match`);
  }

  // Recompute the winner from the authoritative boards; only finalise when a
  // fleet is actually fully sunk (prevents premature finalisation).
  const privates = await loadPrivateStates(db, match.id);
  const state = buildMatchState(match, players, privates);

  let winnerSeat: number | null = null;
  for (const p of players) {
    const opp = players.find((o) => o.seat !== p.seat);
    if (!opp) continue;
    const oppId = seatToPlayerId(opp.seat);
    if (allSunk(state.players[oppId].fleet, state.players[oppId].shotsReceived)) {
      winnerSeat = p.seat;
      break;
    }
  }

  if (winnerSeat === null) {
    throw appError('WRONG_MATCH_STATE', 'No fleet is fully sunk yet');
  }

  const winnerId = players.find((p) => p.seat === winnerSeat)?.player_id ?? null;
  const { error } = await db.rpc('finalize_match', {
    p_match_id: match.id,
    p_winner_id: winnerId,
    p_abandoned: false,
  });
  if (error) throw appError('INTERNAL', error.message);

  await writeAudit({
    actorId: user.id,
    action: 'match_finalized',
    entityType: 'match',
    entityId: match.id,
    metadata: { winner_id: winnerId, reason: 'explicit_finalize' },
  });

  return jsonResponse({ ok: true, alreadyFinal: false, winnerId });
});
