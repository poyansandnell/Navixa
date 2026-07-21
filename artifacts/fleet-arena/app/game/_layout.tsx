import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';

/**
 * Stack for the local (offline) training match flow: fleet setup → play →
 * result. Registered independently of the root layout (owned by another agent).
 */
export default function GameLayout() {
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
      <Stack.Screen name="setup" options={{ title: t('game.setup.title') }} />
      <Stack.Screen
        name="play"
        options={{ title: t('game.play.title'), headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="result"
        options={{ title: t('game.result.title'), headerBackVisible: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
