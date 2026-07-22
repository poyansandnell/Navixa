/** Admin — create tournament (draft). */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useTranslation } from 'react-i18next';

import { Button, Card, Screen, SectionHeader, Spacer, Text } from '@/components/ui';
import { AdminField, AdminGate, adminApi } from '@/features/admin';
import { useColors } from '@/hooks/useColors';
import { radii, spacing } from '@/constants/theme';

const FORMATS = ['single_elimination', 'double_elimination', 'round_robin', 'swiss'];

export default function AdminTournamentsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('single_elimination');
  const [maxPlayers, setMaxPlayers] = useState('16');
  const [minPlayers, setMinPlayers] = useState('2');
  const [boardSize, setBoardSize] = useState('10');
  const [entryFee, setEntryFee] = useState('0');
  const [startsAt, setStartsAt] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 3) return;
    setBusy(true);
    try {
      await adminApi.createTournament({
        name: name.trim(),
        description: description || undefined,
        format,
        maxPlayers: Number(maxPlayers) || 16,
        minPlayers: Number(minPlayers) || 2,
        boardSize: Number(boardSize) || 10,
        entryFeeCoins: Number(entryFee) || 0,
        startsAt: startsAt || undefined,
      });
      showAlert(t('admin.title'), t('admin.tournaments.created_toast'));
      setName('');
      setDescription('');
      setStartsAt('');
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminGate>
      <Screen testID="admin-tournaments">
        <SectionHeader title={t('admin.tournaments.title')} />
        <Card>
          <AdminField
            label={t('admin.tournaments.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('admin.tournaments.namePlaceholder')}
            autoCapitalize="words"
          />
          <AdminField
            label={t('admin.tournaments.description')}
            value={description}
            onChangeText={setDescription}
            autoCapitalize="sentences"
            multiline
          />

          <Text variant="caption" color="muted">
            {t('admin.tournaments.format').toUpperCase()}
          </Text>
          <Spacer size="xs" />
          <View style={styles.chipRow}>
            {FORMATS.map((f) => {
              const active = format === f;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="button"
                  onPress={() => setFormat(f)}
                  style={[
                    styles.chip,
                    { borderColor: active ? colors.primary : colors.border },
                    active && { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text variant="caption" color={active ? 'primary' : 'muted'}>
                    {f}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Spacer size="md" />

          <AdminField
            label={t('admin.tournaments.maxPlayers')}
            value={maxPlayers}
            onChangeText={setMaxPlayers}
            keyboardType="number-pad"
          />
          <AdminField
            label={t('admin.tournaments.minPlayers')}
            value={minPlayers}
            onChangeText={setMinPlayers}
            keyboardType="number-pad"
          />
          <AdminField
            label={t('admin.tournaments.boardSize')}
            value={boardSize}
            onChangeText={setBoardSize}
            keyboardType="number-pad"
          />
          <AdminField
            label={t('admin.tournaments.entryFee')}
            value={entryFee}
            onChangeText={setEntryFee}
            keyboardType="number-pad"
          />
          <AdminField
            label={t('admin.tournaments.startsAt')}
            value={startsAt}
            onChangeText={setStartsAt}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
          />

          <Button
            label={t('admin.tournaments.create')}
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
