import React from 'react';
import { StyleSheet, useWindowDimensions, View, Pressable } from 'react-native';
import { showAlert } from '@/lib/alert';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { duration, radii, spacing, typography } from '@/constants/theme';
import { Badge, Button, Card, Screen, Spacer, Text } from '@/components/ui';
import { EventLog, FleetBoard, ShipsTray, TargetBoard, computeCellSize } from '@/components/game';
import { useGameStore } from '@/store/game';
import { useSettingsStore } from '@/store/settings';
import { fireHaptic, selectionHaptic, useAnimationsEnabled } from '@/features/game/helpers';
import { projectPublicState } from '@/lib/engine';
import type { Coord, PublicMatchState, ShotResult } from '@/lib/engine';

const BOT_DELAY_MS = 750;

export default function PlayScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { width, height } = useWindowDimensions();

  const confirmShot = useSettingsStore((s) => s.confirmShot);
  const haptics = useSettingsStore((s) => s.haptics);
  const animationsEnabled = useAnimationsEnabled();

  const match = useGameStore((s) => s.match);
  const phase = useGameStore((s) => s.phase);
  const events = useGameStore((s) => s.events);
  const botThinking = useGameStore((s) => s.botThinking);
  const fireAt = useGameStore((s) => s.fireAt);
  const botTurn = useGameStore((s) => s.botTurn);
  const resign = useGameStore((s) => s.resign);

  const [selected, setSelected] = React.useState<Coord | null>(null);
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (!match) {
      router.replace('/game/setup');
    }
  }, [match]);

  React.useEffect(() => {
    if (phase === 'finished') {
      router.replace('/game/result');
    }
  }, [phase]);

  const lastEventId = React.useRef<number>(0);
  React.useEffect(() => {
    const last = events[events.length - 1];
    if (last && last.id !== lastEventId.current) {
      lastEventId.current = last.id;
      fireHaptic(last.result as ShotResult, haptics);
    }
  }, [events, haptics]);

  React.useEffect(() => {
    if (botThinking && phase === 'playing') {
      const id = setTimeout(() => botTurn(), BOT_DELAY_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [botThinking, phase, botTurn]);

  const view: PublicMatchState | null = match ? projectPublicState(match, 'A') : null;

  const yourTurn = view?.yourTurn ?? false;

  React.useEffect(() => {
    if (animationsEnabled && yourTurn) {
      pulse.value = withRepeat(withTiming(1, { duration: duration.slowest }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [animationsEnabled, yourTurn, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + pulse.value * 0.4,
  }));

  if (!view) {
    return (
      <Screen testID="game-play-screen">
        <Text>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const boardSize = view.rules.boardSize;
  const targetCellSize = computeCellSize(boardSize, width, spacing.lg * 2 + spacing.sm * 2);
  // Maximize target board space on smaller screens, compute own board to fit
  const ownCellSize = Math.max(10, Math.floor(targetCellSize * 0.45));

  const opponentSunk = new Set(view.opponent.sunkShips.map((s) => s.id));
  const ownSunk = new Set(
    view.own.fleet
      .filter((p) => placementSunk(p, view.own.incoming))
      .map((p) => p.id),
  );

  const handleCellPress = (x: number, y: number) => {
    if (!yourTurn) return;
    if (confirmShot) {
      setSelected({ x, y });
      selectionHaptic(haptics);
    } else {
      fireAt({ x, y });
      setSelected(null);
    }
  };

  const handleConfirmFire = () => {
    if (selected) {
      fireAt(selected);
      setSelected(null);
    }
  };

  const handleResign = () => {
    showAlert(t('game.play.resignTitle'), t('game.play.resignBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('game.play.resign'),
        style: 'destructive',
        onPress: () => resign(),
      },
    ]);
  };

  return (
    <Screen testID="game-play-screen" scroll={false} contentStyle={styles.screenContent}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.turnRow, yourTurn ? pulseStyle : undefined]}>
          <Badge
            label={yourTurn ? t('game.play.yourTurn') : t('game.play.botTurn')}
            tone={yourTurn ? 'success' : 'muted'}
          />
          {botThinking ? (
            <Text variant="caption" color="muted">
              {t('game.play.botThinking')}
            </Text>
          ) : null}
        </Animated.View>
        <Pressable onPress={handleResign} testID="game-resign-button" hitSlop={12} style={styles.resignButton}>
          <Feather name="flag" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Opponent board */}
      <View style={styles.primaryArea}>
        <View style={styles.sectionHeader}>
          <Text variant="label" color="muted" style={typography.label}>
            {t('game.play.opponentBoard').toUpperCase()}
          </Text>
        </View>
        <Card padded={false} style={styles.boardCard}>
          <TargetBoard
            grid={view.opponent.grid}
            boardSize={boardSize}
            cellSize={targetCellSize}
            selected={selected}
            disabled={!yourTurn}
            animationsEnabled={animationsEnabled}
            onCellPress={handleCellPress}
          />
        </Card>
      </View>

      {/* Fire Action Container */}
      <View style={styles.fireActionContainer}>
        {confirmShot ? (
          <Button
            label={
              selected
                ? t('game.play.fireAt', { coord: coordLabel(selected) })
                : t('game.play.selectTarget')
            }
            icon="crosshair"
            size="md"
            fullWidth
            disabled={!selected || !yourTurn}
            onPress={handleConfirmFire}
          />
        ) : <View />}
      </View>

      {/* Dashboard (Own Fleet + Trays + Log) */}
      <View style={styles.dashboard}>
        <View style={styles.dashboardRow}>
          {/* Left: Own Board */}
          <View style={styles.ownBoardColumn}>
            <View style={styles.sectionHeader}>
              <Text variant="label" color="muted" style={typography.label}>
                {t('game.play.yourBoard').toUpperCase()}
              </Text>
            </View>
            <Card padded={false} style={styles.ownBoardCard}>
              <FleetBoard
                fleet={view.own.fleet}
                shotsReceived={view.own.incoming}
                boardSize={boardSize}
                cellSize={ownCellSize}
                revealShips
              />
            </Card>
          </View>

          {/* Right: Ships + Event Log */}
          <View style={styles.statusColumn}>
            <Card style={styles.statusCard}>
              <View style={styles.traysRow}>
                <ShipsTray
                  ships={view.rules.ships}
                  sunkIds={opponentSunk}
                  title={t('game.play.enemyFleet')}
                  compact
                />
                <ShipsTray
                  ships={view.rules.ships}
                  sunkIds={ownSunk}
                  title={t('game.play.yourFleet')}
                  compact
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.logContainer}>
                <Text variant="label" color="muted" style={typography.label}>
                  {t('game.log.title').toUpperCase()}
                </Text>
                <EventLog events={events} limit={2} />
              </View>
            </Card>
          </View>
        </View>
      </View>
    </Screen>
  );
}

// --- helpers ---------------------------------------------------------------

function placementSunk(
  placement: { origin: Coord; length: number; orientation: 'horizontal' | 'vertical' },
  incoming: Record<string, ShotResult>,
): boolean {
  for (let i = 0; i < placement.length; i++) {
    const c =
      placement.orientation === 'horizontal'
        ? { x: placement.origin.x + i, y: placement.origin.y }
        : { x: placement.origin.x, y: placement.origin.y + i };
    const r = incoming[`${c.x},${c.y}`];
    if (r !== 'hit' && r !== 'sunk') return false;
  }
  return true;
}

function coordLabel(c: Coord): string {
  const LETTERS = 'ABCDEFGHIJ';
  return `${LETTERS[c.x] ?? '?'}${c.y + 1}`;
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  turnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resignButton: {
    padding: spacing.xs,
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  primaryArea: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  boardCard: {
    padding: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.lg,
  },
  fireActionContainer: {
    minHeight: 48,
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  dashboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dashboardRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  ownBoardColumn: {
    alignItems: 'center',
  },
  ownBoardCard: {
    padding: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  statusColumn: {
    flex: 1,
    height: '100%',
  },
  statusCard: {
    padding: spacing.sm,
    flex: 1,
    justifyContent: 'space-between',
  },
  traysRow: {
    gap: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: spacing.sm,
  },
  logContainer: {
    gap: spacing.xs,
  },
});

