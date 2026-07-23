/**
 * Navixa — notification deep-link handling for daily matches.
 *
 * Daily matches send Expo push notifications carrying `data.matchId` when it is
 * the player's turn or the match ends. Tapping such a notification should resume
 * that match. This hook:
 *   - handles taps while the app is running (addNotificationResponseReceived),
 *   - handles the cold-start case (getLastNotificationResponseAsync).
 *
 * `expo-notifications` is native-only, so everything is guarded for web (where
 * the module is unavailable / a no-op) and loaded lazily to avoid pulling it
 * into the web bundle.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { fetchActiveMatches } from './client';
import { useOnlineMatchStore } from './store';

interface NotificationResponseLike {
  notification?: {
    request?: { content?: { data?: Record<string, unknown> | null } | null } | null;
  } | null;
}

function extractMatchId(response: NotificationResponseLike | null | undefined): string | null {
  const data = response?.notification?.request?.content?.data;
  if (!data) return null;
  const id = (data as { matchId?: unknown }).matchId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function useNotificationDeepLink(enabled: boolean): void {
  const init = useOnlineMatchStore((s) => s.init);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    const resume = async (matchId: string) => {
      // Route by authoritative status: matches still in fleet placement must
      // land on setup, not play (which would spin on a null view).
      let status: string | null = null;
      try {
        const { matches } = await fetchActiveMatches();
        status = matches.find((m) => m.matchId === matchId)?.status ?? null;
      } catch {
        // Offline/failed lookup: fall through to play, which reconnects.
      }
      if (cancelled) return;
      if (status === null) {
        // Not in the active list (finished/abandoned): show history instead.
        router.push('/history');
        return;
      }
      init(matchId, false);
      router.push(status === 'active' ? '/online/play' : '/online/setup');
    };

    (async () => {
      const mod = (await import('expo-notifications').catch(() => null)) as
        | (typeof import('expo-notifications'))
        | null;
      if (!mod || cancelled) return;

      // Cold start: a tapped notification that launched the app.
      try {
        const last = await mod.getLastNotificationResponseAsync();
        const matchId = extractMatchId(last as NotificationResponseLike | null);
        if (matchId && !cancelled) resume(matchId);
      } catch {
        // ignore
      }

      // Foreground / background taps.
      subscription = mod.addNotificationResponseReceivedListener((response) => {
        const matchId = extractMatchId(response as NotificationResponseLike);
        if (matchId) resume(matchId);
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, init]);
}
