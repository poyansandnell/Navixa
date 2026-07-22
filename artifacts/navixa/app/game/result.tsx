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
import { useGameStore } from '@/store/game';
import { useAnimationsEnabled } from '@/features/game/helpers';

export default function ResultScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const animationsEnabled = useAnimationsEnabled();

  const match = useGameStore((s) => s.match);
  const winner = useGameStore((s) => s.winner);
  const startMatch = useGameStore((s) => s.startMatch);
  const reset = useGameStore((s) => s.reset);
  const draftFleet = useGameStore((s) => s.draftFleet);

  const scale = useSharedValue(animationsEnabled ? 0.6 : 1);
  const opacity = useSharedValue(animationsEnabled ? 0 : 1);

  React.useEffect(() => {
    if (!match) {
      router.replace('/game/setup');
    }
  }, [match]);

  React.useEffect(() => {
    if (animationsEnabled) {
      scale.value = withSequence(
        withSpring(1.05, { damping: 6 }),
        withSpring(1, { damping: 10 }),
      );
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

  if (!match) {
    return (
      <Screen testID="game-result-screen">
        <Text>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const won = winner === 'A';
  const boardSize = match.rules.boardSize;
  const revealCellSize = computeCellSize(boardSize, width / 2, spacing.lg * 2);

  // Stats derived from the authoritative log (player A = you).
  const yourShots = match.log.filter((s) => s.by === 'A');
  const yourHits = yourShots.filter((s) => s.result === 'hit' || s.result === 'sunk').length;
  const hitPct = yourShots.length > 0 ? Math.round((yourHits / yourShots.length) * 100) : 0;
  const shipsSunk = new Set(
    match.log.filter((s) => s.by === 'A' && s.sunkShip).map((s) => s.sunkShip),
  ).size;

  // Both fleets and their incoming shots for the reveal.
  const you = match.players.A;
  const bot = match.players.B;

  const handleRematch = () => {
    // Keep the same draft fleet and difficulty; start a fresh match.
    if (draftFleet.length === match.rules.ships.length) {
      startMatch(Date.now());
      router.replace('/game/play');
    } else {
      router.replace('/game/setup');
    }
  };

  const handleHome = () => {
    reset();
    router.replace('/(tabs)');
  };

  return (
    <Screen testID="game-result-screen">
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
          {won ? t('game.result.victory') : t('game.result.defeat')}
        </Text>
        <Text variant="subhead" color="muted" center>
          {won ? t('game.result.victorySubtitle') : t('game.result.defeatSubtitle')}
        </Text>
      </Animated.View>

      <Spacer size="xl" />

      {/* Stats */}
      <Card>
        <View style={styles.statsRow}>
          <StatTile label={t('game.result.shots')} value={String(yourShots.length)} />
          <StatTile label={t('game.result.hitPct')} value={`${hitPct}%`} tone="primary" />
          <StatTile
            label={t('game.result.shipsSunk')}
            value={String(shipsSunk)}
            tone="accent"
          />
        </View>
      </Card>

      <Spacer size="xl" />

      {/* Both boards revealed */}
      <SectionHeader title={t('game.result.boards')} />
      <View style={styles.boardsRow}>
        <View style={styles.boardCol}>
          <Text variant="caption" color="muted" center>
            {t('game.play.yourBoard').toUpperCase()}
          </Text>
          <Spacer size="xs" />
          <FleetBoard
            fleet={you.fleet}
            shotsReceived={you.shotsReceived}
            boardSize={boardSize}
            cellSize={revealCellSize}
            revealShips
          />
        </View>
        <View style={styles.boardCol}>
          <Text variant="caption" color="muted" center>
            {t('game.result.enemyBoard').toUpperCase()}
          </Text>
          <Spacer size="xs" />
          <FleetBoard
            fleet={bot.fleet}
            shotsReceived={bot.shotsReceived}
            boardSize={boardSize}
            cellSize={revealCellSize}
            revealShips
          />
        </View>
      </View>

      <Spacer size="xl" />

      <Button
        label={t('game.result.rematch')}
        icon="refresh-cw"
        size="lg"
        fullWidth
        onPress={handleRematch}
        testID="game-rematch-button"
      />
      <Spacer size="md" />
      <Button
        label={t('game.result.home')}
        icon="home"
        variant="ghost"
        fullWidth
        onPress={handleHome}
        testID="game-home-button"
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
  statsRow: {
    flexDirection: 'row',
  },
  boardsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
  },
  boardCol: {
    flex: 1,
    alignItems: 'center',
  },
});
