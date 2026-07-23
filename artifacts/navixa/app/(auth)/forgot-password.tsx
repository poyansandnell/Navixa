import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSignIn } from '@clerk/expo/legacy';

import { Button, Screen, Spacer, Text } from '@/components/ui';
import { isValidEmail, isValidPassword, TextField } from '@/features/auth';
import { spacing } from '@/constants/theme';

/**
 * Password reset via Clerk's `reset_password_email_code` strategy: request a
 * code by email, then submit the code + a new password to complete the reset
 * and sign in.
 */
export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clerkMessage = (err: unknown): string => {
    const clerkErr = err as { errors?: { message?: string }[] };
    return clerkErr.errors?.[0]?.message ?? (err as Error).message;
  };

  const handleSendCode = async () => {
    if (!isValidEmail(email) || submitting || !isLoaded) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setCodeSent(true);
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (code.trim().length < 4 || !isValidPassword(password) || submitting || !isLoaded) return;
    setSubmitting(true);
    setError(null);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
      } else {
        setError(t('auth.errors.title'));
      }
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen testID="forgot-password-screen">
        <Text variant="h2">{t('auth.forgotPassword.heading')}</Text>
        <Spacer size="xs" />
        <Text variant="body" color="muted">
          {t('auth.forgotPassword.subtitle')}
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
            editable={!codeSent}
          />
          {codeSent ? (
            <>
              <TextField
                label={t('auth.verify.code')}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoCapitalize="none"
                placeholder={t('auth.verify.codePlaceholder')}
              />
              <TextField
                label={t('auth.forgotPassword.newPassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder={t('auth.fields.passwordPlaceholder')}
                error={error}
                onSubmitEditing={handleReset}
                returnKeyType="go"
              />
            </>
          ) : null}
        </View>

        <Spacer size="xl" />
        {codeSent ? (
          <Button
            testID="forgot-password-reset"
            label={t('auth.forgotPassword.reset')}
            fullWidth
            loading={submitting}
            disabled={code.trim().length < 4 || !isValidPassword(password)}
            onPress={handleReset}
          />
        ) : (
          <Button
            testID="forgot-password-submit"
            label={t('auth.forgotPassword.submit')}
            fullWidth
            loading={submitting}
            disabled={!isValidEmail(email)}
            onPress={handleSendCode}
          />
        )}
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
});
