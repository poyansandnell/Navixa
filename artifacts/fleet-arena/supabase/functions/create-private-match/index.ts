// create-private-match — create a private match with a shareable code + deep link.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, createPrivateMatchSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, createPrivateMatchSchema);
  const db = serviceClient();

  const { data: match, error } = await db.rpc('create_private_match', {
    p_creator_id: user.id,
    p_mode: body.mode,
    p_board_size: body.boardSize,
    p_turn_seconds: body.turnSeconds,
    p_is_rated: body.isRated,
  });
  if (error) throw appError('INTERNAL', error.message);
  if (!match) throw appError('INTERNAL', 'create_private_match returned nothing');

  const row = match as { id: string; invite_code: string };
  const code = row.invite_code;
  // Deep link consumed by the Expo Router app (see app scheme in app.json).
  const deepLink = `fleetarena://join/${code}`;
  const universalLink = `https://fleetarena.app/join/${code}`;

  await writeAudit({
    actorId: user.id,
    action: 'private_match_created',
    entityType: 'match',
    entityId: row.id,
    metadata: { code, mode: body.mode },
  });

  return jsonResponse({
    matchId: row.id,
    code,
    deepLink,
    universalLink,
  });
});
