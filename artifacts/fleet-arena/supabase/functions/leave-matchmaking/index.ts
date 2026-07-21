// leave-matchmaking — cancel the caller's active queue entry for a mode.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, leaveMatchmakingSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, leaveMatchmakingSchema);
  const db = serviceClient();

  const { data, error } = await db
    .from('matchmaking_queue')
    .update({ status: 'cancelled' })
    .eq('player_id', user.id)
    .eq('mode', body.mode)
    .eq('status', 'searching')
    .select('id');
  if (error) throw appError('INTERNAL', error.message);

  return jsonResponse({ cancelled: (data?.length ?? 0) > 0 });
});
