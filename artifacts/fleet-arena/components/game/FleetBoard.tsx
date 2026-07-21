/**
 * A read-only board that renders a full fleet plus the shots that have landed
 * on it. Used for the player's own compact board during play and for revealing
 * both fleets on the result screen. Ship cells use a glyph so they read in
 * colorblind mode; hits/misses/sunk use symbols too.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useColors } from '@/hooks/useColors';
import { radii, typography } from '@/constants/theme';
import { coordKey, placementCells } from '@/lib/engine';
import type { Fleet, ShotResult } from '@/lib/engine';
import { symbolFor } from './boardShared';
import { Text } from '@/components/ui';

interface FleetBoardProps {
  fleet: Fleet;
  shotsReceived: Record<string, ShotResult>;
  boardSize: number;
  cellSize: number;
  /** Show ship cells (true for own board / reveal, false to hide). */
  revealShips?: boolean;
  testID?: string;
}

export function FleetBoard({
  fleet,
  shotsReceived,
  boardSize,
  cellSize,
  revealShips = true,
  testID,
}: FleetBoardProps) {
  const colors = useColors();

  // Precompute which cells hold a ship.
  const shipCells = new Set<string>();
  for (const p of fleet) {
    for (const c of placementCells(p)) shipCells.add(coordKey(c));
  }

  return (
    <View testID={testID}>
      {Array.from({ length: boardSize }).map((_, y) => (
        <View key={`r-${y}`} style={styles.row}>
          {Array.from({ length: boardSize }).map((__, x) => {
            const key = coordKey({ x, y });
            const shot = shotsReceived[key];
            const isShip = shipCells.has(key);

            let bg = colors.card;
            let symbol = '';
            let glyphColor = colors.foreground;

            if (shot === 'miss') {
              bg = colors.secondary;
              symbol = symbolFor('miss');
              glyphColor = colors.mutedForeground;
            } else if (shot === 'hit') {
              bg = colors.primary;
              symbol = symbolFor('hit');
              glyphColor = colors.primaryForeground;
            } else if (shot === 'sunk') {
              bg = colors.destructive;
              symbol = symbolFor('sunk');
              glyphColor = colors.destructiveForeground;
            } else if (isShip && revealShips) {
              bg = colors.accent;
              symbol = symbolFor('ship');
              glyphColor = colors.accentForeground;
            }

            return (
              <View
                key={`c-${x}-${y}`}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: bg,
                    borderColor: colors.border,
                  },
                ]}
              >
                {symbol ? (
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: glyphColor,
                        fontSize: Math.max(8, cellSize * 0.5),
                        fontFamily: 'Inter_700Bold',
                      },
                    ]}
                  >
                    {symbol}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm / 2,
    borderWidth: StyleSheet.hairlineWidth,
    margin: 0.5,
  },
});
