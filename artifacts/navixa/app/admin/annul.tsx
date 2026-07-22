/** Admin — annul a match by id (voids + reverts rating). */
import React, { useState } from 'react';
import { showAlert } from '@/lib/alert';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, SectionHeader, Spacer, Text } from '@/components/ui';
import { AdminField, AdminGate, adminApi } from '@/features/admin';

export default function AdminAnnulScreen() {
  const { t } = useTranslation();

  const [matchId, setMatchId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (matchId.trim().length < 8) return;
    showAlert(t('admin.annul.title'), t('admin.annul.confirm'), [
      { text: t('admin.cancel'), style: 'cancel' },
      {
        text: t('admin.annul.submit'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await adminApi.annulMatch(matchId.trim(), reason || undefined);
            showAlert(t('admin.title'), t('admin.annul.annulled_toast'));
            setMatchId('');
            setReason('');
          } catch (e) {
            showAlert(t('admin.errorTitle'), (e as Error).message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <AdminGate>
      <Screen testID="admin-annul">
        <SectionHeader title={t('admin.annul.title')} />
        <Card>
          <Text variant="subhead" color="muted">
            {t('admin.annul.note')}
          </Text>
          <Spacer size="md" />
          <AdminField
            label={t('admin.annul.matchId')}
            value={matchId}
            onChangeText={setMatchId}
            placeholder={t('admin.annul.matchIdPlaceholder')}
          />
          <AdminField
            label={t('admin.annul.reason')}
            value={reason}
            onChangeText={setReason}
            autoCapitalize="sentences"
            multiline
          />
          <Button
            label={t('admin.annul.submit')}
            icon="x-octagon"
            variant="secondary"
            loading={busy}
            onPress={submit}
            fullWidth
          />
        </Card>
        <Spacer size="xl" />
      </Screen>
    </AdminGate>
  );
}
