import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, ScrollView } from 'react-native';
import { showAlert } from '@/lib/alert';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { duration, iconSize, radii, spacing, typography } from '@/constants/theme';
import { Badge, Button, Card, Screen, Text } from '@/components/ui';
import { EventLog, FleetBoard, ShipsTray, TargetBoard, computeCellSize } from '@/components/game';
import { useSettingsStore } from '@/store/settings';
import { fireHaptic, selectionHaptic, useAnimationsEnabled } from '@/features/game/helpers';
import type { GameEvent } from '@/store/game';
import type { Coord, PublicCell, ShipId, ShotResult } from '@/lib/engine';
import {
  useOnlineMatchStore,
  useMatchRealtime,
  useReconnect,
  useTurnClock,
  formatClock,
  PRESET_PHRASE_KEYS,
} from '@/features/onlineMatch';

export default function OnlinePlayScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { width } = useWindowDimensions();

  const confirmShot = useSettingsStore((s) => s.confirmShot);
  const haptics = useSettingsStore((s) => s.haptics);
  const animationsEnabled = useAnimationsEnabled();

  const matchId = useOnlineMatchStore((s) => s.matchId);
  const view = useOnlineMatchStore((s) => s.view);
  const clock = useOnlineMatchStore((s) => s.clock);
  const clockOffsetMs = useOnlineMatchStore((s) => s.clockOffsetMs);
  const pendingShot = useOnlineMatchStore((s) => s.pendingShot);
  const events = useOnlineMatchStore((s) => s.events);
  const reactions = useOnlineMatchStore((s) => s.reactions);
  const finished = useOnlineMatchStore((s) => s.finished);
  const errorMessage = useOnlineMatchStore((s) => s.errorMessage);
  const firing = useOnlineMatchStore((s) => s.firing);

  const fireAt = useOnlineMatchStore((s) => s.fireAt);
  const resign = useOnlineMatchStore((s) => s.resign);
  const reconnect = useOnlineMatchStore((s) => s.reconnect);
  const addReaction = useOnlineMatchStore((s) => s.addReaction);
  const setStatus = useOnlineMatchStore((s) => s.setStatus);
  const clearError = useOnlineMatchStore((s) => s.clearError);
  const retryPendingShot = useOnlineMatchStore((s) => s.retryPendingShot);
  const cancelPendingShot = useOnlineMatchStore((s) => s.cancelPendingShot);

  const [selected, setSelected] = React.useState<Coord | null>(null);
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (!matchId) router.replace('/(tabs)');
  }, [matchId]);

  React.useEffect(() => {
    if (finished) router.replace('/online/result');
  }, [finished]);

  React.useEffect(() => {
    void reconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { online } = useReconnect(!!matchId && !finished, () => void reconnect());

  useMatchRealtime(matchId, !!matchId && !finished, {
    onMatchRow: (row) => {
      const status = row.status as string | undefined;
      if (status === 'finished' || status === 'abandoned') {
        setStatus(status);
      } else {
        void reconnect();
      }
    },
    onMove: () => {
      void reconnect();
    },
    onEvent: (row) => {
      const type = row.event_type as string | undefined;
      if (type === 'reaction') {
        const payload = (row.payload ?? {}) as { text?: string };
        if (payload.text) addReaction('opponent', payload.text);
      }
    },
  });

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

  const pulseStyle = useAnimatedStyle(() => ({ opacity: 0.6 + pulse.value * 0.4 }));

  const lastEventId = React.useRef<number>(0);
  React.useEffect(() => {
    const last = events[events.length - 1];
    if (last && last.id !== lastEventId.current) {
      lastEventId.current = last.id;
      fireHaptic(last.result as ShotResult, haptics);
    }
  }, [events, haptics]);

  const remainingMs = useTurnClock(
    clock?.turnDeadline ?? null,
    clockOffsetMs,
    !!view && !finished,
  );

  if (!view) {
    return (
      <Screen testID="online-play-screen">
        <Text>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const boardSize = view.rules.boardSize;
  const targetCellSize = computeCellSize(boardSize, width, spacing.lg * 2 + spacing.sm * 2);
  const ownCellSize = Math.max(10, Math.floor(targetCellSize * 0.45));

  const grid = view.opponent.grid as PublicCell[][];
  const ownIncoming = view.own.incoming as Record<string, ShotResult>;
  const ownFleet = view.own.fleet.map((p) => ({
    id: p.id as ShipId,
    length: p.length,
    origin: p.origin,
    orientation: p.orientation as 'horizontal' | 'vertical',
  }));

  const opponentSunk = new Set(view.opponent.sunkShips.map((s) => s.id as ShipId));
  const ownSunk = new Set(
    ownFleet.filter((p) => placementSunk(p, ownIncoming)).map((p) => p.id),
  );

  const highlightCell = pendingShot?.coord ?? selected;
  const inputDisabled = !yourTurn || !!pendingShot || firing || finished;

  const handleCellPress = (x: number, y: number) => {
    if (inputDisabled) return;
    if (confirmShot) {
      setSelected({ x, y });
      selectionHaptic(haptics);
    } else {
      void fireAt(x, y);
      setSelected(null);
    }
  };

  const handleConfirmFire = () => {
    if (selected && !pendingShot) {
      void fireAt(selected.x, selected.y);
      setSelected(null);
    }
  };

  const handleResign = () => {
    showAlert(t('online.play.resignTitle'), t('online.play.resignBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('online.play.resign'), style: 'destructive', onPress: () => void resign() },
    ]);
  };

  const logEvents: GameEvent[] = events.map((e) => ({
    id: e.id,
    by: e.by === 'you' ? 'you' : 'bot',
    coord: e.coord,
    result: e.result,
    sunkShip: e.sunkShip as ShipId | undefined,
  }));

  const latestReaction = reactions.length > 0 ? reactions[reactions.length - 1] : null;

  return (
    <Screen testID="online-play-screen" scroll={false} contentStyle={styles.screenContent}>
      {/* Header Container */}
      <View style={styles.headerContainer}>
        {!online ? (
          <View style={[styles.banner, { backgroundColor: colors.destructive }]}>
            <Feather name="wifi-off" size={iconSize.sm} color={colors.destructiveForeground} />
            <Text variant="caption" style={{ color: colors.destructiveForeground }}>
              {t('online.status.offline')}
            </Text>
            <Pressable onPress={() => void reconnect()} hitSlop={8}>
              <Text variant="caption" style={{ color: colors.destructiveForeground }}>
                {t('online.status.reconnect')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.header}>
          <Animated.View style={[styles.turnRow, yourTurn ? pulseStyle : undefined]}>
            <Badge
              label={yourTurn ? t('online.play.yourTurn') : t('online.play.opponentTurn')}
              tone={yourTurn ? 'success' : 'muted'}
            />
            <View style={styles.clock}>
              <Feather name="clock" size={iconSize.sm} color={colors.mutedForeground} />
              <Text variant="bodyMedium" color={remainingMs != null && remainingMs < 10000 ? 'destructive' : 'foreground'}>
                {formatClock(remainingMs)}
              </Text>
            </View>
            {pendingShot ? (
              <Text variant="caption" color="muted">
                {t('online.play.pending')}
              </Text>
            ) : null}
          </Animated.View>
          <Pressable onPress={handleResign} testID="online-resign-button" hitSlop={12} style={styles.resignButton}>
            <Feather name="flag" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Opponent board */}
      <View style={styles.primaryArea}>
        <View style={styles.sectionHeader}>
          <Text variant="label" color="muted" style={typography.label}>
            {t('online.play.opponentBoard').toUpperCase()}
          </Text>
        </View>
        <Card padded={false} style={styles.boardCard}>
          <TargetBoard
            grid={grid}
            boardSize={boardSize}
            cellSize={targetCellSize}
            selected={highlightCell}
            disabled={inputDisabled}
            animationsEnabled={animationsEnabled}
            onCellPress={handleCellPress}
          />
        </Card>
      </View>

      {/* Fire Action Container */}
      <View style={styles.fireActionContainer}>
        {errorMessage ? (
          <View style={styles.errorBlock}>
            <Pressable onPress={clearError}>
              <Text variant="caption" color="destructive" center>
                {errorMessage}
              </Text>
            </Pressable>
            {pendingShot ? (
              <View style={styles.errorActions}>
                <Button
                  label={t('online.play.retryShot')}
                  icon="rotate-cw"
                  size="sm"
                  loading={firing}
                  onPress={() => void retryPendingShot()}
                />
                <Button
                  label={t('online.play.cancelShot')}
                  variant="ghost"
                  size="sm"
                  onPress={() => void cancelPendingShot()}
                />
              </View>
            ) : null}
          </View>
        ) : confirmShot ? (
          <Button
            label={
              pendingShot
                ? t('online.play.pending')
                : selected
                  ? t('online.play.fireAt', { coord: coordLabel(selected) })
                  : t('online.play.selectTarget')
            }
            icon="crosshair"
            size="md"
            fullWidth
            loading={firing}
            disabled={!selected || inputDisabled}
            onPress={handleConfirmFire}
          />
        ) : <View />}
      </View>

      {/* Reactions Row */}
      <View style={styles.reactionsArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phraseRow}>
          {PRESET_PHRASE_KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => addReaction('you', t(key))}
              style={[styles.phraseChip, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Text variant="caption">{t(key)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {latestReaction ? (
          <Text variant="caption" color="muted" center style={styles.latestReactionText}>
            {latestReaction.by === 'you' ? t('game.log.you') : t('online.play.opponentTurn')}: {latestReaction.text}
          </Text>
        ) : null}
      </View>

      {/* Dashboard (Own Fleet + Trays + Log) */}
      <View style={styles.dashboard}>
        <View style={styles.dashboardRow}>
          {/* Left: Own Board */}
          <View style={styles.ownBoardColumn}>
            <View style={styles.sectionHeader}>
              <Text variant="label" color="muted" style={typography.label}>
                {t('online.play.yourBoard').toUpperCase()}
              </Text>
            </View>
            <Card padded={false} style={styles.ownBoardCard}>
              <FleetBoard
                fleet={ownFleet}
                shotsReceived={ownIncoming}
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
                  ships={view.rules.ships as { id: ShipId; length: number }[]}
                  sunkIds={opponentSunk}
                  title={t('online.play.enemyFleet')}
                  compact
                />
                <ShipsTray
                  ships={view.rules.ships as { id: ShipId; length: number }[]}
                  sunkIds={ownSunk}
                  title={t('online.play.yourFleet')}
                  compact
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.logContainer}>
                <Text variant="label" color="muted" style={typography.label}>
                  {t('game.log.title').toUpperCase()}
                </Text>
                <EventLog events={logEvents} limit={2} />
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
  headerContainer: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  turnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  errorBlock: {
    gap: spacing.xs,
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  reactionsArea: {
    marginBottom: spacing.sm,
  },
  phraseRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  phraseChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  latestReactionText: {
    marginTop: spacing.xs,
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

