import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Spacer, Text } from '@/components/ui';
import {
  authService,
  Checkbox,
  isValidUsername,
  TextField,
  useAuth,
} from '@/features/auth';
import { spacing } from '@/constants/theme';
import { useSettingsStore } from '@/store/settings';
import { getDeviceLanguage } from '@/i18n';

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function CompleteProfileScreen() {
  const { t } = useTranslation();
  const { refreshProfile, user } = useAuth();
  const languagePref = useSettingsStore((s) => s.language);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [availability, setAvailability] = useState<Availability>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Debounced username availability check against the profiles table.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = username.trim();

    if (trimmed.length === 0) {
      setAvailability('idle');
      return;
    }
    if (!isValidUsername(trimmed)) {
      setAvailability('invalid');
      return;
    }

    setAvailability('checking');
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await authService.isUsernameAvailable(trimmed);
        if (requestId !== requestIdRef.current) return;
        setAvailability(available ? 'available' : 'taken');
      } catch {
        if (requestId !== requestIdRef.current) return;
        setAvailability('idle');
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  const canSubmit =
    availability === 'available' && ageConfirmed && !submitting;

  const usernameHint = (() => {
    switch (availability) {
      case 'checking':
        return { text: t('auth.completeProfile.checking'), tone: 'muted' as const };
      case 'available':
        return { text: t('auth.completeProfile.available'), tone: 'success' as const };
      case 'taken':
        return { text: t('auth.completeProfile.taken'), tone: 'destructive' as const };
      case 'invalid':
        return { text: t('auth.completeProfile.invalid'), tone: 'destructive' as const };
      default:
        return null;
    }
  })();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const locale =
        languagePref === 'system' ? getDeviceLanguage() : languagePref;
      // Get the current time from the runtime is fine here (client display /
      // metadata only; the server enforces trust for game state).
      const termsAcceptedAt = new Date().toISOString();
      await authService.completeProfileBootstrap({
        username: username.trim(),
        displayName: displayName.trim() || undefined,
        ageConfirmed,
        termsAcceptedAt,
        locale,
        email: user?.email ?? undefined,
      });
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen testID="complete-profile-screen">
        <Text variant="h2">{t('auth.completeProfile.heading')}</Text>
        <Spacer size="xs" />
        <Text variant="body" color="muted">
          {t('auth.completeProfile.subtitle')}
        </Text>
        <Spacer size="xxl" />

        <View style={styles.form}>
          <TextField
            label={t('auth.completeProfile.username')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            placeholder={t('auth.completeProfile.usernamePlaceholder')}
            hint={usernameHint?.text ?? null}
            hintTone={usernameHint?.tone ?? 'muted'}
          />
          <TextField
            label={t('auth.completeProfile.displayName')}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={40}
            placeholder={t('auth.completeProfile.displayNamePlaceholder')}
            error={error}
          />
        </View>

        <Spacer size="xl" />
        <Checkbox
          testID="complete-profile-age"
          checked={ageConfirmed}
          onToggle={() => setAgeConfirmed((v) => !v)}
          label={t('auth.completeProfile.ageConfirm')}
        />

        <Spacer size="xxl" />
        <Button
          testID="complete-profile-submit"
          label={t('auth.completeProfile.submit')}
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
  form: {
    gap: spacing.lg,
  },
});
