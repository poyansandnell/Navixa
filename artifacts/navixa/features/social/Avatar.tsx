/**
 * Renders a built-in preset avatar (colored tile + naval icon) with an initial
 * fallback. No network images — presets are fully local.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { radii } from '@/constants/theme';
import { Text } from '@/components/ui';
import { resolveAvatar, initialFor, type AvatarPreset } from './avatars';

interface AvatarProps {
  /** Value stored in profiles.avatar_url ("preset:<id>") — may be null. */
  avatarUrl?: string | null;
  /** Username / display name — used for the deterministic fallback + initial. */
  name?: string | null;
  size?: number;
  /** Force a specific preset (used by the picker preview). */
  preset?: AvatarPreset;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ avatarUrl, name, size = 44, preset, style }: AvatarProps) {
  const resolved = preset ?? resolveAvatar(avatarUrl, name);
  const iconSize = Math.round(size * 0.5);

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radii.pill,
          backgroundColor: resolved.bg,
        },
        style,
      ]}
      accessibilityRole="image"
    >
      <Feather name={resolved.icon} size={iconSize} color={resolved.fg} />
    </View>
  );
}

/** Small initial-only variant, kept for potential text-first contexts. */
export function AvatarInitial({ name, size = 44, style }: { name?: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  const resolved = resolveAvatar(null, name);
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radii.pill, backgroundColor: resolved.bg },
        style,
      ]}
    >
      <Text style={{ color: resolved.fg, fontSize: Math.round(size * 0.42), fontFamily: 'Inter_700Bold' }}>
        {initialFor(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
