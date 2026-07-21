/** Admin — create daily quest. */
import React, { useState } from 'react';
import { showAlert } from '@/lib/alert';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, SectionHeader, Spacer } from '@/components/ui';
import { AdminField, AdminGate, adminApi } from '@/features/admin';

export default function AdminQuestsScreen() {
  const { t } = useTranslation();

  const [code, setCode] = useState('');
  const [titleKey, setTitleKey] = useState('');
  const [descriptionKey, setDescriptionKey] = useState('');
  const [metric, setMetric] = useState('');
  const [goal, setGoal] = useState('1');
  const [rewardXp, setRewardXp] = useState('0');
  const [rewardCoins, setRewardCoins] = useState('0');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim() || !metric.trim()) return;
    setBusy(true);
    try {
      await adminApi.createDailyQuest({
        code: code.trim(),
        titleKey: titleKey.trim() || `quests.${code.trim()}.title`,
        descriptionKey: descriptionKey.trim() || `quests.${code.trim()}.description`,
        metric: metric.trim(),
        goal: Number(goal) || 1,
        rewardXp: Number(rewardXp) || 0,
        rewardCoins: Number(rewardCoins) || 0,
      });
      showAlert(t('admin.title'), t('admin.quests.created_toast'));
      setCode('');
      setTitleKey('');
      setDescriptionKey('');
      setMetric('');
      setGoal('1');
      setRewardXp('0');
      setRewardCoins('0');
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminGate>
      <Screen testID="admin-quests">
        <SectionHeader title={t('admin.quests.title')} />
        <Card>
          <AdminField
            label={t('admin.quests.code')}
            value={code}
            onChangeText={setCode}
            placeholder={t('admin.quests.codePlaceholder')}
          />
          <AdminField
            label={t('admin.quests.titleKey')}
            value={titleKey}
            onChangeText={setTitleKey}
          />
          <AdminField
            label={t('admin.quests.descriptionKey')}
            value={descriptionKey}
            onChangeText={setDescriptionKey}
          />
          <AdminField
            label={t('admin.quests.metric')}
            value={metric}
            onChangeText={setMetric}
            placeholder={t('admin.quests.metricPlaceholder')}
          />
          <AdminField
            label={t('admin.quests.goal')}
            value={goal}
            onChangeText={setGoal}
            keyboardType="number-pad"
          />
          <AdminField
            label={t('admin.quests.rewardXp')}
            value={rewardXp}
            onChangeText={setRewardXp}
            keyboardType="number-pad"
          />
          <AdminField
            label={t('admin.quests.rewardCoins')}
            value={rewardCoins}
            onChangeText={setRewardCoins}
            keyboardType="number-pad"
          />
          <Button
            label={t('admin.quests.create')}
            icon="plus"
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
