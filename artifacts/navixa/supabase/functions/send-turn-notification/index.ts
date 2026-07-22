// send-turn-notification — notify a player that it is their turn.
//
// Creates an in-app notification row and (when the user opted in and has active
// Expo tokens) sends an Expo push. The caller must be a participant of the
// match; the notified user must be the opponent whose turn it now is.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { parseBody, sendTurnNotificationSchema } from '../_shared/validate.ts';
import { loadMatch, requireParticipant } from '../_shared/match-helpers.ts';
import { sendExpoPush, isExpoToken, type ExpoPushMessage } from '../_shared/push.ts';

serveJson(async (req) => {
  const caller = await requireUser(req);
  const body = await parseBody(req, sendTurnNotificationSchema);
  const db = serviceClient();

  const { match, players } = await loadMatch(db, body.matchId);
  requireParticipant(players, caller.id);

  const recipient = players.find((p) => p.player_id === body.userId);
  if (!recipient) throw appError('NOT_A_PARTICIPANT', 'Target is not in this match');
  if (recipient.is_bot || !recipient.player_id) {
    return jsonResponse({ ok: true, skipped: 'bot_seat' });
  }

  // Respect the recipient's notification preferences.
  const { data: settings } = await db
    .from('user_settings')
    .select('notifications_enabled, push_turns')
    .eq('user_id', recipient.player_id)
    .maybeSingle();

  // Always create the in-app notification (feed), even if push is disabled.
  await db.from('notifications').insert({
    user_id: recipient.player_id,
    type: 'your_turn',
    title_key: 'notifications.yourTurn.title',
    body_key: 'notifications.yourTurn.body',
    data: { matchId: match.id },
  });

  const pushAllowed =
    (settings?.notifications_enabled ?? true) && (settings?.push_turns ?? true);
  if (!pushAllowed) {
    return jsonResponse({ ok: true, pushed: false, reason: 'opted_out' });
  }

  const { data: tokens } = await db
    .from('push_tokens')
    .select('token, provider')
    .eq('user_id', recipient.player_id)
    .eq('is_active', true);

  const expoTokens = (tokens ?? [])
    .filter((t) => t.provider === 'expo' && isExpoToken(t.token))
    .map((t) => t.token);

  if (expoTokens.length === 0) {
    return jsonResponse({ ok: true, pushed: false, reason: 'no_tokens' });
  }

  const messages: ExpoPushMessage[] = expoTokens.map((to) => ({
    to,
    title: 'Navixa',
    body: "It's your turn to fire!",
    sound: 'default',
    priority: 'high',
    channelId: 'turns',
    data: { type: 'your_turn', matchId: match.id },
  }));

  const result = await sendExpoPush(messages);

  return jsonResponse({ ok: true, pushed: result.ok, count: expoTokens.length });
});
