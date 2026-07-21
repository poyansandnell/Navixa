import React from 'react';
import {
  Text as RNText,
  StyleSheet,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { useColors } from '@/hooks/useColors';
import { typography } from '@/constants/theme';

type TextVariant = keyof typeof typography;
type TextColor =
  | 'foreground'
  | 'muted'
  | 'primary'
  | 'accent'
  | 'success'
  | 'destructive'
  | 'warning';

interface AppTextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Text({
  variant = 'body',
  color = 'foreground',
  center = false,
  style,
  children,
  ...rest
}: AppTextProps) {
  const colors = useColors();

  const colorValue = (() => {
    switch (color) {
      case 'muted':
        return colors.mutedForeground;
      case 'primary':
        return colors.primary;
      case 'accent':
        return colors.accent;
      case 'success':
        return colors.success;
      case 'destructive':
        return colors.destructive;
      case 'warning':
        return colors.warning;
      case 'foreground':
      default:
        return colors.foreground;
    }
  })();

  return (
    <RNText
      {...rest}
      style={[
        typography[variant],
        { color: colorValue },
        center && styles.center,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
});
