/**
 * Navixa — match-pace (tempo) selector.
 *
 * Two segmented options: "Daily" (async, ~24h/move — the default) and "Blitz"
 * (realtime clock). Reused by the matchmaking search and private-match flows so
 * both entry points offer the same choice with identical i18n labels.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { Text } from '@/components/ui';
import type { MatchTempo } from './types';

interface TempoOption {
  value: MatchTempo;
  icon: keyof typeof Feather.glyphMap;
  labelKey: string;
  descKey: string;
}

const OPTIONS: TempoOption[] = [
  { value: 'daily', icon: 'sun', labelKey: 'online.tempo.daily', descKey: 'online.tempo.dailyDesc' },
  { value: 'blitz', icon: 'zap', labelKey: 'online.tempo.blitz', descKey: 'online.tempo.blitzDesc' },
];

interface TempoPickerProps {
  value: MatchTempo;
  onChange: (tempo: MatchTempo) => void;
}

export function TempoPicker({ value, onChange }: TempoPickerProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View style={styles.wrap} testID="tempo-picker">
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? colors.primary : colors.card,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
            testID={`tempo-option-${opt.value}`}
          >
            <Feather
              name={opt.icon}
              size={iconSize.md}
              color={selected ? colors.primaryForeground : colors.accent}
            />
            <View style={styles.body}>
              <Text
                variant="bodyMedium"
                style={{ color: selected ? colors.primaryForeground : colors.foreground }}
              >
                {t(opt.labelKey)}
              </Text>
              <Text
                variant="caption"
                style={{
                  color: selected ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                {t(opt.descKey)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: {
    gap: 2,
  },
});
