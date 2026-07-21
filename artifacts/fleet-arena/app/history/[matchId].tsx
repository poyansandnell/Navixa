import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { Badge, Card, Screen, SectionHeader, Spacer, StatTile, Text } from '@/components/ui';
import { TargetBoard, computeCellSize } from '@/components/game';
import { formatCoord } from '@/lib/engine';
import { useAuth } from '@/features/auth';
import { useSettingsStore } from '@/store/settings';
import {
  fetchMatchDetail,
  matchDurationMs,
  myResult,
  endReasonKey,
  useReplay,
  REPLAY_SPEEDS,
  type MatchDetail,
} from '@/features/history';
import {
  Avatar,
  formatDelta,
  formatDuration,
  formatPercent,
} from '@/features/social';

export default function ReplayScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const selfId = user?.id ?? null;
  const animationsEnabled = useSettingsStore((s) => s.animations && !s.reducedMotion);

  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);

  const load = useCallback(async () => {
    if (!matchId || !selfId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await fetchMatchDetail(String(matchId), selfId);
      if (!d) {
        setNotReady(true);
      } else if (d.match.status !== 'finished' && d.match.status !== 'abandoned') {
        setNotReady(true);
      } else {
        setDetail(d);
      }
    } catch {
      setNotReady(true);
    } finally {
      setLoading(false);
    }
  }, [matchId, selfId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const boardSize = detail?.match.boardSize ?? 10;
  const moves = detail?.moves ?? [];
  const viewerId = detail?.match.me.playerId ?? selfId;

  const replay = useReplay(moves, boardSize, viewerId ?? null);

  // Two half-width boards side by side.
  const cellSize = useMemo(() => {
    const half = (Dimensions.get('window').width - spacing.lg * 2 - spacing.md) / 2;
    return computeCellSize(boardSize, half, spacing.sm * 2);
  }, [boardSize]);

  if (loading) {
    return (
      <Screen testID="replay-screen">
        <View style={styles.centerPad}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (notReady || !detail) {
    return (
      <Screen testID="replay-screen">
        <Card>
          <Text variant="subhead" color="muted" center>
            {t('history.replay.notReady')}
          </Text>
        </Card>
      </Screen>
    );
  }

  const { match } = detail;
  const result = myResult(match);
  const resultTone = result === 'win' ? 'success' : result === 'loss' ? 'destructive' : 'muted';
  const oppName =
    match.opponentProfile?.display_name ||
    match.opponentProfile?.username ||
    t('history.mode.bot');
  const durationMs = matchDurationMs(match);

  const lastMove = replay.frame.lastMove;
  const lastLabel = lastMove
    ? replay.frame.lastByViewer
      ? t('history.replay.firedByYou', { coord: formatCoord({ x: lastMove.x, y: lastMove.y }) })
      : t('history.replay.firedBy', {
          name: oppName,
          coord: formatCoord({ x: lastMove.x, y: lastMove.y }),
        })
    : '';
  const lastOutcome = lastMove
    ? lastMove.sunkShip
      ? t('history.replay.sunk', { ship: t(`game.ships.${lastMove.sunkShip}`, { defaultValue: lastMove.sunkShip }) })
      : lastMove.isHit
        ? t('history.replay.hit')
        : t('history.replay.miss')
    : '';

  return (
    <Screen testID="replay-screen">
      {/* Match summary */}
      <View style={styles.summaryHeader}>
        <Avatar
          avatarUrl={match.opponentProfile?.avatar_url}
          name={match.opponentProfile?.username ?? oppName}
          size={48}
        />
        <View style={styles.summaryBody}>
          <Text variant="title" numberOfLines={1}>
            {t('history.vs', { name: oppName })}
          </Text>
          <Text variant="caption" color="muted">
            {t(`history.mode.${match.mode}`, { defaultValue: match.mode })}
            {'  ·  '}
            {t(`history.reason.${endReasonKey(match)}`)}
          </Text>
        </View>
        <Badge label={t(`history.result.${result}`)} tone={resultTone} />
      </View>

      <Spacer size="md" />

      <Card>
        <View style={styles.statsRow}>
          <StatTile
            label={t('history.ratingDelta')}
            value={formatDelta(match.me.ratingDelta)}
            tone={(match.me.ratingDelta ?? 0) >= 0 ? 'success' : 'destructive'}
          />
          <StatTile label={t('history.moves')} value={String(match.me.shotsFired)} />
          <StatTile
            label={t('history.hitRate')}
            value={
              match.me.shotsFired > 0
                ? formatPercent(match.me.hits / match.me.shotsFired)
                : '—'
            }
            tone="accent"
          />
          <StatTile label={t('history.duration')} value={formatDuration(durationMs)} />
        </View>
      </Card>

      <Spacer size="xl" />

      {/* Boards */}
      <SectionHeader title={t('history.replay.title')} />
      <View style={styles.boards}>
        <View style={styles.boardCol}>
          <Text variant="caption" color="muted" center>
            {t('history.replay.yourBoard')}
          </Text>
          <Spacer size="xs" />
          <TargetBoard
            grid={replay.frame.ownGrid}
            boardSize={boardSize}
            cellSize={cellSize}
            selected={null}
            disabled
            animationsEnabled={animationsEnabled}
            onCellPress={() => {}}
          />
        </View>
        <View style={styles.boardCol}>
          <Text variant="caption" color="muted" center>
            {t('history.replay.opponentBoard')}
          </Text>
          <Spacer size="xs" />
          <TargetBoard
            grid={replay.frame.opponentGrid}
            boardSize={boardSize}
            cellSize={cellSize}
            selected={null}
            disabled
            animationsEnabled={animationsEnabled}
            onCellPress={() => {}}
          />
        </View>
      </View>

      <Spacer size="md" />

      {/* Move status */}
      <Card>
        <Text variant="callout">
          {t('history.replay.move', { n: replay.step, total: replay.total })}
        </Text>
        {lastMove ? (
          <>
            <Spacer size="xs" />
            <Text variant="subhead" color="muted">
              {lastLabel} — {lastOutcome}
            </Text>
          </>
        ) : null}
      </Card>

      <Spacer size="md" />

      {/* Transport controls */}
      <View style={styles.controls}>
        <CtrlButton icon="skip-back" onPress={replay.jumpToStart} disabled={replay.atStart} />
        <CtrlButton icon="chevron-left" onPress={replay.prev} disabled={replay.atStart} />
        <CtrlButton
          icon={replay.playing ? 'pause' : 'play'}
          onPress={replay.toggle}
          primary
          disabled={replay.total === 0}
        />
        <CtrlButton icon="chevron-right" onPress={replay.next} disabled={replay.atEnd} />
        <CtrlButton icon="skip-forward" onPress={replay.jumpToEnd} disabled={replay.atEnd} />
      </View>

      <Spacer size="md" />

      {/* Speed */}
      <View style={styles.speedRow}>
        <Text variant="caption" color="muted">
          {t('history.replay.speed')}
        </Text>
        <View style={[styles.segment, { backgroundColor: colors.secondary }]}>
          {REPLAY_SPEEDS.map((s) => {
            const active = replay.speed === s;
            return (
              <Pressable
                key={s}
                onPress={() => replay.setSpeed(s)}
                accessibilityRole="button"
                style={[styles.segmentItem, active && { backgroundColor: colors.card }]}
              >
                <Text variant="caption" color={active ? 'foreground' : 'muted'}>
                  {s}×
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

function CtrlButton({
  icon,
  onPress,
  disabled,
  primary,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[
        styles.ctrl,
        {
          backgroundColor: primary ? colors.primary : colors.card,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Feather
        name={icon}
        size={primary ? iconSize.lg : iconSize.md}
        color={primary ? colors.primaryForeground : colors.foreground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centerPad: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryBody: {
    flex: 1,
    gap: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  boards: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  boardCol: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctrl: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: spacing.xs,
    gap: spacing.xs,
    flex: 1,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
});
