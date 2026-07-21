import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { iconSize, spacing } from '@/constants/theme';
import { Text } from './Text';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      <Text variant="title">{title}</Text>
      {actionLabel ? (
        <Pressable
          onPress={onActionPress}
          accessibilityRole="button"
          style={styles.action}
        >
          <Text variant="callout" color="accent">
            {actionLabel}
          </Text>
          <Feather name="chevron-right" size={iconSize.sm} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
