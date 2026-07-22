/** Admin — user search, status inspection, suspend / unsuspend. */
import React, { useState } from 'react';
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
import {
  AdminField,
  AdminGate,
  adminApi,
  type AdminUser,
  type UserStatus,
} from '@/features/admin';
import { spacing } from '@/constants/theme';

export default function AdminUsersScreen() {
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUser[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [status, setStatus] = useState<UserStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // Suspend form
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [permanent, setPermanent] = useState(false);

  const runSearch = async () => {
    if (query.trim().length < 1) return;
    setSearching(true);
    try {
      setResults(await adminApi.searchUsers(query.trim()));
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const loadStatus = async (userId: string) => {
    setBusy(true);
    try {
      setStatus(await adminApi.getUserStatus(userId));
    } catch (e) {
      showAlert(t('admin.errorTitle'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doSuspend = () => {
    if (!status) return;
    showAlert(t('admin.users.suspendTitle'), t('admin.users.suspendConfirm'), [
      { text: t('admin.cancel'), style: 'cancel' },
      {
        text: t('admin.users.suspend'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await adminApi.suspendAccount({
              userId: status.profile.id,
              reason: reason || undefined,
              until: permanent ? undefined : until || undefined,
              permanent,
            });
            await loadStatus(status.profile.id);
            setReason('');
            setUntil('');
            setPermanent(false);
          } catch (e) {
            showAlert(t('admin.errorTitle'), (e as Error).message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const doUnsuspend = () => {
    if (!status) return;
    showAlert(t('admin.users.statusTitle'), t('admin.users.unsuspendConfirm'), [
      { text: t('admin.cancel'), style: 'cancel' },
      {
        text: t('admin.users.unsuspend'),
        onPress: async () => {
          setBusy(true);
          try {
            await adminApi.unsuspendAccount(status.profile.id);
            await loadStatus(status.profile.id);
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
      <Screen testID="admin-users">
        <SectionHeader title={t('admin.users.title')} />
        <Card>
          <AdminField
            label={t('admin.users.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('admin.users.searchPlaceholder')}
          />
          <Button
            label={t('admin.users.viewStatus')}
            icon="search"
            loading={searching}
            onPress={runSearch}
            fullWidth
          />
        </Card>

        {results !== null ? (
          <>
            <Spacer size="lg" />
            {results.length === 0 ? (
              <EmptyState icon="user-x" title={t('admin.users.noResults')} />
            ) : (
              <Card padded={false}>
                {results.map((u, i) => (
                  <View key={u.id}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.userRow}>
                      <View style={styles.userInfo}>
                        <Text variant="bodyMedium">{u.username}</Text>
                        <Text variant="caption" color="muted">
                          {t('admin.users.level', { level: u.level })}
                        </Text>
                        <View style={styles.badges}>
                          {u.is_admin ? <Badge label={t('admin.users.adminBadge')} tone="primary" /> : null}
                          {u.is_bot ? <Badge label={t('admin.users.botBadge')} tone="muted" /> : null}
                        </View>
                      </View>
                      <Button
                        label={t('admin.users.viewStatus')}
                        size="sm"
                        variant="ghost"
                        onPress={() => loadStatus(u.id)}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
        ) : null}

        {status ? (
          <>
            <Spacer size="xl" />
            <SectionHeader title={t('admin.users.statusTitle')} />
            <Card>
              <Text variant="title">{status.profile.username}</Text>
              <Spacer size="xs" />
              <Badge
                label={status.suspended ? t('admin.users.suspended') : t('admin.users.active')}
                tone={status.suspended ? 'destructive' : 'success'}
              />

              <Spacer size="lg" />
              <Text variant="caption" color="muted">
                {t('admin.users.ratings').toUpperCase()}
              </Text>
              {status.ratings.length === 0 ? (
                <Text variant="subhead" color="muted">
                  —
                </Text>
              ) : (
                status.ratings.map((r) => (
                  <Text key={r.mode} variant="subhead">
                    {r.mode}: {r.rating} ({r.wins}/{r.losses}/{r.draws})
                  </Text>
                ))
              )}

              <Spacer size="lg" />
              <Text variant="caption" color="muted">
                {t('admin.users.moderationHistory').toUpperCase()}
              </Text>
              {status.moderationActions.length === 0 ? (
                <Text variant="subhead" color="muted">
                  {t('admin.users.noHistory')}
                </Text>
              ) : (
                status.moderationActions.map((a) => (
                  <Text key={a.id} variant="subhead">
                    {a.action}
                    {a.reason ? ` — ${a.reason}` : ''}
                    {a.expires_at ? ` (→ ${a.expires_at.slice(0, 10)})` : ''}
                    {a.is_active ? ' •' : ''}
                  </Text>
                ))
              )}
            </Card>

            <Spacer size="lg" />
            <Card>
              <Text variant="title">{t('admin.users.suspendTitle')}</Text>
              <Spacer size="md" />
              <AdminField
                label={t('admin.users.reason')}
                value={reason}
                onChangeText={setReason}
                placeholder={t('admin.users.reasonPlaceholder')}
                autoCapitalize="sentences"
                multiline
              />
              <AdminField
                label={t('admin.users.until')}
                value={until}
                onChangeText={setUntil}
                placeholder={t('admin.users.untilPlaceholder')}
              />
              <Button
                label={
                  permanent ? `${t('admin.users.permanent')} ✓` : t('admin.users.permanent')
                }
                variant={permanent ? 'accent' : 'ghost'}
                size="sm"
                onPress={() => setPermanent((v) => !v)}
              />
              <Spacer size="md" />
              <Button
                label={t('admin.users.suspend')}
                variant="secondary"
                loading={busy}
                onPress={doSuspend}
                fullWidth
              />
              <Spacer size="sm" />
              <Button
                label={t('admin.users.unsuspend')}
                variant="ghost"
                loading={busy}
                onPress={doUnsuspend}
                fullWidth
              />
            </Card>
          </>
        ) : null}

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
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  userInfo: {
    gap: spacing.xs,
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
