/** Admin — create / update cosmetic item. */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, SectionHeader, Spacer, Text } from '@/components/ui';
import { AdminField, AdminGate, adminApi } from '@/features/admin';
import { useColors } from '@/hooks/useColors';
import { radii, spacing } from '@/constants/theme';

const TYPES = [
  'board_theme',
  'ship_skin',
  'avatar_frame',
  'emote',
  'victory_effect',
  'title',
  'flag',
];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];

export default function AdminCosmeticsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const [code, setCode] = useState('');
  const [type, setType] = useState('board_theme');
  const [rarity, setRarity] = useState('common');
  const [nameKey, setNameKey] = useState('');
  const [descriptionKey, setDescriptionKey] = useState('');
  const [priceCoins, setPriceCoins] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim() || !nameKey.trim()) return;
    setBusy(true);
    try {
      await adminApi.upsertCosmeticItem({
        code: code.trim(),
        type,
        rarity,
        nameKey: nameKey.trim(),
        descriptionKey: descriptionKey.trim() || undefined,
        priceCoins: priceCoins.trim() === '' ? null : Number(priceCoins),
        sortOrder: Number(sortOrder) || 0,
      });
      showAlert(t('admin.title'), t('admin.cosmetics.saved_toast'));
      setCode('');
      setNameKey('');
      setDescriptionKey('');
      setPriceCoins('');
      setSortOrder('0');
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ChipGroup = ({
    values,
    selected,
    onSelect,
  }: {
    values: string[];
    selected: string;
    onSelect: (v: string) => void;
  }) => (
    <View style={styles.chipRow}>
      {values.map((v) => {
        const active = selected === v;
        return (
          <Pressable
            key={v}
            accessibilityRole="button"
            onPress={() => onSelect(v)}
            style={[
              styles.chip,
              { borderColor: active ? colors.primary : colors.border },
              active && { backgroundColor: colors.secondary },
            ]}
          >
            <Text variant="caption" color={active ? 'primary' : 'muted'}>
              {v}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <AdminGate>
      <Screen testID="admin-cosmetics">
        <SectionHeader title={t('admin.cosmetics.title')} />
        <Card>
          <AdminField label={t('admin.cosmetics.code')} value={code} onChangeText={setCode} />

          <Text variant="caption" color="muted">
            {t('admin.cosmetics.type').toUpperCase()}
          </Text>
          <Spacer size="xs" />
          <ChipGroup values={TYPES} selected={type} onSelect={setType} />
          <Spacer size="md" />

          <Text variant="caption" color="muted">
            {t('admin.cosmetics.rarity').toUpperCase()}
          </Text>
          <Spacer size="xs" />
          <ChipGroup values={RARITIES} selected={rarity} onSelect={setRarity} />
          <Spacer size="md" />

          <AdminField
            label={t('admin.cosmetics.nameKey')}
            value={nameKey}
            onChangeText={setNameKey}
          />
          <AdminField
            label={t('admin.cosmetics.descriptionKey')}
            value={descriptionKey}
            onChangeText={setDescriptionKey}
          />
          <AdminField
            label={t('admin.cosmetics.priceCoins')}
            value={priceCoins}
            onChangeText={setPriceCoins}
            keyboardType="number-pad"
          />
          <AdminField
            label={t('admin.cosmetics.sortOrder')}
            value={sortOrder}
            onChangeText={setSortOrder}
            keyboardType="number-pad"
          />
          <Button
            label={t('admin.cosmetics.save')}
            icon="save"
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

const styles = StyleSheet.create({
  chipRow: {
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
});
