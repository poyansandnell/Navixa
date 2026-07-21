/**
 * The opponent's board — the primary fire grid. Tapping selects a cell; the
 * screen decides whether to confirm or direct-fire. Fired cells show
 * miss/hit/sunk with symbols (not color alone) and animate a splash/flash when
 * animations are enabled.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { duration, radii, typography } from '@/constants/theme';
import { formatCoord } from '@/lib/engine';
import type { PublicCell } from '@/lib/engine';
import { COLUMN_LETTERS, symbolFor } from './boardShared';

interface TargetBoardProps {
  grid: PublicCell[][];
  boardSize: number;
  cellSize: number;
  selected: { x: number; y: number } | null;
  disabled: boolean;
  animationsEnabled: boolean;
  onCellPress: (x: number, y: number) => void;
}

export function TargetBoard({
  grid,
  boardSize,
  cellSize,
  selected,
  disabled,
  animationsEnabled,
  onCellPress,
}: TargetBoardProps) {
  const labelWidth = cellSize;
  return (
    <View accessibilityRole="none">
      {/* Column header row */}
      <View style={styles.row}>
        <View style={{ width: labelWidth, height: cellSize }} />
        {Array.from({ length: boardSize }).map((_, x) => (
          <ColLabel key={`col-${x}`} letter={COLUMN_LETTERS[x]} size={cellSize} />
        ))}
      </View>
      {grid.map((rowCells, y) => (
        <View key={`row-${y}`} style={styles.row}>
          <RowLabel index={y + 1} width={labelWidth} height={cellSize} />
          {rowCells.map((cell, x) => (
            <TargetCell
              key={`c-${x}-${y}`}
              x={x}
              y={y}
              state={cell}
              size={cellSize}
              selected={selected?.x === x && selected?.y === y}
              disabled={disabled}
              animationsEnabled={animationsEnabled}
              onPress={onCellPress}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

interface TargetCellProps {
  x: number;
  y: number;
  state: PublicCell;
  size: number;
  selected: boolean;
  disabled: boolean;
  animationsEnabled: boolean;
  onPress: (x: number, y: number) => void;
}

function TargetCell({
  x,
  y,
  state,
  size,
  selected,
  disabled,
  animationsEnabled,
  onPress,
}: TargetCellProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const prev = React.useRef<PublicCell>(state);

  React.useEffect(() => {
    if (prev.current !== state && state !== 'unknown' && animationsEnabled) {
      // Splash (miss) is a gentle pop; hit/sunk is a stronger flash.
      const peak = state === 'miss' ? 1.12 : 1.28;
      scale.value = withSequence(
        withTiming(peak, { duration: duration.instant }),
        withTiming(1, { duration: duration.fast }),
      );
    }
    prev.current = state;
  }, [state, animationsEnabled, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg = (() => {
    switch (state) {
      case 'miss':
        return colors.secondary;
      case 'hit':
        return colors.primary;
      case 'sunk':
        return colors.destructive;
      case 'unknown':
      default:
        return colors.card;
    }
  })();

  const glyphColor = (() => {
    switch (state) {
      case 'hit':
        return colors.primaryForeground;
      case 'sunk':
        return colors.destructiveForeground;
      case 'miss':
        return colors.mutedForeground;
      default:
        return colors.foreground;
    }
  })();

  const symbol = symbolFor(
    state === 'miss' ? 'miss' : state === 'hit' ? 'hit' : state === 'sunk' ? 'sunk' : 'none',
  );

  const stateKey =
    state === 'unknown'
      ? 'unknown'
      : state === 'miss'
        ? 'miss'
        : state === 'hit'
          ? 'hit'
          : 'sunk';
  const a11y = t(`game.a11y.cell`, {
    coord: formatCoord({ x, y }),
    state: t(`game.a11y.state.${stateKey}`),
  });
  const a11yFull = selected ? `${a11y}, ${t('game.a11y.selected')}` : a11y;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yFull}
      accessibilityState={{ selected, disabled: disabled || state !== 'unknown' }}
      disabled={disabled || state !== 'unknown'}
      onPress={() => onPress(x, y)}
      hitSlop={0}
    >
      <Animated.View
        style={[
          styles.cell,
          animStyle,
          {
            width: size,
            height: size,
            backgroundColor: bg,
            borderColor: selected ? colors.accent : colors.border,
            borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        {symbol ? (
          <Animated.Text
            style={[
              typography.bodyMedium,
              {
                color: glyphColor,
                fontSize: Math.max(12, size * 0.5),
                fontFamily: 'Inter_700Bold',
              },
            ]}
          >
            {symbol}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function ColLabel({ letter, size }: { letter: string; size: number }) {
  const colors = useColors();
  return (
    <View style={[styles.label, { width: size, height: size }]}>
      <Animated.Text style={[typography.caption, { color: colors.mutedForeground }]}>
        {letter}
      </Animated.Text>
    </View>
  );
}

function RowLabel({ index, width, height }: { index: number; width: number; height: number }) {
  const colors = useColors();
  return (
    <View style={[styles.label, { width, height }]}>
      <Animated.Text style={[typography.caption, { color: colors.mutedForeground }]}>
        {index}
      </Animated.Text>
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
    margin: 0.5,
  },
  label: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
