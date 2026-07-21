/**
 * Interactive placement board for fleet setup.
 *
 * Interaction model (tap-based is always fully functional):
 *  - Tap an empty cell to place the currently-selected ship with its origin at
 *    that cell (auto-clamped in-bounds).
 *  - Tap an already-placed ship to pick it up / re-select it.
 *  - A PanResponder allows dragging a placed ship to a new origin; the tap path
 *    remains fully functional regardless.
 *
 * Cells that would make the fleet invalid (overlap / out-of-bounds preview)
 * render red so the player gets live feedback.
 */
import React from 'react';
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { useColors } from '@/hooks/useColors';
import { radii, typography } from '@/constants/theme';
import {
  coordKey,
  formatCoord,
  inBounds,
  placementCells,
} from '@/lib/engine';
import type { Coord, Orientation, Placement, ShipId } from '@/lib/engine';
import { COLUMN_LETTERS, symbolFor } from './boardShared';
import { Text } from '@/components/ui';

interface PlacementBoardProps {
  boardSize: number;
  cellSize: number;
  placements: Placement[];
  /** Currently-selected ship id (its origin follows taps/drags). */
  selectedShipId: ShipId | null;
  selectedLength: number;
  orientation: Orientation;
  onPlace: (origin: Coord) => void;
  onSelectShip: (id: ShipId) => void;
}

export function PlacementBoard({
  boardSize,
  cellSize,
  placements,
  selectedShipId,
  selectedLength,
  orientation,
  onPlace,
  onSelectShip,
}: PlacementBoardProps) {
  const colors = useColors();
  const labelWidth = cellSize;

  // Occupancy map: cellKey -> shipId owning it.
  const owner = new Map<string, ShipId>();
  for (const p of placements) {
    for (const c of placementCells(p)) owner.set(coordKey(c), p.id);
  }

  // Preview: where would the selected ship land for a given origin?
  const previewCells = (origin: Coord): Coord[] => {
    if (selectedShipId == null) return [];
    const cells: Coord[] = [];
    for (let i = 0; i < selectedLength; i++) {
      cells.push(
        orientation === 'horizontal'
          ? { x: origin.x + i, y: origin.y }
          : { x: origin.x, y: origin.y + i },
      );
    }
    return cells;
  };

  const previewValid = (cells: Coord[]): boolean => {
    for (const c of cells) {
      if (!inBounds(c, boardSize)) return false;
      const o = owner.get(coordKey(c));
      if (o && o !== selectedShipId) return false;
    }
    return true;
  };

  const [hoverOrigin, setHoverOrigin] = React.useState<Coord | null>(null);
  const containerRef = React.useRef<View>(null);
  const layout = React.useRef<{ x: number; y: number } | null>(null);

  const cellStep = cellSize + 1; // includes the 0.5 margin on each side

  const originFromPage = React.useCallback(
    (pageX: number, pageY: number): Coord | null => {
      if (!layout.current) return null;
      // The grid starts after the row-label column.
      const gx = pageX - layout.current.x - labelWidth;
      const gy = pageY - layout.current.y - cellStep; // account for header row
      if (gx < 0 || gy < 0) return null;
      const x = Math.floor(gx / cellStep);
      const y = Math.floor(gy / cellStep);
      if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return null;
      return { x, y };
    },
    [boardSize, cellStep, labelWidth],
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        // Let individual cell taps win on a simple press; only capture the
        // gesture once the finger actually moves (a drag). This keeps the
        // tap-to-place path fully functional while enabling drag.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, gesture) =>
          selectedShipId != null &&
          (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const origin = originFromPage(e.nativeEvent.pageX, e.nativeEvent.pageY);
          if (origin) setHoverOrigin(origin);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const origin = originFromPage(e.nativeEvent.pageX, e.nativeEvent.pageY);
          if (origin) setHoverOrigin(origin);
        },
        onPanResponderRelease: (e: GestureResponderEvent) => {
          const origin = originFromPage(e.nativeEvent.pageX, e.nativeEvent.pageY);
          setHoverOrigin(null);
          if (origin) onPlace(origin);
        },
        onPanResponderTerminate: () => setHoverOrigin(null),
      }),
    [selectedShipId, originFromPage, onPlace],
  );

  const hoverCells = hoverOrigin ? previewCells(hoverOrigin) : [];
  const hoverValid = hoverCells.length > 0 ? previewValid(hoverCells) : true;
  const hoverKeys = new Set(hoverCells.map(coordKey));

  return (
    <View
      ref={containerRef}
      onLayout={() => {
        containerRef.current?.measureInWindow((x, y) => {
          layout.current = { x, y };
        });
      }}
      {...panResponder.panHandlers}
    >
      {/* Column header row */}
      <View style={styles.row}>
        <View style={{ width: labelWidth, height: cellSize }} />
        {Array.from({ length: boardSize }).map((_, x) => (
          <View
            key={`col-${x}`}
            style={[styles.label, { width: cellSize, height: cellSize }]}
          >
            <Text variant="caption" color="muted">
              {COLUMN_LETTERS[x]}
            </Text>
          </View>
        ))}
      </View>

      {Array.from({ length: boardSize }).map((_, y) => (
        <View key={`row-${y}`} style={styles.row}>
          <View style={[styles.label, { width: labelWidth, height: cellSize }]}>
            <Text variant="caption" color="muted">
              {y + 1}
            </Text>
          </View>
          {Array.from({ length: boardSize }).map((__, x) => {
            const key = coordKey({ x, y });
            const shipId = owner.get(key);
            const inHover = hoverKeys.has(key);

            let bg = colors.card;
            let symbol = '';
            let glyphColor = colors.accentForeground;

            if (inHover) {
              bg = hoverValid ? colors.accent : colors.destructive;
              symbol = symbolFor('ship');
              glyphColor = hoverValid ? colors.accentForeground : colors.destructiveForeground;
            } else if (shipId) {
              const isSelected = shipId === selectedShipId;
              bg = isSelected ? colors.primary : colors.accent;
              symbol = symbolFor('ship');
              glyphColor = isSelected ? colors.primaryForeground : colors.accentForeground;
            }

            return (
              <View
                key={`c-${x}-${y}`}
                accessibilityRole="button"
                accessibilityLabel={formatCoord({ x, y })}
                onStartShouldSetResponder={() => true}
                onResponderRelease={() => {
                  if (shipId) {
                    // Re-select an existing ship (also acts as pick-up).
                    onSelectShip(shipId);
                  } else if (selectedShipId != null) {
                    onPlace({ x, y });
                  }
                }}
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
                        fontSize: Math.max(10, cellSize * 0.5),
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
  label: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
