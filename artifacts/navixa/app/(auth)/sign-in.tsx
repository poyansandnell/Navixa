import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSignIn } from '@clerk/expo/legacy';

import { Button, Screen, Spacer, Text } from '@/components/ui';
import {
  isValidEmail,
  SocialAuthButtons,
  SOCIAL_AUTH_ENABLED,
  TermsNotice,
  TextField,
} from '@/features/auth';
import { spacing } from '@/constants/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isValidEmail(email) && password.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting || !isLoaded) return;
    setSubmitting(true);
    setError(null);
    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        // Root layout redirects onward (profile bootstrap or tabs).
      } else {
        setError(t('auth.errors.title'));
      }
    } catch (err) {
      const clerkErr = err as { errors?: { message?: string }[] };
      setError(clerkErr.errors?.[0]?.message ?? (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen testID="sign-in-screen">
        <Text variant="h2">{t('auth.signIn.heading')}</Text>
        <Spacer size="xs" />
        <Text variant="body" color="muted">
          {t('auth.signIn.subtitle')}
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
            autoComplete="current-password"
            textContentType="password"
            placeholder={t('auth.fields.passwordPlaceholder')}
            error={error}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />
        </View>

        <Spacer size="xl" />
        <Button
          testID="sign-in-submit"
          label={t('auth.signIn.submit')}
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />

        <Spacer size="lg" />
        <View style={styles.linkRow}>
          <Link href="/(auth)/forgot-password">
            <Text variant="callout" color="accent">
              {t('auth.forgotPassword.action')}
            </Text>
          </Link>
        </View>

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
            {t('auth.signIn.noAccount')}
          </Text>
          <Link href="/(auth)/sign-up" replace>
            <Text variant="callout" color="accent">
              {t('auth.signUp.action')}
            </Text>
          </Link>
        </View>
        <TermsNotice />
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
  linkRow: {
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
