import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
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

import { duration, radii, spacing } from '@/constants/theme';
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
  const { width } = useWindowDimensions();

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

  // Redirect out if there is no active match (e.g. deep-link / reload).
  React.useEffect(() => {
    if (!match) {
      router.replace('/game/setup');
    }
  }, [match]);

  // Navigate to the result screen once finished.
  React.useEffect(() => {
    if (phase === 'finished') {
      router.replace('/game/result');
    }
  }, [phase]);

  // Track the last event to fire haptics for both sides.
  const lastEventId = React.useRef<number>(0);
  React.useEffect(() => {
    const last = events[events.length - 1];
    if (last && last.id !== lastEventId.current) {
      lastEventId.current = last.id;
      fireHaptic(last.result as ShotResult, haptics);
    }
  }, [events, haptics]);

  // Schedule the bot's turn with a short "thinking" delay.
  React.useEffect(() => {
    if (botThinking && phase === 'playing') {
      const id = setTimeout(() => botTurn(), BOT_DELAY_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [botThinking, phase, botTurn]);

  const view: PublicMatchState | null = match ? projectPublicState(match, 'A') : null;

  const yourTurn = view?.yourTurn ?? false;

  // Subtle turn pulse on the turn indicator.
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
  const ownCellSize = Math.max(10, Math.floor(targetCellSize * 0.42));

  // Sunk ship ids on each side.
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
    <Screen testID="game-play-screen">
      {/* Turn indicator */}
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

      <Spacer size="md" />

      {/* Opponent board — the primary fire grid */}
      <Text variant="caption" color="muted">
        {t('game.play.opponentBoard').toUpperCase()}
      </Text>
      <Spacer size="xs" />
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

      {confirmShot ? (
        <>
          <Spacer size="sm" />
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
        </>
      ) : null}

      <Spacer size="lg" />

      {/* Ships trays */}
      <Card>
        <View style={styles.trays}>
          <ShipsTray
            ships={view.rules.ships}
            sunkIds={opponentSunk}
            title={t('game.play.enemyFleet')}
          />
          <ShipsTray
            ships={view.rules.ships}
            sunkIds={ownSunk}
            title={t('game.play.yourFleet')}
          />
        </View>
      </Card>

      <Spacer size="lg" />

      {/* Own compact board */}
      <Text variant="caption" color="muted">
        {t('game.play.yourBoard').toUpperCase()}
      </Text>
      <Spacer size="xs" />
      <Card style={styles.ownBoardCard}>
        <FleetBoard
          fleet={view.own.fleet}
          shotsReceived={view.own.incoming}
          boardSize={boardSize}
          cellSize={ownCellSize}
          revealShips
        />
      </Card>

      <Spacer size="lg" />

      {/* Event log */}
      <Text variant="caption" color="muted">
        {t('game.log.title').toUpperCase()}
      </Text>
      <Spacer size="xs" />
      <Card>
        <EventLog events={events} />
      </Card>

      <Spacer size="lg" />

      <Button
        label={t('game.play.resign')}
        icon="flag"
        variant="ghost"
        onPress={handleResign}
        testID="game-resign-button"
      />
      <View style={{ height: spacing.md }} />
      <Text variant="caption" color="muted" center>
        {t('game.play.trainingHint')}
      </Text>
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
  turnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  boardCard: {
    padding: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.lg,
  },
  ownBoardCard: {
    alignItems: 'center',
  },
  trays: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
});
