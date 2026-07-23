/**
 * Navixa — "Your matches" list for the Play tab.
 *
 * Fetches the caller's active matches from `GET /api/matches/active` and renders
 * a resumable row for each. Refetches whenever the tab regains focus and on any
 * realtime match event (so a turn change bubbles up immediately). Rows are
 * server-sorted your-turn-first; your-turn rows are emphasized.
 *
 * Tapping a row resumes the match: pending/placing → fleet setup, active → play.
 * Both paths reuse the online store's `init` + the target screen's own reconnect.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { Badge, Card, EmptyState, Text } from '@/components/ui';
import { Avatar } from '@/features/social';
import { getSocket } from '@/lib/socket';
import { fetchActiveMatches, type ActiveMatch } from './client';
import { useOnlineMatchStore } from './store';

/** Format the time remaining until a turn deadline in a compact, localized way. */
function useTimeLeftLabel() {
  const { t } = useTranslation();
  return React.useCallback(
    (deadline: string | null): string | null => {
      if (!deadline) return null;
      const ms = Date.parse(deadline) - Date.now();
      if (Number.isNaN(ms)) return null;
      if (ms <= 0) return t('online.active.expired');
      const minutes = Math.floor(ms / 60000);
      if (minutes < 60) {
        return t('online.active.timeLeft', {
          time: t('online.active.minutes', { count: Math.max(1, minutes) }),
        });
      }
      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return t('online.active.timeLeft', {
          time: t('online.active.hours', { count: hours }),
        });
      }
      const days = Math.floor(hours / 24);
      return t('online.active.timeLeft', {
        time: t('online.active.days', { count: days }),
      });
    },
    [t],
  );
}

export function ActiveMatches() {
  const { t } = useTranslation();
  const colors = useColors();
  const initMatch = useOnlineMatchStore((s) => s.init);
  const timeLeftLabel = useTimeLeftLabel();

  const [matches, setMatches] = React.useState<ActiveMatch[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetchActiveMatches();
      setMatches(res.matches);
    } catch {
      // Best-effort: leave the previous list in place.
    } finally {
      setLoaded(true);
    }
  }, []);

  // Refetch on focus.
  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load]),
  );

  // Refetch on realtime match events (turn change / match end).
  React.useEffect(() => {
    let socket: ReturnType<typeof getSocket> | null = null;
    try {
      socket = getSocket();
    } catch {
      socket = null;
    }
    if (!socket) return;
    const onAny = () => void load();
    socket.on('match:update', onAny);
    socket.on('match:move', onAny);
    socket.on('matchmaking:matched', onAny);
    return () => {
      socket?.off('match:update', onAny);
      socket?.off('match:move', onAny);
      socket?.off('matchmaking:matched', onAny);
    };
  }, [load]);

  const resume = React.useCallback(
    (m: ActiveMatch) => {
      initMatch(m.matchId, m.mode === 'ranked', m.tempo);
      if (m.status === 'pending' || m.status === 'placing') {
        router.push('/online/setup');
      } else {
        router.push('/online/play');
      }
    },
    [initMatch],
  );

  if (!loaded) return null;

  if (matches.length === 0) {
    return (
      <Card>
        <EmptyState icon="crosshair" title={t('online.active.empty')} />
      </Card>
    );
  }

  return (
    <View style={styles.list}>
      {matches.map((m) => {
        const opponentName = m.opponent?.username ?? t('online.active.unknownOpponent');
        const time = timeLeftLabel(m.turnDeadline);
        return (
          <Card
            key={m.matchId}
            onPress={() => resume(m)}
            elevated={m.yourTurn}
            style={[
              styles.row,
              m.yourTurn ? { borderColor: colors.success, borderWidth: 1 } : undefined,
            ]}
            testID={`active-match-${m.matchId}`}
          >
            <View style={styles.rowInner}>
              <Avatar avatarUrl={m.opponent?.avatarUrl} name={opponentName} size={44} />
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {opponentName}
                  </Text>
                  <Badge
                    label={t(`online.tempo.${m.tempo}`)}
                    tone={m.tempo === 'blitz' ? 'warning' : 'muted'}
                  />
                </View>
                <View style={styles.metaRow}>
                  <Text
                    variant="caption"
                    color={m.yourTurn ? 'success' : 'muted'}
                  >
                    {m.yourTurn ? t('online.active.yourTurn') : t('online.active.waiting')}
                  </Text>
                  {time ? (
                    <Text variant="caption" color="muted">
                      · {time}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Feather name="chevron-right" size={iconSize.md} color={colors.mutedForeground} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    borderRadius: radii.lg,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
