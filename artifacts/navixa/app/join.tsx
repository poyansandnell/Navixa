/**
 * Navixa — private-match invite entry point (`/join?code=XXXXXX`).
 *
 * Reached via:
 *   - the universal link `${APP_PUBLIC_URL}/join?code=<code>` (web + prod
 *     iOS/Android app links),
 *   - the custom scheme `navixa://join?code=<code>`,
 *   - the in-app pending-join resume after sign-in.
 *
 * (The legacy path-segment deep link `navixa://join/<code>` continues to work
 * through `app/online/join/[code].tsx`, which also handles manual code entry.)
 *
 * Behaviour:
 *   - Signed in (session + profile): auto-join the match, then route to setup.
 *   - Signed out: stash the code and send the user to sign-in; the root layout
 *     resumes the join automatically once authenticated.
 *
 * NOTE: In Expo Go, custom-scheme / universal links do NOT open the app, so the
 * manual code-entry screen remains the dev fallback. This route is for the web
 * build and production native builds.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { spacing } from '@/constants/theme';
import { Button, Screen, Spacer, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import {
  joinPrivateMatch,
  parseInviteCode,
  stashPendingJoinCode,
  OnlineError,
  useOnlineMatchStore,
} from '@/features/onlineMatch';

export default function JoinDeepLinkScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { session, hasProfile, initializing } = useAuth();
  const initMatch = useOnlineMatchStore((s) => s.init);

  const params = useLocalSearchParams<{ code?: string }>();
  const code = React.useMemo(() => {
    const raw = params.code;
    return raw ? parseInviteCode(String(raw)) : null;
  }, [params.code]);

  const [error, setError] = React.useState<string | null>(null);
  const handled = React.useRef(false);

  React.useEffect(() => {
    if (initializing || handled.current) return;

    // No / malformed code: fall back to the manual entry screen.
    if (!code) {
      handled.current = true;
      router.replace('/online/join/new');
      return;
    }

    // Signed out: stash the code and let the root layout resume after auth.
    if (!session || !hasProfile) {
      handled.current = true;
      void stashPendingJoinCode(code);
      router.replace('/(auth)/sign-in');
      return;
    }

    // Signed in with a profile: auto-join and continue to fleet setup.
    handled.current = true;
    (async () => {
      try {
        const res = await joinPrivateMatch(code);
        initMatch(res.matchId, false);
        router.replace('/online/setup');
      } catch (err) {
        const message =
          err instanceof OnlineError ? err.message : t('online.private.joinError');
        setError(message);
      }
    })();
  }, [initializing, code, session, hasProfile, initMatch, t]);

  return (
    <Screen testID="join-deeplink-screen">
      <View style={styles.center}>
        {error ? (
          <>
            <Text variant="h2" center>
              {t('online.join.failedTitle')}
            </Text>
            <Spacer size="sm" />
            <Text variant="subhead" color="destructive" center>
              {error}
            </Text>
            <Spacer size="lg" />
            <Button
              label={t('online.private.join')}
              icon="log-in"
              onPress={() =>
                router.replace(code ? `/online/join/${code}` : '/online/join/new')
              }
            />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Spacer size="lg" />
            <Text variant="subhead" color="muted" center>
              {t('online.join.joining')}
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
});
