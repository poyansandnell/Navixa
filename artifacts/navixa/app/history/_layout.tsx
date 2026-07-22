import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';

/**
 * Stack for the match history + replay flow: list → detail/replay. Registered
 * independently of the root layout (owned by another agent), mirroring the
 * game stack.
 */
export default function HistoryLayout() {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', color: colors.foreground },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('history.title') }} />
      <Stack.Screen name="[matchId]" options={{ title: t('history.replay.title') }} />
    </Stack>
  );
}
