import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing, typography } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZE_MAP: Record<
  ButtonSize,
  { paddingV: number; paddingH: number; font: number; icon: number }
> = {
  sm: { paddingV: spacing.sm, paddingH: spacing.lg, font: 14, icon: iconSize.sm },
  md: { paddingV: spacing.md, paddingH: spacing.xl, font: 16, icon: iconSize.md },
  lg: { paddingV: spacing.lg, paddingH: spacing.xxl, font: 18, icon: iconSize.lg },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  testID,
}: ButtonProps) {
  const colors = useColors();
  const dims = SIZE_MAP[size];

  const palette = (() => {
    switch (variant) {
      case 'secondary':
        return { bg: colors.secondary, fg: colors.secondaryForeground, border: 'transparent' };
      case 'accent':
        return { bg: colors.accent, fg: colors.accentForeground, border: 'transparent' };
      case 'success':
        return { bg: colors.success, fg: colors.successForeground, border: 'transparent' };
      case 'ghost':
        return { bg: 'transparent', fg: colors.foreground, border: colors.border };
      case 'primary':
      default:
        return { bg: colors.primary, fg: colors.primaryForeground, border: 'transparent' };
    }
  })();

  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderRadius: radii.lg,
          paddingVertical: dims.paddingV,
          paddingHorizontal: dims.paddingH,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Feather name={icon} size={dims.icon} color={palette.fg} /> : null}
          <Text
            numberOfLines={1}
            style={[
              typography.bodyMedium,
              { color: palette.fg, fontSize: dims.font, fontFamily: 'Inter_600SemiBold' },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
