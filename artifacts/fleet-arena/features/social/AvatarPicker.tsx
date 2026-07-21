/**
 * Modal-free inline avatar picker: a grid of the built-in presets. Selecting a
 * preset calls `onSelect` with its id. Rendered inside a Card on the profile
 * screen (revealed via a toggle).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useColors } from '@/hooks/useColors';
import { radii, spacing } from '@/constants/theme';
import { Avatar } from './Avatar';
import { AVATAR_PRESETS, AVATAR_PREFIX } from './avatars';

interface AvatarPickerProps {
  /** Currently stored avatar value ("preset:<id>"). */
  value?: string | null;
  onSelect: (presetId: string) => void;
}

export function AvatarPicker({ value, onSelect }: AvatarPickerProps) {
  const colors = useColors();
  const currentId = value && value.startsWith(AVATAR_PREFIX) ? value.slice(AVATAR_PREFIX.length) : null;

  return (
    <View style={styles.grid}>
      {AVATAR_PRESETS.map((preset) => {
        const selected = preset.id === currentId;
        return (
          <Pressable
            key={preset.id}
            onPress={() => onSelect(preset.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.item,
              {
                borderColor: selected ? colors.primary : 'transparent',
                backgroundColor: selected ? colors.secondary : 'transparent',
              },
            ]}
          >
            <Avatar preset={preset} size={52} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  item: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
});
