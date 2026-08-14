import React from 'react';
import { Pressable } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, spacing } from '@/constants/theme';

/** Stack for the Settings screen. Registered independently of the root layout. */
export default function SettingsLayout() {
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
      <Stack.Screen
        name="index"
        options={{
          title: t('settingsScreen.title'),
          // This stack has no history of its own (Settings is its first
          // screen), so expo-router never renders a native back arrow.
          // Provide one explicitly that pops back to wherever we came from.
          headerLeft: () => (
            <Pressable
              testID="settings-back"
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              hitSlop={12}
              style={{ paddingRight: spacing.sm }}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/profile');
                }
              }}
            >
              <Feather name="chevron-left" size={iconSize.lg} color={colors.foreground} />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
