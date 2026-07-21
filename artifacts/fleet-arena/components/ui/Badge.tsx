import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useColors } from '@/hooks/useColors';
import { radii, spacing, typography } from '@/constants/theme';
import { Text } from './Text';

type BadgeTone = 'accent' | 'primary' | 'success' | 'destructive' | 'muted' | 'warning';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'accent' }: BadgeProps) {
  const colors = useColors();

  const { bg, fg } = (() => {
    switch (tone) {
      case 'primary':
        return { bg: colors.primary, fg: colors.primaryForeground };
      case 'success':
        return { bg: colors.success, fg: colors.successForeground };
      case 'destructive':
        return { bg: colors.destructive, fg: colors.destructiveForeground };
      case 'warning':
        return { bg: colors.warning, fg: colors.warningForeground };
      case 'muted':
        return { bg: colors.muted, fg: colors.mutedForeground };
      case 'accent':
      default:
        return { bg: colors.accent, fg: colors.accentForeground };
    }
  })();

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[typography.label, { color: fg }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
});
