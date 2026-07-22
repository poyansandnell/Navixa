import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { Text } from './Text';

type StatTone =
  | 'foreground'
  | 'primary'
  | 'accent'
  | 'success'
  | 'destructive'
  | 'warning';

interface StatTileProps {
  label: string;
  value: string;
  tone?: StatTone;
}

export function StatTile({ label, value, tone = 'foreground' }: StatTileProps) {
  return (
    <View style={styles.tile}>
      <Text variant="h2" color={tone}>
        {value}
      </Text>
      <Text variant="caption" color="muted">
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
});
