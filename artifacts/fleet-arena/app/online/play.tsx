import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { duration, iconSize, radii, spacing } from '@/constants/theme';
import { Badge, Button, Card, Screen, Spacer, Text } from '@/components/ui';
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
  REACTION_EMOJIS,
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

  // No match → bail to the Play tab.
  React.useEffect(() => {
    if (!matchId) router.replace('/(tabs)');
  }, [matchId]);

  // Navigate to result when finished.
  React.useEffect(() => {
    if (finished) router.replace('/online/result');
  }, [finished]);

  // Rebuild authoritative state on entry.
  React.useEffect(() => {
    void reconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect on foreground / network regain.
  const { online } = useReconnect(!!matchId && !finished, () => void reconnect());

  // Realtime: opponent shots / turn changes / match status.
  useMatchRealtime(matchId, !!matchId && !finished, {
    onMatchRow: (row) => {
      const status = row.status as string | undefined;
      if (status === 'finished' || status === 'abandoned') {
        setStatus(status);
      } else {
        // Turn / clock changed on the server — rebuild.
        void reconnect();
      }
    },
    onMove: () => {
      // An opponent move landed; rebuild to pick up the new turn + our incoming.
      void reconnect();
    },
    onEvent: (row) => {
      // Reactions are not currently server-writable (see NOTE); if an events
      // row ever carries one we surface it as an opponent reaction.
      const type = row.event_type as string | undefined;
      if (type === 'reaction') {
        const payload = (row.payload ?? {}) as { text?: string };
        if (payload.text) addReaction('opponent', payload.text);
      }
    },
  });

  const yourTurn = view?.yourTurn ?? false;

  // Turn pulse.
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

  // Haptics on the latest event.
  const lastEventId = React.useRef<number>(0);
  React.useEffect(() => {
    const last = events[events.length - 1];
    if (last && last.id !== lastEventId.current) {
      lastEventId.current = last.id;
      fireHaptic(last.result as ShotResult, haptics);
    }
  }, [events, haptics]);

  // Drift-corrected turn clock (only meaningful while a turn is running).
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
  const ownCellSize = Math.max(10, Math.floor(targetCellSize * 0.42));

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

  // Show the pending shot (or the selected-but-unconfirmed cell) as `selected`.
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

  // Map online events to the EventLog's GameEvent shape ('opponent' → 'bot').
  const logEvents: GameEvent[] = events.map((e) => ({
    id: e.id,
    by: e.by === 'you' ? 'you' : 'bot',
    coord: e.coord,
    result: e.result,
    sunkShip: e.sunkShip as ShipId | undefined,
  }));

  return (
    <Screen testID="online-play-screen">
      {/* Network status banner */}
      {!online ? (
        <>
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
          <Spacer size="sm" />
        </>
      ) : null}

      {/* Turn + clock */}
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

      <Spacer size="md" />

      {/* Opponent board */}
      <Text variant="caption" color="muted">
        {t('online.play.opponentBoard').toUpperCase()}
      </Text>
      <Spacer size="xs" />
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

      {confirmShot ? (
        <>
          <Spacer size="sm" />
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
        </>
      ) : null}

      {errorMessage ? (
        <>
          <Spacer size="sm" />
          <Pressable onPress={clearError}>
            <Text variant="caption" color="destructive" center>
              {errorMessage}
            </Text>
          </Pressable>
          {pendingShot ? (
            <>
              <Spacer size="xs" />
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
            </>
          ) : null}
        </>
      ) : null}

      <Spacer size="lg" />

      {/* Fleets */}
      <Card>
        <View style={styles.trays}>
          <ShipsTray ships={view.rules.ships as { id: ShipId; length: number }[]} sunkIds={opponentSunk} title={t('online.play.enemyFleet')} />
          <ShipsTray ships={view.rules.ships as { id: ShipId; length: number }[]} sunkIds={ownSunk} title={t('online.play.yourFleet')} />
        </View>
      </Card>

      <Spacer size="lg" />

      {/* Own board */}
      <Text variant="caption" color="muted">
        {t('online.play.yourBoard').toUpperCase()}
      </Text>
      <Spacer size="xs" />
      <Card style={styles.ownBoardCard}>
        <FleetBoard
          fleet={ownFleet}
          shotsReceived={ownIncoming}
          boardSize={boardSize}
          cellSize={ownCellSize}
          revealShips
        />
      </Card>

      <Spacer size="lg" />

      {/* Quick reactions (locally visible only — see NOTE) */}
      <Text variant="caption" color="muted">
        {t('online.play.reactionsTitle').toUpperCase()}
      </Text>
      <Spacer size="xs" />
      <Card>
        <View style={styles.emojiRow}>
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => addReaction('you', emoji)}
              style={[styles.emojiChip, { backgroundColor: colors.secondary }]}
              accessibilityRole="button"
            >
              <Text variant="body">{emoji}</Text>
            </Pressable>
          ))}
        </View>
        <Spacer size="sm" />
        <View style={styles.phraseRow}>
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
        </View>
        {reactions.length > 0 ? (
          <>
            <Spacer size="sm" />
            {reactions.slice(-3).map((r) => (
              <Text key={r.id} variant="caption" color="muted">
                {r.by === 'you' ? t('game.log.you') : t('online.play.opponentTurn')}: {r.text}
              </Text>
            ))}
          </>
        ) : null}
        <Spacer size="xs" />
        {/* NOTE: match_events has no client INSERT policy (RLS server-only) and
            there is no reaction edge function, so reactions are locally visible
            only. TODO: wire through an edge function when one is added. */}
        <Text variant="caption" color="muted">
          {t('online.play.reactionsLocalNote')}
        </Text>
      </Card>

      <Spacer size="lg" />

      {/* Event log */}
      <Text variant="caption" color="muted">
        {t('game.log.title').toUpperCase()}
      </Text>
      <Spacer size="xs" />
      <Card>
        <EventLog events={logEvents} />
      </Card>

      <Spacer size="lg" />

      <Button
        label={t('online.play.resign')}
        icon="flag"
        variant="ghost"
        onPress={handleResign}
        testID="online-resign-button"
      />
      <View style={{ height: spacing.md }} />
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  turnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phraseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  phraseChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
