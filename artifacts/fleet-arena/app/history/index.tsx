import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { spacing } from '@/constants/theme';
import { Card, EmptyState, Screen, Spacer, Text } from '@/components/ui';
import { useAuth } from '@/features/auth';
import {
  HistoryRow,
  fetchMatchHistory,
  matchDurationMs,
  myResult,
  type HistoryMatch,
} from '@/features/history';

export default function MatchHistoryScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const selfId = user?.id ?? null;

  const [matches, setMatches] = useState<HistoryMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selfId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const hist = await fetchMatchHistory(selfId);
      setMatches(hist);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [selfId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen testID="history-screen">
      <Text variant="subhead" color="muted">
        {t('history.subtitle')}
      </Text>
      <Spacer size="lg" />

      {loading ? (
        <View style={styles.centerPad}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : matches.length === 0 ? (
        <Card>
          <EmptyState
            icon="clock"
            title={t('history.empty')}
            description={t('history.emptyDescription')}
          />
        </Card>
      ) : (
        <Card padded={false}>
          {matches.map((m, i) => (
            <HistoryRow
              key={m.id}
              match={m}
              result={myResult(m)}
              durationMs={matchDurationMs(m)}
              divider={i < matches.length - 1}
              onPress={() => router.push(`/history/${m.id}`)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerPad: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
});
