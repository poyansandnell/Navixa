import React from 'react';
import { Stack } from 'expo-router';

import { useColors } from '@/hooks/useColors';

/** Stack for legal / policy pages. Registered independently of the root layout. */
export default function LegalLayout() {
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
      <Stack.Screen name="[page]" />
    </Stack>
  );
}
