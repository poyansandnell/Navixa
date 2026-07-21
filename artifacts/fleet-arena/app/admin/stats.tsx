/** Admin — platform statistics dashboard (anonymized aggregate counts). */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, SectionHeader, Spacer, StatTile, Text } from '@/components/ui';
import { AdminGate, adminApi, type PlatformStats } from '@/features/admin';
import { spacing } from '@/constants/theme';

export default function AdminStatsScreen() {
  const { t } = useTranslation();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await adminApi.fetchPlatformStats());
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminGate>
      <Screen testID="admin-stats">
        <SectionHeader
          title={t('admin.stats.title')}
          actionLabel={t('admin.done')}
          onActionPress={() => void load()}
        />
        {loading ? (
          <Text variant="subhead" color="muted">
            {t('admin.loading')}
          </Text>
        ) : stats ? (
          <>
            <Card>
              <View style={styles.row}>
                <StatTile label={t('admin.stats.totalUsers')} value={String(stats.totalUsers)} />
                <StatTile
                  label={t('admin.stats.totalMatches')}
                  value={String(stats.totalMatches)}
                />
              </View>
              <Spacer size="lg" />
              <View style={styles.row}>
                <StatTile
                  label={t('admin.stats.activeMatches')}
                  value={String(stats.activeMatches)}
                  tone="success"
                />
                <StatTile
                  label={t('admin.stats.openReports')}
                  value={String(stats.openReports)}
                  tone="warning"
                />
              </View>
              <Spacer size="lg" />
              <View style={styles.row}>
                <StatTile
                  label={t('admin.stats.totalTournaments')}
                  value={String(stats.totalTournaments)}
                />
                <StatTile
                  label={t('admin.stats.activeSuspensions')}
                  value={String(stats.activeSuspensions)}
                  tone="destructive"
                />
              </View>
            </Card>
            <Spacer size="md" />
            <Text variant="caption" color="muted">
              {t('admin.stats.note')}
            </Text>
          </>
        ) : null}
        <Spacer size="xl" />
      </Screen>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
