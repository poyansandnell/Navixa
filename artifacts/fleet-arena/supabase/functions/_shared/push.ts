/**
 * Expo push notification helper.
 *
 * Sends messages to the Expo Push API (https://exp.host/--/api/v2/push/send).
 * Only Expo tokens (ExponentPushToken[...]) are supported here.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushMessage {
  to: string | string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

export interface ExpoPushResult {
  ok: boolean;
  status: number;
  response?: unknown;
}

/** Send one or more messages to the Expo push service. */
export async function sendExpoPush(
  messages: ExpoPushMessage[],
): Promise<ExpoPushResult> {
  if (messages.length === 0) return { ok: true, status: 204 };

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch (_e) {
    // ignore parse errors
  }
  return { ok: res.ok, status: res.status, response: body };
}

/** True if a token looks like a valid Expo push token. */
export function isExpoToken(token: string): boolean {
  return (
    token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')
  );
}
