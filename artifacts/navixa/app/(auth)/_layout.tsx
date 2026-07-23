import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';

export default function AuthLayout() {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerBackTitle: t('common.back'),
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="sign-in"
        options={{ title: t('auth.signIn.title') }}
      />
      <Stack.Screen
        name="sign-up"
        options={{ title: t('auth.signUp.title') }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{ title: t('auth.forgotPassword.title') }}
      />
      <Stack.Screen
        name="complete-profile"
        options={{ title: t('auth.completeProfile.title'), headerBackVisible: false }}
      />
    </Stack>
  );
}
