import React from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { radii, spacing } from '@/constants/theme';
import { Button, Card, Screen, Spacer, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import {
  createPrivateMatch,
  OnlineError,
  useMatchmakingRealtime,
  useOnlineMatchStore,
  type CreatePrivateResult,
} from '@/features/onlineMatch';
import { TempoPicker, type MatchTempo } from '@/features/matchmaking';

export default function PrivateMatchScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const initMatch = useOnlineMatchStore((s) => s.init);

  const [created, setCreated] = React.useState<CreatePrivateResult | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [joined, setJoined] = React.useState(false);
  const [tempo, setTempo] = React.useState<MatchTempo>('blitz');

  const navigateToMatch = React.useCallback(
    (matchId: string) => {
      setJoined(true);
      initMatch(matchId, false, tempo);
      setTimeout(() => router.replace('/online/setup'), 300);
    },
    [initMatch, tempo],
  );

  // Once created, watch for the opponent joining via matchmaking realtime is
  // not applicable (private uses matches directly). We instead poll the matches
  // row through the store's reconnect once the opponent submits; for the
  // waiting state we listen on the match row via the same queue hook is not
  // suitable. Here we simply advance to setup immediately — the setup screen
  // handles the "waiting for opponent" state — so the creator can place their
  // fleet while the friend joins.
  useMatchmakingRealtime(user?.id ?? null, !!created && !joined, navigateToMatch);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await createPrivateMatch({ mode: 'friendly', isRated: false, tempo });
      setCreated(res);
    } catch (err) {
      const message = err instanceof OnlineError ? err.message : t('online.search.error');
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      // expo-clipboard is optional; import lazily (via a runtime-computed
      // specifier so tsc/bundler don't hard-require it) and fall back to Share
      // when it is not installed.
      const spec = 'expo-clipboard';
      const mod = (await import(/* @vite-ignore */ spec).catch(() => null)) as
        | { setStringAsync?: (v: string) => Promise<void> }
        | null;
      if (mod && typeof mod.setStringAsync === 'function') {
        await mod.setStringAsync(created.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } else {
        await Share.share({ message: created.code });
      }
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    if (!created) return;
    try {
      await Share.share({
        message: `${t('online.private.createBody')} ${created.deepLink}`,
      });
    } catch {
      // ignore
    }
  };

  const handleContinue = () => {
    if (!created) return;
    initMatch(created.matchId, false, created.tempo);
    router.replace('/online/setup');
  };

  return (
    <Screen testID="online-private-screen">
      {!created ? (
        <>
          <Text variant="subhead" color="muted">
            {t('online.private.createBody')}
          </Text>
          <Spacer size="xl" />
          <Text variant="label" color="muted">
            {t('online.tempo.title').toUpperCase()}
          </Text>
          <Spacer size="sm" />
          <TempoPicker value={tempo} onChange={setTempo} />
          <Spacer size="xl" />
          <Button
            label={t('online.private.create')}
            icon="plus-circle"
            size="lg"
            fullWidth
            loading={creating}
            onPress={handleCreate}
            testID="online-private-create"
          />
          {error ? (
            <>
              <Spacer size="lg" />
              <Text variant="subhead" color="destructive" center>
                {error}
              </Text>
            </>
          ) : null}
        </>
      ) : (
        <>
          <Card elevated>
            <Text variant="caption" color="muted">
              {t('online.private.codeLabel').toUpperCase()}
            </Text>
            <Spacer size="xs" />
            <Text variant="h1" color="accent" center style={styles.code}>
              {created.code}
            </Text>
            <Spacer size="md" />
            <View style={styles.actions}>
              <Button
                label={copied ? t('online.private.copied') : t('online.private.copy')}
                icon={copied ? 'check' : 'copy'}
                variant="secondary"
                size="sm"
                onPress={handleCopy}
              />
              <Button
                label={t('online.private.share')}
                icon="share-2"
                variant="secondary"
                size="sm"
                onPress={handleShare}
              />
            </View>
          </Card>

          <Spacer size="md" />
          <Card>
            <Text variant="caption" color="muted">
              {t('online.private.linkLabel').toUpperCase()}
            </Text>
            <Spacer size="xs" />
            <Text variant="body" style={{ color: colors.foreground }}>
              {created.deepLink}
            </Text>
          </Card>

          <Spacer size="xl" />
          <View style={styles.waitingRow}>
            <Feather name="clock" size={18} color={colors.mutedForeground} />
            <Text variant="subhead" color="muted">
              {t('online.private.waiting')}
            </Text>
          </View>

          <Spacer size="xl" />
          <Button
            label={t('online.setup.title')}
            icon="anchor"
            size="lg"
            fullWidth
            onPress={handleContinue}
            testID="online-private-continue"
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: {
    letterSpacing: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
  },
});
