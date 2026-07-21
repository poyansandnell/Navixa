import React from 'react';
import { StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui';
import { spacing } from '@/constants/theme';
import {
  SOCIAL_AUTH_ENABLED,
  signInWithApple,
  signInWithGoogle,
} from '../oauth';

/**
 * Apple / Google sign-in buttons.
 *
 * Rendered only when SOCIAL_AUTH_ENABLED is true. It is currently FALSE because
 * native OAuth needs a development build + Supabase provider config (see
 * features/auth/oauth.ts). This keeps the UI ready without shipping a broken
 * flow.
 */
export function SocialAuthButtons() {
  const { t } = useTranslation();

  if (!SOCIAL_AUTH_ENABLED) {
    return null;
  }

  const handleApple = async () => {
    try {
      await signInWithApple();
    } catch (error) {
      showAlert(t('auth.errors.title'), (error as Error).message);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      showAlert(t('auth.errors.title'), (error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        label={t('auth.social.apple')}
        icon="smartphone"
        variant="ghost"
        fullWidth
        onPress={handleApple}
      />
      <Button
        label={t('auth.social.google')}
        icon="globe"
        variant="ghost"
        fullWidth
        onPress={handleGoogle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
});
