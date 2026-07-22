import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { iconSize, spacing } from '@/constants/theme';
import { Text } from './Text';

interface EmptyStateProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <Feather name={icon} size={iconSize.xxl} color={colors.mutedForeground} />
      <Text variant="title" color="muted" center>
        {title}
      </Text>
      {description ? (
        <Text variant="subhead" color="muted" center>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
  },
});
