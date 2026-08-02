import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@/lib/alert';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { radii, spacing } from '@/constants/theme';
import { SOCIAL_AUTH_ENABLED, useSocialSignIn, type SocialProvider } from '../oauth';

/**
 * Social sign-in buttons (Clerk SSO): Apple first (per Apple's HIG the
 * Sign in with Apple button must be at least as prominent as other social
 * options), then Google. On success the root layout routes the user onward
 * once the Clerk session activates.
 */
export function SocialAuthButtons() {
  const { t } = useTranslation();
  const { signInWithProvider } = useSocialSignIn();
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  if (!SOCIAL_AUTH_ENABLED) {
    return null;
  }

  const handlePress = async (provider: SocialProvider) => {
    if (busy) return;
    setBusy(provider);
    try {
      await signInWithProvider(provider);
    } catch (error) {
      showAlert(t('auth.errors.title'), (error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Apple-styled button per Apple's design guidelines: black background,
          white text, Apple logo. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.social.apple')}
        onPress={() => handlePress('apple')}
        disabled={busy !== null}
        style={({ pressed }) => [styles.appleButton, pressed && styles.pressed]}
        testID="apple-sign-in"
      >
        {busy === 'apple' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
            <Text variant="bodyMedium" style={styles.appleLabel}>
              {t('auth.social.apple')}
            </Text>
          </>
        )}
      </Pressable>
      <Button
        label={t('auth.social.google')}
        icon="globe"
        variant="ghost"
        fullWidth
        loading={busy === 'google'}
        onPress={() => handlePress('google')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#000000',
    borderRadius: radii.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  appleLabel: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.8,
  },
});
