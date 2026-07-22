/** Admin — report queue with resolve. */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  Spacer,
  Text,
} from '@/components/ui';
import { AdminField, AdminGate, adminApi, type AdminReport } from '@/features/admin';
import { useColors } from '@/hooks/useColors';
import { radii, spacing } from '@/constants/theme';

type Filter = 'all' | 'open' | 'reviewing' | 'actioned' | 'dismissed';
const FILTERS: Filter[] = ['all', 'open', 'reviewing', 'actioned', 'dismissed'];
const FILTER_KEY: Record<Filter, string> = {
  all: 'admin.reports.filterAll',
  open: 'admin.reports.filterOpen',
  reviewing: 'admin.reports.filterReviewing',
  actioned: 'admin.reports.filterActioned',
  dismissed: 'admin.reports.filterDismissed',
};

export default function AdminReportsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const [filter, setFilter] = useState<Filter>('open');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await adminApi.listReports(filter === 'all' ? undefined : filter));
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (
    report: AdminReport,
    status: 'reviewing' | 'actioned' | 'dismissed',
  ) => {
    setBusyId(report.id);
    try {
      await adminApi.resolveReport({
        reportId: report.id,
        status,
        resolution: resolution[report.id] || undefined,
      });
      await load();
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminGate>
      <Screen testID="admin-reports">
        <SectionHeader title={t('admin.reports.title')} />
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                accessibilityRole="button"
                onPress={() => setFilter(f)}
                style={[
                  styles.chip,
                  { borderColor: active ? colors.primary : colors.border },
                  active && { backgroundColor: colors.secondary },
                ]}
              >
                <Text variant="caption" color={active ? 'primary' : 'muted'}>
                  {t(FILTER_KEY[f])}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Spacer size="md" />

        {loading ? (
          <Text variant="subhead" color="muted">
            {t('admin.loading')}
          </Text>
        ) : reports.length === 0 ? (
          <EmptyState icon="inbox" title={t('admin.reports.empty')} />
        ) : (
          reports.map((r) => (
            <View key={r.id}>
              <Card>
                <View style={styles.headerRow}>
                  <Badge label={r.category} tone="warning" />
                  <Badge label={r.status} tone="muted" />
                </View>
                <Spacer size="sm" />
                <Text variant="caption" color="muted">
                  {t('admin.reports.reported')}: {r.reported_id.slice(0, 8)}
                </Text>
                <Text variant="caption" color="muted">
                  {t('admin.reports.reporter')}: {r.reporter_id.slice(0, 8)}
                </Text>
                {r.description ? (
                  <>
                    <Spacer size="sm" />
                    <Text variant="subhead">{r.description}</Text>
                  </>
                ) : null}
                <Spacer size="md" />
                <AdminField
                  label={t('admin.reports.resolution')}
                  value={resolution[r.id] ?? ''}
                  onChangeText={(v) => setResolution((prev) => ({ ...prev, [r.id]: v }))}
                  placeholder={t('admin.reports.resolutionPlaceholder')}
                  autoCapitalize="sentences"
                  multiline
                />
                <View style={styles.actionRow}>
                  <Button
                    label={t('admin.reports.markReviewing')}
                    size="sm"
                    variant="ghost"
                    loading={busyId === r.id}
                    onPress={() => resolve(r, 'reviewing')}
                  />
                  <Button
                    label={t('admin.reports.markActioned')}
                    size="sm"
                    variant="secondary"
                    loading={busyId === r.id}
                    onPress={() => resolve(r, 'actioned')}
                  />
                  <Button
                    label={t('admin.reports.markDismissed')}
                    size="sm"
                    variant="ghost"
                    loading={busyId === r.id}
                    onPress={() => resolve(r, 'dismissed')}
                  />
                </View>
              </Card>
              <Spacer size="md" />
            </View>
          ))
        )}

        <Spacer size="xl" />
      </Screen>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
