// export-user-data — GDPR-style data export for the authenticated user.
//
// Collects the caller's profile, settings, ratings, rating history, match
// participation, social graph and notifications into a single JSON document.
// Never includes another user's private data or any private_game_states.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { parseBody, exportUserDataSchema } from '../_shared/validate.ts';

serveJson(async (req) => {
  const user = await requireUser(req);
  await parseBody(req, exportUserDataSchema);
  const db = serviceClient();

  const uid = user.id;

  const [
    profile,
    settings,
    ratings,
    ratingHistory,
    matchPlayers,
    friendships,
    friendRequests,
    notifications,
    pushTokens,
    devices,
    reports,
  ] = await Promise.all([
    db.from('profiles').select('*').eq('id', uid).maybeSingle(),
    db.from('user_settings').select('*').eq('user_id', uid).maybeSingle(),
    db.from('ratings').select('*').eq('player_id', uid),
    db.from('rating_history').select('*').eq('player_id', uid),
    db.from('match_players').select('*').eq('player_id', uid),
    db.from('friendships').select('*').or(`user_a.eq.${uid},user_b.eq.${uid}`),
    db.from('friend_requests').select('*').or(`sender_id.eq.${uid},receiver_id.eq.${uid}`),
    db.from('notifications').select('*').eq('user_id', uid),
    db.from('push_tokens').select('id, platform, provider, is_active, created_at').eq('user_id', uid),
    db.from('devices').select('*').eq('user_id', uid),
    db.from('reports').select('*').eq('reporter_id', uid),
  ]);

  await writeAudit({
    actorId: uid,
    action: 'user_data_exported',
    entityType: 'profile',
    entityId: uid,
  });

  return jsonResponse({
    exportedAt: new Date().toISOString(),
    userId: uid,
    email: user.email,
    profile: profile.data ?? null,
    settings: settings.data ?? null,
    ratings: ratings.data ?? [],
    ratingHistory: ratingHistory.data ?? [],
    matches: matchPlayers.data ?? [],
    friendships: friendships.data ?? [],
    friendRequests: friendRequests.data ?? [],
    notifications: notifications.data ?? [],
    pushTokens: pushTokens.data ?? [],
    devices: devices.data ?? [],
    reportsFiled: reports.data ?? [],
  });
});
