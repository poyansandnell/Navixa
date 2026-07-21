// join-matchmaking — enqueue the caller and try to find an opponent.
// Uses the transactional SQL matchmaking_find_or_queue() which handles the
// widening rating window, self/blocked exclusion and duplicate-match prevention.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, joinMatchmakingSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, joinMatchmakingSchema);
  const db = serviceClient();

  // Fetch the caller's current rating for the requested mode (default 1200).
  const { data: rating } = await db
    .from('ratings')
    .select('rating')
    .eq('player_id', user.id)
    .eq('mode', body.mode)
    .maybeSingle();
  const playerRating = rating?.rating ?? 1200;

  const { data: matchId, error } = await db.rpc('matchmaking_find_or_queue', {
    p_player_id: user.id,
    p_mode: body.mode,
    p_rating: playerRating,
    p_region: body.region ?? null,
    p_board_size: body.boardSize,
  });
  if (error) throw appError('INTERNAL', error.message);

  await writeAudit({
    actorId: user.id,
    action: matchId ? 'matchmaking_matched' : 'matchmaking_queued',
    entityType: 'match',
    entityId: (matchId as string) ?? undefined,
    metadata: { mode: body.mode, rating: playerRating },
  });

  return jsonResponse({
    matched: Boolean(matchId),
    matchId: (matchId as string) ?? null,
    status: matchId ? 'matched' : 'searching',
  });
});
