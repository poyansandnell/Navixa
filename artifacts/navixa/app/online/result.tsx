import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { duration, iconSize, spacing } from '@/constants/theme';
import { Button, Card, Screen, SectionHeader, Spacer, StatTile, Text } from '@/components/ui';
import { FleetBoard, computeCellSize } from '@/components/game';
import { useAuth } from '@/features/auth/AuthContext';
import { fetchMatchDetail } from '@/features/history/api';
import { fetchRating } from '@/features/social/api';
import { useAnimationsEnabled } from '@/features/game/helpers';
import { useOnlineMatchStore } from '@/features/onlineMatch';
import type { ShipId, ShotResult } from '@/lib/engine';

interface RatingChange {
  before: number;
  after: number;
  delta: number;
}

export default function OnlineResultScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const animationsEnabled = useAnimationsEnabled();

  const matchId = useOnlineMatchStore((s) => s.matchId);
  const view = useOnlineMatchStore((s) => s.view);
  const ranked = useOnlineMatchStore((s) => s.ranked);
  const winnerId = useOnlineMatchStore((s) => s.winnerId);
  const status = useOnlineMatchStore((s) => s.status);
  const reset = useOnlineMatchStore((s) => s.reset);

  const [rating, setRating] = React.useState<RatingChange | null>(null);
  const [ratingLoading, setRatingLoading] = React.useState(ranked);

  const scale = useSharedValue(animationsEnabled ? 0.6 : 1);
  const opacity = useSharedValue(animationsEnabled ? 0 : 1);

  React.useEffect(() => {
    if (!matchId) router.replace('/(tabs)');
  }, [matchId]);

  React.useEffect(() => {
    if (animationsEnabled) {
      scale.value = withSequence(withSpring(1.05, { damping: 6 }), withSpring(1, { damping: 10 }));
      opacity.value = withDelay(0, withTiming(1, { duration: duration.normal }));
    } else {
      scale.value = 1;
      opacity.value = 1;
    }
  }, [animationsEnabled, scale, opacity]);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Derive the ranked rating change from the finished-match detail (the
  // player row carries `ratingDelta`) plus the caller's current rating.
  React.useEffect(() => {
    if (!ranked || !matchId || !user?.id) {
      setRatingLoading(false);
      return;
    }
    const selfId = user.id;
    let cancelled = false;
    (async () => {
      try {
        const [detail, ratingRow] = await Promise.all([
          fetchMatchDetail(matchId, selfId),
          fetchRating(selfId),
        ]);
        if (cancelled) return;
        const delta = detail?.match.me.ratingDelta;
        if (typeof delta === 'number' && ratingRow) {
          const after = ratingRow.rating;
          setRating({ before: after - delta, after, delta });
        }
      } catch (err) {
        console.warn('[online] rating fetch failed', err);
      } finally {
        if (!cancelled) setRatingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ranked, matchId, user?.id]);

  const won = winnerId != null && user?.id === winnerId;
  const abandoned = status === 'abandoned' && winnerId == null;

  const boardSize = view?.rules.boardSize ?? 10;
  const revealCellSize = computeCellSize(boardSize, width / 2, spacing.lg * 2);

  const ownFleet = (view?.own.fleet ?? []).map((p) => ({
    id: p.id as ShipId,
    length: p.length,
    origin: p.origin,
    orientation: p.orientation as 'horizontal' | 'vertical',
  }));
  const ownIncoming = (view?.own.incoming ?? {}) as Record<string, ShotResult>;

  // Your shot accuracy from the redacted opponent grid.
  let shots = 0;
  let hits = 0;
  if (view) {
    for (const row of view.opponent.grid) {
      for (const cell of row) {
        if (cell !== 'unknown') {
          shots += 1;
          if (cell === 'hit' || cell === 'sunk') hits += 1;
        }
      }
    }
  }
  const hitPct = shots > 0 ? Math.round((hits / shots) * 100) : 0;

  const handleHome = () => {
    reset();
    router.replace('/(tabs)');
  };

  const handleRematch = () => {
    reset();
    router.replace('/(tabs)');
  };

  return (
    <Screen testID="online-result-screen">
      <Animated.View style={[styles.banner, bannerStyle]}>
        <View
          style={[
            styles.bannerIcon,
            { backgroundColor: won ? colors.success : colors.destructive },
          ]}
        >
          <Feather
            name={won ? 'award' : 'x-circle'}
            size={iconSize.xxl}
            color={won ? colors.successForeground : colors.destructiveForeground}
          />
        </View>
        <Text variant="h1" color={won ? 'success' : 'destructive'} center>
          {abandoned
            ? t('online.result.abandoned')
            : won
              ? t('online.result.victory')
              : t('online.result.defeat')}
        </Text>
        <Text variant="subhead" color="muted" center>
          {won ? t('online.result.victorySubtitle') : t('online.result.defeatSubtitle')}
        </Text>
      </Animated.View>

      <Spacer size="xl" />

      {/* Rating change for ranked matches */}
      {ranked ? (
        <>
          <SectionHeader title={t('online.result.ratingTitle')} />
          <Card>
            {ratingLoading ? (
              <Text variant="subhead" color="muted" center>
                {t('online.result.loadingRating')}
              </Text>
            ) : rating ? (
              <View style={styles.ratingRow}>
                <StatTile label={t('online.result.oldRating')} value={String(rating.before)} />
                <StatTile
                  label={t('online.result.delta')}
                  value={`${rating.delta >= 0 ? '+' : ''}${rating.delta}`}
                  tone={rating.delta >= 0 ? 'primary' : 'accent'}
                />
                <StatTile
                  label={t('online.result.newRating')}
                  value={String(rating.after)}
                  tone="accent"
                />
              </View>
            ) : (
              <Text variant="subhead" color="muted" center>
                {t('online.result.loadingRating')}
              </Text>
            )}
          </Card>
          <Spacer size="xl" />
        </>
      ) : null}

      {/* Accuracy stats */}
      <Card>
        <View style={styles.statsRow}>
          <StatTile label={t('game.result.shots')} value={String(shots)} />
          <StatTile label={t('game.result.hitPct')} value={`${hitPct}%`} tone="primary" />
        </View>
      </Card>

      <Spacer size="xl" />

      {/* Your board reveal (we never learn the opponent's full board here). */}
      {view ? (
        <>
          <SectionHeader title={t('game.result.boards')} />
          <View style={styles.boardCol}>
            <Text variant="caption" color="muted" center>
              {t('online.play.yourBoard').toUpperCase()}
            </Text>
            <Spacer size="xs" />
            <FleetBoard
              fleet={ownFleet}
              shotsReceived={ownIncoming}
              boardSize={boardSize}
              cellSize={revealCellSize}
              revealShips
            />
          </View>
          <Spacer size="xl" />
        </>
      ) : null}

      <Button
        label={t('online.result.rematchSearch')}
        icon="refresh-cw"
        size="lg"
        fullWidth
        onPress={handleRematch}
        testID="online-rematch-button"
      />
      <Spacer size="md" />
      <Button
        label={t('online.result.home')}
        icon="home"
        variant="ghost"
        fullWidth
        onPress={handleHome}
        testID="online-home-button"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    gap: spacing.md,
  },
  bannerIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
  },
  statsRow: {
    flexDirection: 'row',
  },
  boardCol: {
    alignItems: 'center',
  },
});
