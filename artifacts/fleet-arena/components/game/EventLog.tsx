/**
 * Compact event log showing the most recent shots. Uses symbols + text so the
 * outcome is readable without relying on color.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/constants/theme';
import { formatCoord } from '@/lib/engine';
import { Text } from '@/components/ui';
import type { GameEvent } from '@/store/game';

interface EventLogProps {
  events: GameEvent[];
  /** How many recent events to show. */
  limit?: number;
}

export function EventLog({ events, limit = 4 }: EventLogProps) {
  const { t } = useTranslation();
  const recent = events.slice(-limit).reverse();

  if (recent.length === 0) {
    return (
      <Text variant="caption" color="muted">
        {t('game.log.empty')}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {recent.map((e) => {
        const who = e.by === 'you' ? t('game.log.you') : t('game.log.bot');
        const coord = formatCoord(e.coord);
        const symbol = e.result === 'miss' ? '•' : '✕';
        let line: string;
        if (e.result === 'sunk') {
          line = t('game.log.sunk', {
            who,
            coord,
            ship: t(`game.ships.${e.sunkShip}`),
          });
        } else if (e.result === 'hit') {
          line = t('game.log.hit', { who, coord });
        } else {
          line = t('game.log.miss', { who, coord });
        }
        return (
          <Text
            key={e.id}
            variant="caption"
            color={e.result === 'miss' ? 'muted' : 'foreground'}
          >
            {symbol} {line}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
});
