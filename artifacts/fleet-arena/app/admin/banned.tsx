/** Admin — manage banned username patterns. */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { AdminField, AdminGate, adminApi, type BannedUsername } from '@/features/admin';
import { spacing } from '@/constants/theme';

export default function AdminBannedScreen() {
  const { t } = useTranslation();

  const [items, setItems] = useState<BannedUsername[]>([]);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await adminApi.listBannedUsernames());
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (pattern.trim().length < 2) return;
    setBusy(true);
    try {
      await adminApi.addBannedUsername(pattern.trim(), reason || undefined);
      setPattern('');
      setReason('');
      await load();
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (item: BannedUsername) => {
    showAlert(t('admin.banned.title'), t('admin.banned.removeConfirm'), [
      { text: t('admin.cancel'), style: 'cancel' },
      {
        text: t('admin.banned.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await adminApi.removeBannedUsername(item.id);
            await load();
          } catch (e) {
            showAlert(t('admin.errorTitle'), (e as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <AdminGate>
      <Screen testID="admin-banned">
        <SectionHeader title={t('admin.banned.title')} />
        <Card>
          <AdminField
            label={t('admin.banned.pattern')}
            value={pattern}
            onChangeText={setPattern}
            placeholder={t('admin.banned.patternPlaceholder')}
          />
          <AdminField
            label={t('admin.banned.reason')}
            value={reason}
            onChangeText={setReason}
            autoCapitalize="sentences"
          />
          <Button
            label={t('admin.banned.add')}
            icon="plus"
            loading={busy}
            onPress={add}
            fullWidth
          />
        </Card>

        <Spacer size="lg" />

        {loading ? (
          <Text variant="subhead" color="muted">
            {t('admin.loading')}
          </Text>
        ) : items.length === 0 ? (
          <EmptyState icon="slash" title={t('admin.banned.empty')} />
        ) : (
          <Card padded={false}>
            {items.map((item, i) => (
              <View key={item.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.row}>
                  <View style={styles.info}>
                    <Text variant="bodyMedium">{item.pattern}</Text>
                    {item.reason ? (
                      <Text variant="caption" color="muted">
                        {item.reason}
                      </Text>
                    ) : null}
                    <Badge
                      label={
                        item.is_active
                          ? t('admin.banned.activeLabel')
                          : t('admin.banned.inactiveLabel')
                      }
                      tone={item.is_active ? 'success' : 'muted'}
                    />
                  </View>
                  {item.is_active ? (
                    <Button
                      label={t('admin.banned.remove')}
                      size="sm"
                      variant="ghost"
                      onPress={() => remove(item)}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        )}

        <Spacer size="xl" />
      </Screen>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  info: {
    gap: spacing.xs,
    flex: 1,
    alignItems: 'flex-start',
  },
});
