// register-push-token — upsert an Expo/FCM/APNs push token for the caller.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, registerPushTokenSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, registerPushTokenSchema);
  const db = serviceClient();

  // Upsert on the unique token; re-point it to this user and (re)activate.
  const { error } = await db
    .from('push_tokens')
    .upsert(
      {
        user_id: user.id,
        device_id: body.deviceId ?? null,
        token: body.token,
        platform: body.platform,
        provider: body.provider,
        is_active: true,
      },
      { onConflict: 'token' },
    );
  if (error) throw appError('INTERNAL', error.message);

  return jsonResponse({ ok: true });
});
