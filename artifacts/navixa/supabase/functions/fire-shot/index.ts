// fire-shot — the authoritative shot resolver.
//
// The server loads BOTH boards from private_game_states, replays the shot
// through the pure engine (applyShot), persists the move + events, flips the
// turn and advances the clock. On a win it finalises the match and applies
// ratings (ranked only). Idempotent via a client-supplied idempotencyKey.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, fireShotSchema } from '../_shared/validate.ts';
import {
  loadMatch,
  loadPrivateStates,
  requireParticipant,
  buildMatchState,
  fireOnce,
  persistShot,
  seatToPlayerId,
  publicViewForSeat,
} from '../_shared/match-helpers.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, fireShotSchema);
  const db = serviceClient();

  // Idempotency: if this key was already recorded, return the stored outcome
  // in the SAME response shape as a fresh shot (including a rebuilt view), so
  // a client retrying after a lost response can update state normally.
  const { data: existingMove } = await db
    .from('match_moves')
    .select('move_number, target_x, target_y, is_hit, sunk_ship')
    .eq('match_id', body.matchId)
    .eq('idempotency_key', body.idempotencyKey)
    .maybeSingle();
  if (existingMove) {
    const { match, players } = await loadMatch(db, body.matchId);
    const me = requireParticipant(players, user.id);
    const privates = await loadPrivateStates(db, match.id);
    const state = buildMatchState(match, players, privates);
    const winnerId =
      state.winner !== null
        ? (players.find((p) => p.seat === state.winner)?.player_id ?? null)
        : null;
    const opponent = players.find((p) => p.seat !== me.seat);
    return jsonResponse({
      idempotent: true,
      result: existingMove.is_hit ? (existingMove.sunk_ship ? 'sunk' : 'hit') : 'miss',
      sunkShip: existingMove.sunk_ship,
      moveNumber: existingMove.move_number,
      winner: state.winner !== null,
      winnerId,
      yourTurn: state.winner === null && state.turn === seatToPlayerId(me.seat),
      view: publicViewForSeat(state, me.seat),
      botToMove:
        (opponent?.is_bot ?? false) &&
        state.winner === null &&
        state.turn !== seatToPlayerId(me.seat),
    });
  }

  const { match, players } = await loadMatch(db, body.matchId);
  const me = requireParticipant(players, user.id);

  if (match.status !== 'active') {
    throw appError('WRONG_MATCH_STATE', `Match is '${match.status}', not active`);
  }

  const privates = await loadPrivateStates(db, match.id);
  const state = buildMatchState(match, players, privates);

  if (state.winner !== null) throw appError('MATCH_ALREADY_OVER');
  if (state.turn !== seatToPlayerId(me.seat)) throw appError('NOT_YOUR_TURN');

  const target = players.find((p) => p.seat !== me.seat);
  if (!target) throw appError('MATCH_NOT_READY');

  const outcome = fireOnce(state, me.seat, body.x, body.y);

  await persistShot(db, {
    match,
    shooter: me,
    target,
    outcome,
    x: body.x,
    y: body.y,
    idempotencyKey: body.idempotencyKey,
  });

  let winnerId: string | null = null;
  if (outcome.winnerSeat !== null) {
    winnerId = players.find((p) => p.seat === outcome.winnerSeat)?.player_id ?? null;
    const { error: finErr } = await db.rpc('finalize_match', {
      p_match_id: match.id,
      p_winner_id: winnerId,
      p_abandoned: false,
    });
    if (finErr) throw appError('INTERNAL', `finalize failed: ${finErr.message}`);

    await writeAudit({
      actorId: user.id,
      action: 'match_finalized',
      entityType: 'match',
      entityId: match.id,
      metadata: { winner_id: winnerId, reason: 'all_ships_sunk' },
    });
  }

  const botOpponent = target.is_bot && outcome.winnerSeat === null;

  return jsonResponse({
    idempotent: false,
    result: outcome.result,
    sunkShip: outcome.sunkShip ?? null,
    moveNumber: outcome.moveIndex,
    winner: outcome.winnerSeat !== null,
    winnerId,
    yourTurn: false,
    // Redacted view for the shooter (never contains opponent ship positions).
    view: publicViewForSeat(outcome.newState, me.seat),
    // Signals the client to call bot-move next (server plays the bot's turn).
    botToMove: botOpponent,
  });
});
