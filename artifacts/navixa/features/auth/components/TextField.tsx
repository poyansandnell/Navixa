import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Text } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { radii, spacing, typography } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  /** Optional trailing status text (e.g. "available"). */
  hint?: string | null;
  hintTone?: 'muted' | 'success' | 'destructive';
}

/**
 * Themed labelled text input used by the auth forms. Kept inside features/auth
 * so it doesn't expand the shared components/ui surface.
 */
export function TextField({
  label,
  error,
  hint,
  hintTone = 'muted',
  style,
  ...rest
}: TextFieldProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          typography.body,
          {
            backgroundColor: colors.secondary,
            borderColor: error ? colors.destructive : colors.border,
            color: colors.foreground,
            borderRadius: radii.md,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color="destructive">
          {error}
        </Text>
      ) : hint ? (
        <Text
          variant="caption"
          color={hintTone === 'muted' ? 'muted' : hintTone}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
