import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useColors } from '@/hooks/useColors';
import { radii, shadows, spacing } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({
  children,
  onPress,
  elevated = false,
  padded = true,
  style,
  testID,
}: CardProps) {
  const colors = useColors();

  const baseStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: padded ? spacing.lg : 0,
    },
    elevated ? shadows.md : null,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [baseStyle, { opacity: pressed ? 0.9 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={baseStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
