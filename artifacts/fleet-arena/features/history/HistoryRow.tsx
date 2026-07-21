/**
 * A single row in the match-history list: opponent, mode, date, result badge,
 * rating delta and a chevron. Shared by the profile "recent matches" preview
 * and the full history screen.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, spacing } from '@/constants/theme';
import { Badge, Text } from '@/components/ui';
import { Avatar, formatDate, formatDelta, formatDuration } from '@/features/social';
import type { HistoryMatch } from './api';

interface HistoryRowProps {
  match: HistoryMatch;
  result: 'win' | 'loss' | 'draw';
  durationMs: number | null;
  divider?: boolean;
  onPress?: () => void;
}

export function HistoryRow({ match, result, durationMs, divider, onPress }: HistoryRowProps) {
  const colors = useColors();
  const { t, i18n } = useTranslation();

  const oppName =
    match.opponentProfile?.display_name ||
    match.opponentProfile?.username ||
    t(`history.mode.bot`);

  const tone = result === 'win' ? 'success' : result === 'loss' ? 'destructive' : 'muted';
  const delta = match.me.ratingDelta;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.row,
        divider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Avatar
        avatarUrl={match.opponentProfile?.avatar_url}
        name={match.opponentProfile?.username ?? oppName}
        size={40}
      />
      <View style={styles.body}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {t('history.vs', { name: oppName })}
        </Text>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {t(`history.mode.${match.mode}`, { defaultValue: match.mode })}
          {'  ·  '}
          {formatDate(match.finishedAt ?? match.createdAt, i18n.language)}
          {durationMs != null ? `  ·  ${formatDuration(durationMs)}` : ''}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Badge label={t(`history.result.${result}`)} tone={tone} />
        {delta != null ? (
          <Text variant="caption" color={delta >= 0 ? 'success' : 'destructive'}>
            {formatDelta(delta)}
          </Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={iconSize.md} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
});
