/**
 * Navixa — Settings screen.
 *
 * Centralises every preference: language (all 14 shipped locales), theme,
 * gameplay toggles (store/settings.ts), push notification categories + privacy
 * (persisted in user_settings), blocked users, legal links, data export /
 * account deletion (Edge Functions), logout and the app version/build.
 *
 * NOTE: linked from the Profile tab header (a gear icon). To avoid editing the
 * shared profile file concurrently, this screen is self-contained and reachable
 * at /settings; the gear link is added by whichever agent owns profile.tsx.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { useSettingsStore, type LanguagePreference, type ThemePreference } from '@/store/settings';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useAuth as useClerkAuth } from '@clerk/expo';
import { authService, useAuth } from '@/features/auth';
import { disconnectSocket } from '@/lib/socket';
import {
  Badge,
  Button,
  Card,
  Screen,
  SectionHeader,
  Spacer,
  Text,
} from '@/components/ui';
import {
  fetchBlockedUsers,
  fetchUserSettings,
  updateUserSetting,
  unblockUser,
  useLocalPrivacyStore,
  type BlockedUser,
  type UserSettingsColumn,
  type UserSettingsRow,
} from '@/features/notifications/userSettings';

const THEME_OPTIONS: ThemePreference[] = ['dark', 'light', 'system'];

/** Native language labels for the picker. */
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  sv: 'Svenska',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  it: 'Italiano',
  pl: 'Polski',
  nl: 'Nederlands',
  da: 'Dansk',
  no: 'Norsk',
  fi: 'Suomi',
  ja: '日本語',
  ko: '한국어',
};

const LEGAL_LINKS: { key: string; page: string }[] = [
  { key: 'legal.privacyTitle', page: 'privacy' },
  { key: 'legal.termsTitle', page: 'terms' },
  { key: 'legal.communityTitle', page: 'community' },
  { key: 'legal.fairPlayTitle', page: 'fair-play' },
  { key: 'legal.dataDeletionTitle', page: 'data-deletion' },
  { key: 'legal.licensesTitle', page: 'licenses' },
];

