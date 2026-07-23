import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { LeaveMatchButton } from '@/features/onlineMatch';

/**
 * Stack for the online (server-authoritative) match flow:
 * search / private / join → setup → play → result. Registered independently of
 * the root layout (which is owned by another agent — do not edit it).
 */
export default function OnlineLayout() {
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
      <Stack.Screen name="search" options={{ title: t('online.search.title') }} />
      <Stack.Screen name="private" options={{ title: t('online.private.createTitle') }} />
      <Stack.Screen name="join/[code]" options={{ title: t('online.private.joinTitle') }} />
      <Stack.Screen
        name="setup"
        options={{
          title: t('online.setup.title'),
          headerBackVisible: false,
          headerLeft: () => <LeaveMatchButton />,
        }}
      />
      <Stack.Screen
        name="play"
        options={{
          title: t('online.play.title'),
          headerBackVisible: false,
          gestureEnabled: false,
          headerLeft: () => <LeaveMatchButton />,
        }}
      />
      <Stack.Screen
        name="result"
        options={{ title: t('online.result.title'), headerBackVisible: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
