// delete-account — permanently delete the authenticated user's account.
//
// Soft-deletes the public profile (anonymising it so finished-match history
// still renders), deactivates push tokens, then hard-deletes the auth.users row
// via the admin API. Deleting auth.users cascades to profiles (FK on delete
// cascade), which cascades onward to the user's owned rows.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, deleteAccountSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  await parseBody(req, deleteAccountSchema);
  const db = serviceClient();

  // Refuse to abandon an in-progress match without resigning it first.
  const { data: activeMatches } = await db
    .from('match_players')
    .select('match_id, matches!inner(status)')
    .eq('player_id', user.id)
    .in('matches.status', ['active', 'placing']);
  if (activeMatches && activeMatches.length > 0) {
    throw appError(
      'CONFLICT',
      'Finish or resign your active matches before deleting your account',
    );
  }

  // Deactivate push tokens so we stop targeting the device.
  await db.from('push_tokens').update({ is_active: false }).eq('user_id', user.id);

  // Anonymise + soft-delete the profile (kept for finished-match integrity).
  await db
    .from('profiles')
    .update({
      display_name: 'Deleted player',
      bio: null,
      avatar_url: null,
      country_code: null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  await writeAudit({
    actorId: user.id,
    action: 'account_deleted',
    entityType: 'profile',
    entityId: user.id,
  });

  // Hard-delete the auth user (cascades to profiles + owned rows).
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) throw appError('INTERNAL', `auth delete failed: ${error.message}`);

  return jsonResponse({ ok: true });
});
