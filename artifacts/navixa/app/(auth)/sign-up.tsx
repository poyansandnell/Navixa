import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSignUp } from '@clerk/expo/legacy';

import { Button, Screen, Spacer, Text } from '@/components/ui';
import {
  isValidEmail,
  isValidPassword,
  SocialAuthButtons,
  SOCIAL_AUTH_ENABLED,
  TextField,
} from '@/features/auth';
import { spacing } from '@/constants/theme';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { signUp, setActive, isLoaded } = useSignUp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isValidEmail(email) && isValidPassword(password);
  const canVerify = code.trim().length >= 4;

  const clerkMessage = (err: unknown): string => {
    const clerkErr = err as { errors?: { message?: string }[] };
    return clerkErr.errors?.[0]?.message ?? (err as Error).message;
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting || !isLoaded) return;
    setSubmitting(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!canVerify || submitting || !isLoaded) return;
    setSubmitting(true);
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        // Root layout routes to profile bootstrap next (no profile yet).
      } else {
        setError(t('auth.errors.title'));
      }
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen testID="sign-up-verify">
          <Text variant="h2">{t('auth.verify.heading')}</Text>
          <Spacer size="xs" />
          <Text variant="body" color="muted">
            {t('auth.verify.subtitle', { email: email.trim() })}
          </Text>
          <Spacer size="xxl" />
          <TextField
            label={t('auth.verify.code')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoCapitalize="none"
            placeholder={t('auth.verify.codePlaceholder')}
            error={error}
            onSubmitEditing={handleVerify}
            returnKeyType="go"
          />
          <Spacer size="xl" />
          <Button
            testID="sign-up-verify-submit"
            label={t('auth.verify.submit')}
            fullWidth
            loading={submitting}
            disabled={!canVerify}
            onPress={handleVerify}
          />
        </Screen>
      </KeyboardAvoidingView>
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
