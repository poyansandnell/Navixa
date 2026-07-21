import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { radii, spacing, typography } from '@/constants/theme';
import { Button, Screen, Spacer, Text } from '@/components/ui';
import {
  joinPrivateMatch,
  parseInviteCode,
  OnlineError,
  useOnlineMatchStore,
} from '@/features/onlineMatch';

/**
 * Join-by-code screen. Reached via the deep link `fleetarena://join/<code>`
 * (Expo Router maps the path segment to `code`) or from the Play tab with no
 * code for manual entry.
 */
export default function JoinMatchScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const initMatch = useOnlineMatchStore((s) => s.init);

  const params = useLocalSearchParams<{ code?: string }>();
  const initialCode = React.useMemo(() => {
    const raw = params.code;
    if (!raw || raw === 'new') return '';
    return parseInviteCode(String(raw)) ?? String(raw).toUpperCase();
  }, [params.code]);

  const [code, setCode] = React.useState(initialCode);
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const autoJoined = React.useRef(false);

  const doJoin = React.useCallback(
    async (rawCode: string) => {
      const parsed = parseInviteCode(rawCode);
      if (!parsed) {
        setError(t('online.private.invalidCode'));
        return;
      }
      setJoining(true);
      setError(null);
      try {
        const res = await joinPrivateMatch(parsed);
        initMatch(res.matchId, false);
        router.replace('/online/setup');
      } catch (err) {
        const message = err instanceof OnlineError ? err.message : t('online.private.joinError');
        setError(message);
      } finally {
        setJoining(false);
      }
    },
    [initMatch, t],
  );

  // Auto-join when arriving via a deep link with a valid code.
  React.useEffect(() => {
    if (!autoJoined.current && initialCode && parseInviteCode(initialCode)) {
      autoJoined.current = true;
      void doJoin(initialCode);
    }
  }, [initialCode, doJoin]);

  return (
    <Screen testID="online-join-screen">
      <Text variant="subhead" color="muted">
        {t('online.private.joinBody')}
      </Text>
      <Spacer size="xl" />
      <TextInput
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder={t('online.private.codePlaceholder')}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!joining}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        testID="online-join-input"
      />
      {error ? (
        <>
          <Spacer size="sm" />
          <Text variant="subhead" color="destructive">
            {error}
          </Text>
        </>
      ) : null}
      <Spacer size="xl" />
      <Button
        label={t('online.private.join')}
        icon="log-in"
        size="lg"
        fullWidth
        loading={joining}
        disabled={!parseInviteCode(code)}
        onPress={() => doJoin(code)}
        testID="online-join-submit"
      />
      <Spacer size="md" />
      <View style={styles.hint}>
        <Text variant="caption" color="muted" center>
          {t('online.private.createBody')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    ...typography.h2,
    textAlign: 'center',
    letterSpacing: 4,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hint: {
    paddingHorizontal: spacing.lg,
  },
});
