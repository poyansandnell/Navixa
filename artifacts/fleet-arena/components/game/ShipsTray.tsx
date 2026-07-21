/**
 * Remaining-ships tray. Shows each ship in the fleet as a row of pips; sunk
 * ships are dimmed and struck through with the sunk glyph so status is clear
 * without relying on color.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { radii, spacing, typography } from '@/constants/theme';
import type { ShipId, ShipSpec } from '@/lib/engine';
import { Text } from '@/components/ui';

interface ShipsTrayProps {
  ships: ShipSpec[];
  /** Ids of ships that are sunk. */
  sunkIds: Set<ShipId>;
  title: string;
}

export function ShipsTray({ ships, sunkIds, title }: ShipsTrayProps) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text variant="caption" color="muted">
        {title.toUpperCase()}
      </Text>
      <View style={styles.list}>
        {ships.map((ship) => {
          const sunk = sunkIds.has(ship.id);
          return (
            <View key={ship.id} style={styles.shipRow}>
              <View style={styles.pips}>
                {Array.from({ length: ship.length }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      {
                        backgroundColor: sunk ? colors.destructive : colors.accent,
                        opacity: sunk ? 0.55 : 1,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text
                variant="caption"
                color={sunk ? 'destructive' : 'muted'}
                style={sunk ? styles.struck : undefined}
              >
                {sunk ? '✕ ' : ''}
                {t(`game.ships.${ship.id}`)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    flex: 1,
  },
  list: {
    gap: spacing.xs,
  },
  shipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pips: {
    flexDirection: 'row',
    gap: 2,
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: radii.sm / 4,
  },
  struck: {
    ...typography.caption,
    textDecorationLine: 'line-through',
  },
});
