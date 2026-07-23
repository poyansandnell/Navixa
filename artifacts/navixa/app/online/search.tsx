import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { Badge, Button, Card, Screen, Spacer, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useAnimationsEnabled } from '@/features/game/helpers';
import {
  joinMatchmaking,
  leaveMatchmaking,
  getDevBotFallbackMs,
  OnlineError,
  useMatchmakingRealtime,
  useOnlineMatchStore,
} from '@/features/onlineMatch';
import {
  resolveModeConfig,
  TempoPicker,
  type MatchTempo,
  type OnlineMode,
} from '@/features/matchmaking';

const RADAR_SIZE = 200;

/** After this long without an opponent, suggest playing a bot instead. */
const BOT_FALLBACK_MS = 30_000;

export default function SearchScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const animationsEnabled = useAnimationsEnabled();

  const params = useLocalSearchParams<{ mode?: string; tempo?: string }>();
  const mode = (params.mode as OnlineMode) ?? 'quick';
  const config = React.useMemo(() => resolveModeConfig(mode), [mode]);

  const initMatch = useOnlineMatchStore((s) => s.init);

  const [tempo, setTempo] = React.useState<MatchTempo>(
    params.tempo === 'blitz' || params.tempo === 'daily'
      ? (params.tempo as MatchTempo)
      : config.tempo,
  );

  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [matchFound, setMatchFound] = React.useState(false);
  const [showBotFallback, setShowBotFallback] = React.useState(false);
  const [fallbackMs, setFallbackMs] = React.useState<number>(BOT_FALLBACK_MS);

  const sweep = useSharedValue(0);
  const ping = useSharedValue(0);

  // Radar animations.
  React.useEffect(() => {
    if (animationsEnabled) {
      sweep.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false);
      ping.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    } else {
      cancelAnimation(sweep);
      cancelAnimation(ping);
    }
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(ping);
    };
  }, [animationsEnabled, sweep, ping]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweep.value * 360}deg` }],
  }));
  const pingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.2 + ping.value * 0.8 }],
    opacity: 1 - ping.value,
  }));

  const navigateToMatch = React.useCallback(
    (matchId: string) => {
      setMatchFound(true);
      initMatch(matchId, config.ranked, tempo);
      // Give the "match found" flash a beat before navigating.
      setTimeout(() => router.replace('/online/setup'), 400);
    },
    [initMatch, config.ranked, tempo],
  );

  // Realtime: watch the queue row for a match.
  useMatchmakingRealtime(user?.id ?? null, !matchFound, navigateToMatch);

  // Join matchmaking on mount; if the server pairs immediately, go straight in.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await joinMatchmaking({
          mode: config.serverMode,
          boardSize: config.boardSize,
          tempo,
        });
        if (cancelled) return;
        if (res.matched && res.matchId) {
          navigateToMatch(res.matchId);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof OnlineError ? err.message : t('online.search.error');
        setError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.serverMode, config.boardSize, tempo]);

  // Elapsed timer.
  React.useEffect(() => {
    if (matchFound) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [matchFound]);

  // Dev builds may shorten the wait via app_config for easier testing.
  React.useEffect(() => {
    if (!__DEV__) return;
    let active = true;
    (async () => {
      const ms = await getDevBotFallbackMs();
      if (active && ms > 0) setFallbackMs(ms);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Bot fallback: after the countdown runs out, offer a bot match instead.
  React.useEffect(() => {
    if (matchFound) return;
    if (elapsed * 1000 >= fallbackMs) setShowBotFallback(true);
  }, [elapsed, fallbackMs, matchFound]);

  /** Seconds left until we suggest the bot (shown as a countdown). */
  const fallbackCountdown = Math.max(0, Math.ceil(fallbackMs / 1000) - elapsed);

  const handleCancel = React.useCallback(async () => {
    try {
      await leaveMatchmaking(config.serverMode);
    } catch {
      // Best-effort; still leave the screen.
    }
    router.back();
  }, [config.serverMode]);

  const handlePlayBot = () => {
    // Leave the queue (best-effort) and reuse the offline bot flow entirely.
    void leaveMatchmaking(config.serverMode).catch(() => {});
    router.replace('/game/setup');
  };

  return (
    <Screen testID="online-search-screen" scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.content}>
        <View style={styles.radarWrap}>
          <View style={[styles.radar, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Animated.View
              style={[styles.ping, { borderColor: colors.accent }, animationsEnabled ? pingStyle : undefined]}
            />
            <Animated.View style={[styles.sweep, animationsEnabled ? sweepStyle : undefined]}>
              <View style={[styles.sweepLine, { backgroundColor: colors.accent }]} />
            </Animated.View>
            <View style={[styles.radarCore, { backgroundColor: colors.accent }]}>
              <Feather
                name={matchFound ? 'check' : 'radio'}
                size={iconSize.lg}
                color={colors.accentForeground}
              />
            </View>
          </View>
        </View>

        <Spacer size="xl" />

        <Text variant="h2" center>
          {matchFound ? t('online.search.matchFound') : t('online.search.searching')}
        </Text>
        <Spacer size="sm" />
        <View style={styles.centerRow}>
          <Badge label={t(`online.picker.${config.mode}`)} tone="accent" />
          {!matchFound ? (
            <Text variant="subhead" color="muted">
              {showBotFallback
                ? t('online.search.elapsed', { seconds: elapsed })
                : t('online.search.botCountdown', { seconds: fallbackCountdown })}
            </Text>
          ) : (
            <Text variant="subhead" color="muted">
              {t('online.search.connecting')}
            </Text>
          )}
        </View>

        {!matchFound ? (
          <>
            <Spacer size="lg" />
            <Text variant="label" color="muted" center>
              {t('online.tempo.title').toUpperCase()}
            </Text>
            <Spacer size="sm" />
            <TempoPicker value={tempo} onChange={setTempo} />
          </>
        ) : null}

        {error ? (
          <>
            <Spacer size="lg" />
            <Text variant="subhead" color="destructive" center>
              {error}
            </Text>
          </>
        ) : null}

        {showBotFallback && !matchFound ? (
          <>
            <Spacer size="lg" />
            <Card>
              <Text variant="bodyMedium">{t('online.search.botFallbackTitle')}</Text>
              <Spacer size="xs" />
              <Text variant="caption" color="muted">
                {t('online.search.botFallbackBody')}
              </Text>
              <Spacer size="md" />
              <Button
                label={t('online.search.playBot')}
                icon="cpu"
                variant="secondary"
                fullWidth
                onPress={handlePlayBot}
                testID="online-search-play-bot"
              />
              <Spacer size="sm" />
              <Text variant="caption" color="muted" center>
                {t('online.search.keepSearching')}
              </Text>
            </Card>
          </>
        ) : null}
      </View>

      {!matchFound ? (
        <Button
          label={t('online.search.cancel')}
          icon="x"
          variant="ghost"
          fullWidth
          onPress={handleCancel}
          testID="online-search-cancel"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  radarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radar: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ping: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 2,
  },
  sweep: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: 'center',
  },
  sweepLine: {
    position: 'absolute',
    top: RADAR_SIZE / 2,
    width: 2,
    height: RADAR_SIZE / 2,
  },
  radarCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
