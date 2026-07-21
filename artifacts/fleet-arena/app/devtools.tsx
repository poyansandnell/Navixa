/**
 * Fleet Arena — developer tools.
 *
 * GATED to development builds only via __DEV__ — in production this redirects
 * away immediately so the screen can never be reached. Intentionally simple:
 * inspect the current session, toggle a simulated offline banner, kick off a
 * bot match, clear the local AsyncStorage cache, probe the realtime socket and
 * set a throwaway local test rating.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { radii, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth';
import {
  Badge,
  Button,
  Card,
  Screen,
  SectionHeader,
  Spacer,
  Text,
} from '@/components/ui';
import {
  clearAsyncStorage,
  getRealtimeStatus,
  useDevToolsStore,
} from '@/lib/devtools';

export default function DevToolsScreen() {
  // Hard gate: only reachable in dev builds.
  if (!__DEV__) {
    return <Redirect href="/(tabs)" />;
  }
  return <DevTools />;
}

function DevTools() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user, session, isGuest } = useAuth();
  const { simulateOffline, setSimulateOffline, testRating, setTestRating } =
    useDevToolsStore();

  const [realtime, setRealtime] = useState('…');
  const [ratingInput, setRatingInput] = useState(testRating != null ? String(testRating) : '');
  const [starting, setStarting] = useState(false);

  const refreshRealtime = useCallback(async () => {
    setRealtime(await getRealtimeStatus());
  }, []);

  useEffect(() => {
    void refreshRealtime();
  }, [refreshRealtime]);

  const startBotMatch = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-matchmaking', {
        body: { mode: 'bot', boardSize: 10 },
      });
      if (error) throw error;
      const matchId = (data as { matchId?: string })?.matchId;
      if (matchId) {
        router.push(`/game/setup?matchId=${matchId}`);
      } else {
        showAlert('Dev', JSON.stringify(data));
      }
    } catch (e) {
      showAlert('Dev', (e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const clearCache = async () => {
    await clearAsyncStorage();
    showAlert('Dev', t('devtools.clearCacheDone'));
  };

  const applyRating = () => {
    const parsed = Number.parseInt(ratingInput, 10);
    setTestRating(Number.isFinite(parsed) ? parsed : null);
  };

  return (
    <Screen testID="devtools-screen">
      <Text variant="h1">{t('devtools.title')}</Text>

      {simulateOffline ? (
        <>
          <Spacer size="sm" />
          <View style={[styles.offlineBanner, { backgroundColor: colors.destructive }]}>
            <Text variant="caption" style={{ color: colors.destructiveForeground }}>
              {t('devtools.offlineBannerActive')}
            </Text>
          </View>
        </>
      ) : null}

      <Spacer size="xl" />

      {/* Session */}
      <SectionHeader title={t('devtools.session')} />
      <Card>
        <Row label={t('devtools.userId')} value={user?.id ?? t('devtools.none')} />
        <Row label={t('devtools.email')} value={user?.email ?? t('devtools.none')} />
        <Row label={t('devtools.isGuest')} value={isGuest ? 'true' : 'false'} />
        <Row
          label="expires"
          value={session?.expires_at ? String(session.expires_at) : t('devtools.none')}
        />
      </Card>

      <Spacer size="xl" />

      {/* Seeded test info */}
      <SectionHeader title={t('devtools.seededInfo')} />
      <Card>
        <Text variant="caption" color="muted">
          {`env: ${process.env.EXPO_PUBLIC_SUPABASE_URL ? 'supabase configured' : 'no supabase url'}`}
        </Text>
      </Card>

      <Spacer size="xl" />

      {/* Toggles & actions */}
      <SectionHeader title={t('devtools.realtimeStatus')} />
      <Card>
        <View style={styles.row}>
          <Text variant="body">{t('devtools.realtimeStatus')}</Text>
          <Badge label={realtime} tone={realtime === 'connected' ? 'success' : 'muted'} />
        </View>
        <Spacer size="sm" />
        <Button label={t('common.retry')} size="sm" variant="ghost" onPress={refreshRealtime} />
      </Card>

      <Spacer size="lg" />

      <Button
        label={t('devtools.offlineBanner')}
        icon={simulateOffline ? 'wifi' : 'wifi-off'}
        variant={simulateOffline ? 'secondary' : 'ghost'}
        fullWidth
        onPress={() => setSimulateOffline(!simulateOffline)}
      />
      <Spacer size="sm" />
      <Button
        label={t('devtools.startBotMatch')}
        icon="cpu"
        variant="primary"
        fullWidth
        loading={starting}
        onPress={startBotMatch}
      />
      <Spacer size="sm" />
      <Button
        label={t('devtools.clearCache')}
        icon="trash-2"
        variant="ghost"
        fullWidth
        onPress={clearCache}
      />

      <Spacer size="xl" />

      {/* Local test rating */}
      <SectionHeader title={t('devtools.testRating')} />
      <Card>
        <View style={styles.row}>
          <TextInput
            value={ratingInput}
            onChangeText={setRatingInput}
            keyboardType="number-pad"
            placeholder={t('devtools.none')}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary },
            ]}
          />
          <Button label={t('common.save')} size="sm" onPress={applyRating} />
        </View>
        {testRating != null ? (
          <>
            <Spacer size="sm" />
            <Text variant="caption" color="muted">
              current: {testRating}
            </Text>
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Text variant="caption" numberOfLines={1} style={styles.metaValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  metaValue: { flex: 1, textAlign: 'right' },
  offlineBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: 'Inter_400Regular',
  },
});
