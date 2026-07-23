import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { SOCIAL_AUTH_ENABLED, useGoogleSignIn } from '../oauth';

/**
 * Google sign-in button (Clerk SSO).
 *
 * Rendered only when SOCIAL_AUTH_ENABLED is true. On success the root layout
 * routes the user onward once the Clerk session activates.
 */
export function SocialAuthButtons() {
  const { t } = useTranslation();
  const { signInWithGoogle } = useGoogleSignIn();
  const [busy, setBusy] = useState(false);

  if (!SOCIAL_AUTH_ENABLED) {
    return null;
  }

  const handleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      showAlert(t('auth.errors.title'), (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        label={t('auth.social.google')}
        icon="globe"
        variant="ghost"
        fullWidth
        loading={busy}
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
