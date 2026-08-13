/**
 * TermsNotice — "By continuing you agree to our Terms of Use and Privacy
 * Policy" with working links, shown on both the sign-in and sign-up screens
 * (App Store Guideline 1.2 requires terms to be visible before registration
 * or login).
 */
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { spacing } from '@/constants/theme';

const LEGAL_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'sanka-skepp.replit.app'}/legal`;
export const TERMS_URL = `${LEGAL_BASE}/terms`;
export const PRIVACY_URL = `${LEGAL_BASE}/privacy`;

export function TermsNotice() {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap} testID="terms-notice">
      <Text variant="caption" color="muted" center>
        {t('auth.legal.prefix')}{' '}
        <Text
          variant="caption"
          color="accent"
          onPress={() => Linking.openURL(TERMS_URL)}
          accessibilityRole="link"
        >
          {t('auth.legal.terms')}
        </Text>{' '}
        {t('auth.legal.and')}{' '}
        <Text
          variant="caption"
          color="accent"
          onPress={() => Linking.openURL(PRIVACY_URL)}
          accessibilityRole="link"
        >
          {t('auth.legal.privacy')}
        </Text>
        {t('auth.legal.suffix')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
