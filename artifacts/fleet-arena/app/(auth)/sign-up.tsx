import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, Spacer, Text } from '@/components/ui';
import {
  authService,
  isValidEmail,
  isValidPassword,
  SocialAuthButtons,
  SOCIAL_AUTH_ENABLED,
  TextField,
} from '@/features/auth';
import { spacing } from '@/constants/theme';

export default function SignUpScreen() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const canSubmit = isValidEmail(email) && isValidPassword(password);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await authService.signUpWithEmail({
        email: email.trim(),
        password,
      });
      if (result.session) {
        // Email confirmation disabled → we have a session, finish the profile.
        router.replace('/(auth)/complete-profile');
      } else {
        // Confirmation required → prompt the user to verify their email.
        setCheckEmail(true);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (checkEmail) {
    return (
      <Screen testID="sign-up-check-email">
        <Spacer size="xxl" />
        <Card elevated>
          <Text variant="h3">{t('auth.signUp.checkEmailTitle')}</Text>
          <Spacer size="sm" />
          <Text variant="body" color="muted">
            {t('auth.signUp.checkEmailBody', { email: email.trim() })}
          </Text>
        </Card>
        <Spacer size="xl" />
        <Button
          label={t('auth.signIn.action')}
          variant="secondary"
          fullWidth
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen testID="sign-up-screen">
        <Text variant="h2">{t('auth.signUp.heading')}</Text>
        <Spacer size="xs" />
        <Text variant="body" color="muted">
          {t('auth.signUp.subtitle')}
        </Text>
        <Spacer size="xxl" />

        <View style={styles.form}>
          <TextField
            label={t('auth.fields.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder={t('auth.fields.emailPlaceholder')}
          />
          <TextField
            label={t('auth.fields.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder={t('auth.fields.passwordPlaceholder')}
            error={error}
            hint={
              !error && password.length > 0 && !isValidPassword(password)
                ? t('auth.fields.passwordHint')
                : null
            }
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />
        </View>

        <Spacer size="xl" />
        <Button
          testID="sign-up-submit"
          label={t('auth.signUp.submit')}
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />

        {SOCIAL_AUTH_ENABLED ? (
          <>
            <Spacer size="xl" />
            <Text variant="caption" color="muted" center>
              {t('auth.orContinueWith')}
            </Text>
            <Spacer size="md" />
            <SocialAuthButtons />
          </>
        ) : null}

        <Spacer size="xxl" />
        <View style={styles.footerRow}>
          <Text variant="callout" color="muted">
            {t('auth.signUp.haveAccount')}
          </Text>
          <Link href="/(auth)/sign-in" replace>
            <Text variant="callout" color="accent">
              {t('auth.signIn.action')}
            </Text>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  form: {
    gap: spacing.lg,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
