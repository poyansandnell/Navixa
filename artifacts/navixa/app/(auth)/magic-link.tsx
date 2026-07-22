import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, Spacer, Text } from '@/components/ui';
import { authService, isValidEmail, TextField } from '@/features/auth';

export default function MagicLinkScreen() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = isValidEmail(email);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await authService.sendMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Screen testID="magic-link-sent">
        <Spacer size="xxl" />
        <Card elevated>
          <Text variant="h3">{t('auth.magicLink.sentTitle')}</Text>
          <Spacer size="sm" />
          <Text variant="body" color="muted">
            {t('auth.magicLink.sentBody', { email: email.trim() })}
          </Text>
        </Card>
        <Spacer size="xl" />
        <Button
          label={t('common.done')}
          variant="secondary"
          fullWidth
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen testID="magic-link-screen">
        <Text variant="h2">{t('auth.magicLink.heading')}</Text>
        <Spacer size="xs" />
        <Text variant="body" color="muted">
          {t('auth.magicLink.subtitle')}
        </Text>
        <Spacer size="xxl" />

        <TextField
          label={t('auth.fields.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder={t('auth.fields.emailPlaceholder')}
          error={error}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />

        <Spacer size="xl" />
        <Button
          testID="magic-link-submit"
          label={t('auth.magicLink.submit')}
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
