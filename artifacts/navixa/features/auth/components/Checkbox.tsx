import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Text } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  testID?: string;
}

/** Simple accessible checkbox row used in the auth / onboarding forms. */
export function Checkbox({ checked, onToggle, label, testID }: CheckboxProps) {
  const colors = useColors();

  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? colors.accent : colors.border,
            backgroundColor: checked ? colors.accent : 'transparent',
            borderRadius: radii.sm,
          },
        ]}
      >
        {checked ? (
          <Feather
            name="check"
            size={iconSize.xs}
            color={colors.accentForeground}
          />
        ) : null}
      </View>
      <Text variant="subhead" color="muted" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  label: {
    flex: 1,
  },
});
