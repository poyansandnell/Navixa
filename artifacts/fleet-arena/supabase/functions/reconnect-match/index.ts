// reconnect-match — return the caller's full public state to resume a game.
//
// Returns the redacted view (own fleet + opponent's fired cells only), whose
// turn it is, the clock (deadline + remaining ms per player) and match status.
// The opponent's unsunk ship positions are NEVER present in the response.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, reconnectMatchSchema } from '../_shared/validate.ts';
import {
  loadMatch,
  loadPrivateStates,
  requireParticipant,
  buildMatchState,
  publicViewForSeat,
  seatToPlayerId,
} from '../_shared/match-helpers.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, reconnectMatchSchema);
  const db = serviceClient();

  const { match, players } = await loadMatch(db, body.matchId);
  const me = requireParticipant(players, user.id);

  // Update presence.
  await db
    .from('match_players')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', me.id);

  // For non-active matches we can only return status + seat readiness.
  if (match.status !== 'active') {
    return jsonResponse({
      matchId: match.id,
      status: match.status,
      mode: match.mode,
      boardSize: match.board_size,
      turnSeconds: match.turn_seconds,
      seat: me.seat,
      winnerId: match.winner_id,
      players: players.map((p) => ({
        seat: p.seat,
        playerId: p.player_id,
        isBot: p.is_bot,
        isReady: p.is_ready,
      })),
    });
  }

  const privates = await loadPrivateStates(db, match.id);
  const state = buildMatchState(match, players, privates);
  const view = publicViewForSeat(state, me.seat);

  const now = Date.now();
  const deadlineMs = match.turn_deadline ? new Date(match.turn_deadline).getTime() : null;
  const currentTurnRemaining = deadlineMs ? Math.max(0, deadlineMs - now) : null;

  return jsonResponse({
    matchId: match.id,
    status: match.status,
    mode: match.mode,
    boardSize: match.board_size,
    turnSeconds: match.turn_seconds,
    seat: me.seat,
    yourTurn: state.turn === seatToPlayerId(me.seat),
    winnerId: match.winner_id,
    clock: {
      turnDeadline: match.turn_deadline,
      currentTurnRemainingMs: currentTurnRemaining,
      players: players.map((p) => ({
        seat: p.seat,
        timeLeftMs: p.time_left_ms,
      })),
    },
    view,
  });
});
