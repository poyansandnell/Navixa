// bot-move — server-side bot turn for training matches.
//
// SECURITY: the bot chooses its shot from ONLY the public projection of the
// match (projectPublicState) — the same redacted view a human opponent gets.
// There is no code path where the bot sees the human's unsunk ships. The
// caller (human participant) requests this after their own shot when it is the
// bot's turn.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, botMoveSchema } from '../_shared/validate.ts';
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
import { createBot, type BotDifficulty } from '../_shared/engine/bots.ts';
import { projectPublicState } from '../_shared/engine/match.ts';
import { createRng } from '../_shared/engine/rng.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, botMoveSchema);
  const db = serviceClient();

  const { match, players } = await loadMatch(db, body.matchId);
  // Only a human participant may drive a bot match forward.
  requireParticipant(players, user.id);

  if (match.mode !== 'bot') throw appError('WRONG_MATCH_STATE', 'Not a bot match');
  if (match.status !== 'active') {
    throw appError('WRONG_MATCH_STATE', `Match is '${match.status}', not active`);
  }

  const botSeat = players.find((p) => p.is_bot);
  if (!botSeat) throw appError('WRONG_MATCH_STATE', 'No bot seat');

  const privates = await loadPrivateStates(db, match.id);
  let state = buildMatchState(match, players, privates);

  if (state.winner !== null) throw appError('MATCH_ALREADY_OVER');
  if (state.turn !== seatToPlayerId(botSeat.seat)) {
    throw appError('NOT_YOUR_TURN', "It is not the bot's turn");
  }

  const difficulty = (botSeat.bot_difficulty ?? 'normal') as BotDifficulty;
  const bot = createBot(difficulty);

  // Deterministic RNG seeded by match + move count so replays are stable.
  const rng = createRng((seedFromString(match.id) ^ (state.moveCount * 2654435761)) >>> 0);

  // The bot's public view is the projection from the bot's seat.
  const view = projectPublicState(state, seatToPlayerId(botSeat.seat));
  const coord = bot(view, rng);

  const human = players.find((p) => p.seat !== botSeat.seat);
  if (!human) throw appError('MATCH_NOT_READY');

  const outcome = fireOnce(state, botSeat.seat, coord.x, coord.y);

  await persistShot(db, {
    match,
    shooter: botSeat,
    target: human,
    outcome,
    x: coord.x,
    y: coord.y,
    idempotencyKey: `bot-${match.id}-${outcome.moveIndex}`,
  });

  state = outcome.newState;

  let winnerId: string | null = null;
  if (outcome.winnerSeat !== null) {
    winnerId = players.find((p) => p.seat === outcome.winnerSeat)?.player_id ?? null;
    // Bot matches are never rated; finalize_match will skip ratings for bots.
    const { error: finErr } = await db.rpc('finalize_match', {
      p_match_id: match.id,
      p_winner_id: winnerId,
      p_abandoned: false,
    });
    if (finErr) throw appError('INTERNAL', `finalize failed: ${finErr.message}`);
  }

  return jsonResponse({
    botShot: { x: coord.x, y: coord.y },
    result: outcome.result,
    sunkShip: outcome.sunkShip ?? null,
    moveNumber: outcome.moveIndex,
    winner: outcome.winnerSeat !== null,
    winnerId,
    // Redacted view for the human after the bot's move.
    view: publicViewForSeat(state, human.seat),
  });
});

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