function SwitchRow({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.settingRow}>
      <Text variant="body" color={disabled ? 'muted' : 'foreground'}>
        {label}
      </Text>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.muted, true: colors.primary }}
        thumbColor={colors.card}
      />
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginVertical: spacing.xs,
      }}
    />
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const { signOut } = useClerkAuth();
  const settings = useSettingsStore();
  const { showCountry, setShowCountry } = useLocalPrivacyStore();

  const [serverSettings, setServerSettings] = useState<UserSettingsRow | null>(null);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [busy, setBusy] = useState<'export' | 'delete' | 'logout' | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [s, b] = await Promise.all([
      fetchUserSettings(user.id),
      fetchBlockedUsers(user.id),
    ]);
    setServerSettings(s);
    setBlocked(b);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const themeLabel: Record<ThemePreference, string> = {
    dark: t('settingsScreen.themeDark'),
    light: t('settingsScreen.themeLight'),
    system: t('settingsScreen.themeSystem'),
  };

  const updateServer = async (column: UserSettingsColumn, value: boolean) => {
    if (!user) return;
    // Optimistic update with revert on failure.
    setServerSettings((prev) => (prev ? { ...prev, [column]: value } : prev));
    const ok = await updateUserSetting(user.id, column, value);
    if (!ok) {
      setServerSettings((prev) => (prev ? { ...prev, [column]: !value } : prev));
      showAlert(t('common.appName'), t('settingsScreen.settingsSyncError'));
    }
  };

  const handleUnblock = async (b: BlockedUser) => {
    if (!user) return;
    const ok = await unblockUser(user.id, b.blocked_id);
    if (ok) setBlocked((prev) => prev.filter((x) => x.blocked_id !== b.blocked_id));
  };

  const handleExport = () => {
    showAlert(t('settingsScreen.exportData'), t('settingsScreen.exportDataConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          setBusy('export');
          try {
            await authService.exportUserData();
            showAlert(t('common.appName'), t('settingsScreen.exportDataDone'));
          } catch (e) {
            showAlert(t('common.appName'), (e as Error).message);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    showAlert(
      t('settingsScreen.deleteAccountConfirmTitle'),
      t('settingsScreen.deleteAccountConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settingsScreen.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await authService.deleteAccount();
            } catch (e) {
              showAlert(t('common.appName'), (e as Error).message);
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    showAlert(t('settingsScreen.logoutConfirmTitle'), t('settingsScreen.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settingsScreen.logout'),
        style: 'destructive',
        onPress: async () => {
          setBusy('logout');
          try {
            disconnectSocket();
            await signOut();
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  const androidBuild = Constants.expoConfig?.android?.versionCode;
  const build = iosBuild ?? (androidBuild != null ? String(androidBuild) : '—');

  return (
    <Screen testID="settings-screen">
      {/* Language */}
      <SectionHeader title={t('settingsScreen.language')} />
      <Card>
        <View style={styles.langGrid}>
          {SUPPORTED_LANGUAGES.map((lng) => {
            const active = settings.language === lng;
            return (
              <Pressable
                key={lng}
                accessibilityRole="button"
                onPress={() => settings.setLanguage(lng as LanguagePreference)}
                style={[
                  styles.langChip,
                  { borderColor: active ? colors.primary : colors.border },
                  active && { backgroundColor: colors.secondary },
                ]}
              >
                <Text variant="callout" color={active ? 'primary' : 'foreground'}>
                  {LANGUAGE_LABELS[lng] ?? lng}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={() => settings.setLanguage('system')}
            style={[
              styles.langChip,
              { borderColor: settings.language === 'system' ? colors.primary : colors.border },
              settings.language === 'system' && { backgroundColor: colors.secondary },
            ]}
          >
            <Text
              variant="callout"
              color={settings.language === 'system' ? 'primary' : 'foreground'}
            >
              {t('settingsScreen.themeSystem')}
            </Text>
          </Pressable>
        </View>
      </Card>

      <Spacer size="xl" />

      {/* Theme */}
      <SectionHeader title={t('settingsScreen.appearance')} />
      <Card>
        <View style={[styles.segment, { backgroundColor: colors.secondary }]}>
          {THEME_OPTIONS.map((option) => {
            const active = settings.theme === option;
            return (
              <Pressable
                key={option}
                onPress={() => settings.setTheme(option)}
                accessibilityRole="button"
                style={[styles.segmentItem, active && { backgroundColor: colors.card }]}
              >
                <Text variant="callout" color={active ? 'foreground' : 'muted'}>
                  {themeLabel[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Spacer size="xl" />

      {/* Gameplay */}
      <SectionHeader title={t('settingsScreen.gameplay')} />
      <Card>
        <SwitchRow label={t('settingsScreen.sound')} value={settings.sound} onValueChange={settings.setSound} />
        <Divider />
        <SwitchRow label={t('settingsScreen.haptics')} value={settings.haptics} onValueChange={settings.setHaptics} />
        <Divider />
        <SwitchRow label={t('settingsScreen.animations')} value={settings.animations} onValueChange={settings.setAnimations} />
        <Divider />
        <SwitchRow label={t('settingsScreen.reducedMotion')} value={settings.reducedMotion} onValueChange={settings.setReducedMotion} />
        <Divider />
        <SwitchRow label={t('settingsScreen.colorblindMode')} value={settings.colorblindMode} onValueChange={settings.setColorblindMode} />
        <Divider />
        <SwitchRow label={t('settingsScreen.confirmShot')} value={settings.confirmShot} onValueChange={settings.setConfirmShot} />
      </Card>

      <Spacer size="xl" />

      {/* Push notifications */}
      <SectionHeader title={t('settingsScreen.notifications')} />
      <Card>
        <SwitchRow
          label={t('settingsScreen.pushMatches')}
          value={serverSettings?.push_matches ?? true}
          onValueChange={(v) => updateServer('push_matches', v)}
        />
        <Divider />
        <SwitchRow
          label={t('settingsScreen.pushTurns')}
          value={serverSettings?.push_turns ?? true}
          onValueChange={(v) => updateServer('push_turns', v)}
        />
        <Divider />
        <SwitchRow
          label={t('settingsScreen.pushSocial')}
          value={serverSettings?.push_social ?? true}
          onValueChange={(v) => updateServer('push_social', v)}
        />
        <Divider />
        <SwitchRow
          label={t('settingsScreen.pushMarketing')}
          value={serverSettings?.push_marketing ?? false}
          onValueChange={(v) => updateServer('push_marketing', v)}
        />
      </Card>

      <Spacer size="xl" />

      {/* Privacy */}
      <SectionHeader title={t('settingsScreen.privacy')} />
      <Card>
        <SwitchRow
          label={t('settingsScreen.showOnlineStatus')}
          value={serverSettings?.show_online_status ?? true}
          onValueChange={(v) => updateServer('show_online_status', v)}
        />
        <Divider />
        <SwitchRow
          label={t('settingsScreen.showCountry')}
          value={showCountry}
          onValueChange={setShowCountry}
        />
      </Card>

      <Spacer size="xl" />

      {/* Blocked users */}
      <SectionHeader title={t('settingsScreen.blockedUsers')} />
      <Card>
        {blocked.length === 0 ? (
          <Text variant="subhead" color="muted">
            {t('settingsScreen.noBlockedUsers')}
          </Text>
        ) : (
          blocked.map((b, i) => (
            <View key={b.blocked_id}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.settingRow}>
                <Text variant="body">
                  {b.display_name ?? b.username ?? b.blocked_id.slice(0, 8)}
                </Text>
                <Button
                  label={t('settingsScreen.unblock')}
                  size="sm"
                  variant="ghost"
                  onPress={() => handleUnblock(b)}
                />
              </View>
            </View>
          ))
        )}
      </Card>

      <Spacer size="xl" />

      {/* Support portal (FAQ + contact form) */}
      <SectionHeader title={t('support.contactHeading')} />
      <Card>
        <Pressable
          accessibilityRole="button"
          style={styles.linkRow}
          onPress={() => router.push('/support')}
        >
          <Text variant="body">{t('support.title')}</Text>
          <Feather name="chevron-right" size={iconSize.sm} color={colors.mutedForeground} />
        </Pressable>
      </Card>

      <Spacer size="xl" />

      {/* Legal */}
      <SectionHeader title={t('settingsScreen.legal')} />
      <Card>
        {LEGAL_LINKS.map((link, i) => (
          <View key={link.page}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              style={styles.linkRow}
              onPress={() => router.push(`/legal/${link.page}`)}
            >
              <Text variant="body">{t(link.key)}</Text>
              <Feather name="chevron-right" size={iconSize.sm} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ))}
      </Card>

      <Spacer size="xl" />

      {/* Account */}
      <SectionHeader title={t('settingsScreen.account')} />
      <Button
        label={t('settingsScreen.exportData')}
        icon="download"
        variant="ghost"
        fullWidth
        loading={busy === 'export'}
        onPress={handleExport}
      />
      <Spacer size="sm" />
      <Button
        testID="settings-logout"
        label={t('settingsScreen.logout')}
        icon="log-out"
        variant="ghost"
        fullWidth
        loading={busy === 'logout'}
        onPress={handleLogout}
      />
      <Spacer size="sm" />
      <Button
        testID="settings-delete"
        label={t('settingsScreen.deleteAccount')}
        icon="trash-2"
        variant="ghost"
        fullWidth
        loading={busy === 'delete'}
        onPress={handleDelete}
      />

      <Spacer size="xl" />

      {/* About */}
      <View style={styles.about}>
        <Badge label={t('common.appName')} tone="muted" />
        <Text variant="caption" color="muted">
          {t('settingsScreen.version')} {version} · {t('settingsScreen.build')} {build}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  langChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  about: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
