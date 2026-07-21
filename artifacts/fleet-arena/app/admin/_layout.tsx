import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';

/** Stack for the admin/moderation area. Reachable via /admin (no tab). */
export default function AdminLayout() {
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
      <Stack.Screen name="index" options={{ title: t('admin.title') }} />
      <Stack.Screen name="users" options={{ title: t('admin.nav.users') }} />
      <Stack.Screen name="reports" options={{ title: t('admin.nav.reports') }} />
      <Stack.Screen name="tournaments" options={{ title: t('admin.nav.tournaments') }} />
      <Stack.Screen name="quests" options={{ title: t('admin.nav.quests') }} />
      <Stack.Screen name="cosmetics" options={{ title: t('admin.nav.cosmetics') }} />
      <Stack.Screen name="banned" options={{ title: t('admin.nav.banned') }} />
      <Stack.Screen name="annul" options={{ title: t('admin.nav.annul') }} />
      <Stack.Screen name="stats" options={{ title: t('admin.nav.stats') }} />
    </Stack>
  );
}
