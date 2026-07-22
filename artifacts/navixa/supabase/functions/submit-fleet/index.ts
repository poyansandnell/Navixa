// submit-fleet — validate + store a player's secret fleet, mark ready, and
// activate the match once both seats have submitted. The board is written to
// private_game_states (service-role only) and never returned to any client.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, submitFleetSchema } from '../_shared/validate.ts';
import {
  loadMatch,
  loadPrivateStates,
  requireParticipant,
  assertValidFleet,
} from '../_shared/match-helpers.ts';
import type { Fleet } from '../_shared/engine/types.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, submitFleetSchema);
  const db = serviceClient();

  const { match, players } = await loadMatch(db, body.matchId);
  const me = requireParticipant(players, user.id);

  if (match.status !== 'placing') {
    throw appError('WRONG_MATCH_STATE', `Cannot submit fleet while match is '${match.status}'`);
  }

  // Guard against re-submitting after the fleet is locked in.
  const existing = await loadPrivateStates(db, match.id);
  if (existing.some((s) => s.player_id === user.id)) {
    throw appError('FLEET_ALREADY_SUBMITTED');
  }

  assertValidFleet(body.fleet as Fleet, match);

  const { error: insErr } = await db.from('private_game_states').insert({
    match_id: match.id,
    player_id: user.id,
    seat: me.seat,
    is_bot: false,
    board: body.fleet,
    shots_received: [],
    board_hash: body.boardHash ?? null,
    salt: body.salt ?? null,
    fleet_submitted: true,
  });
  if (insErr) {
    if ((insErr as { code?: string }).code === '23505') {
      throw appError('FLEET_ALREADY_SUBMITTED');
    }
    throw appError('INTERNAL', insErr.message);
  }

  await db.from('match_players').update({ is_ready: true }).eq('id', me.id);

  await db.from('match_events').insert({
    match_id: match.id,
    actor_id: user.id,
    event_type: 'fleet_submitted',
    payload: { seat: me.seat },
  });

  // Determine readiness. A bot seat is always ready and needs an auto fleet.
  const botSeat = players.find((p) => p.is_bot);
  if (botSeat && !existing.some((s) => s.seat === botSeat.seat)) {
    // Bot seat has no player_id; generate + store its fleet server-side.
    await ensureBotFleet(db, match, botSeat.seat, botSeat.bot_difficulty);
  }

  const submittedCount = existing.length + 1 + (botSeat ? 1 : 0);
  let activated = false;

  if (submittedCount >= 2) {
    // Both fleets in: activate. First turn goes to seat 0 (player A).
    const firstSeat = players.find((p) => p.seat === 0);
    await db
      .from('matches')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        current_turn_player_id: firstSeat?.player_id ?? null,
        current_turn_seat: 0,
      })
      .eq('id', match.id)
      .eq('status', 'placing');

    // Stamp the first turn deadline.
    await db.rpc('touch_turn_clock', {
      p_match_id: match.id,
      p_prev_seat: null,
      p_active_seat: 0,
    });

    await db.from('match_events').insert({
      match_id: match.id,
      event_type: 'match_started',
      payload: {},
    });
    activated = true;
  }

  await writeAudit({
    actorId: user.id,
    action: 'fleet_submitted',
    entityType: 'match',
    entityId: match.id,
    metadata: { seat: me.seat, activated },
  });

  return jsonResponse({ ok: true, ready: true, matchStarted: activated });
});

/** Generate and store a bot's fleet using a deterministic seeded RNG. */
async function ensureBotFleet(
  db: ReturnType<typeof serviceClient>,
  match: { id: string; board_size: number },
  seat: number,
  difficulty: string | null,
): Promise<void> {
  const { autoPlace } = await import('../_shared/engine/placement.ts');
  const { createRng } = await import('../_shared/engine/rng.ts');
  const { DEFAULT_SHIPS } = await import('../_shared/engine/types.ts');

  // Seed from the match id for reproducibility.
  const seed = seedFromString(match.id);
  const rng = createRng(seed);
  const fleet = autoPlace(
    { boardSize: match.board_size, ships: DEFAULT_SHIPS, allowTouching: true },
    rng,
  );

  void difficulty;
  // The bot board is secret, service-role-only data — stored in
  // private_game_states with a null player_id, keyed by seat.
  await db.from('private_game_states').insert({
    match_id: match.id,
    player_id: null,
    seat,
    is_bot: true,
    board: fleet,
    shots_received: [],
    fleet_submitted: true,
  });
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
