import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import {
  useSettingsStore,
  type ThemePreference,
} from '@/store/settings';
import { useAuth as useClerkAuth } from '@clerk/expo';
import { useAuth } from '@/features/auth';
import { disconnectSocket } from '@/lib/socket';
import {
  Badge,
  Button,
  Card,
  Screen,
  SectionHeader,
  Spacer,
  StatTile,
  Text,
} from '@/components/ui';
import {
  Avatar,
  AvatarPicker,
  countryFlag,
  divisionForRating,
  encodeAvatar,
  fetchPlayerStats,
  fetchProfile,
  formatMonthYear,
  formatPercent,
  updateAvatar,
  type PlayerStats,
  type ProfileRow,
} from '@/features/social';
import {
  fetchMatchHistory,
  matchDurationMs,
  myResult,
  type HistoryMatch,
} from '@/features/history';
import { HistoryRow } from '@/features/history/HistoryRow';

const THEME_OPTIONS: ThemePreference[] = ['dark', 'light', 'system'];

function SettingSwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.settingRow}>
      <Text variant="body">{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.muted, true: colors.primary }}
        thumbColor={colors.card}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const { signOut } = useClerkAuth();
  const selfId = user?.id ?? null;

  const settings = useSettingsStore();
  const [loggingOut, setLoggingOut] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [recent, setRecent] = useState<HistoryMatch[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!selfId) return;
    try {
      const [p, s, hist] = await Promise.all([
        fetchProfile(selfId),
        fetchPlayerStats(selfId),
        fetchMatchHistory(selfId),
      ]);
      setProfile(p);
      setStats(s);
      setRecent(hist.slice(0, 3));
    } catch {
      // Non-fatal: keep whatever we have.
    }
  }, [selfId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const themeLabel: Record<ThemePreference, string> = {
    dark: t('settings.themeDark'),
    light: t('settings.themeLight'),
    system: t('settings.themeSystem'),
  };

  const displayName =
    profile?.display_name ??
    profile?.username ??
    t('profile.guest');

  const rating = stats?.current_rating ?? 1200;
  const division = divisionForRating(rating);

  const handleSelectAvatar = async (presetId: string) => {
    if (!selfId) return;
    const encoded = encodeAvatar(presetId);
    setProfile((prev) => (prev ? { ...prev, avatar_url: encoded } : prev));
    setPickerOpen(false);
    try {
      await updateAvatar(selfId, encoded);
    } catch (error) {
      showAlert(t('profile.avatarTitle'), (error as Error).message);
    }
  };

  const handleLogout = () => {
    showAlert(
      t('profile.logoutConfirmTitle'),
      t('profile.logoutConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              disconnectSocket();
              await signOut();
              // Root layout redirects to the auth stack on session change.
            } catch (error) {
              showAlert(t('auth.errors.title'), (error as Error).message);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen testID="profile-screen">
      {/* Identity header */}
      <View style={styles.identity}>
        <Pressable
          onPress={() => setPickerOpen((o) => !o)}
          accessibilityRole="button"
        >
          <Avatar avatarUrl={profile?.avatar_url} name={profile?.username ?? displayName} size={72} />
          <View style={[styles.editBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <Feather name="edit-2" size={12} color={colors.primaryForeground} />
          </View>
        </Pressable>
        <View style={styles.identityBody}>
          <Text variant="h2">{displayName}</Text>
          {profile?.country_code ? (
            <Text variant="subhead" color="muted">
              {countryFlag(profile.country_code)} @{profile.username}
            </Text>
          ) : null}
          <Badge label={t(`social.divisions.${division.key}`)} tone="accent" />
        </View>
      </View>

      {pickerOpen ? (
        <>
          <Spacer size="md" />
          <SectionHeader title={t('profile.chooseAvatar')} />
          <Card>
            <AvatarPicker value={profile?.avatar_url} onSelect={handleSelectAvatar} />
          </Card>
        </>
      ) : null}

      {profile ? (
        <>
          <Spacer size="md" />
          <Text variant="caption" color="muted">
            {t('profile.memberSince', { date: formatMonthYear(profile.created_at, i18n.language) })}
            {'  ·  '}
            {t('profile.level', { level: profile.level })}
            {'  ·  '}
            {t('profile.xp', { xp: profile.xp })}
          </Text>
        </>
      ) : null}

      <Spacer size="xl" />

      {/* Stats */}
      <SectionHeader title={t('profile.stats.title')} />
      <Card>
        <View style={styles.statsRow}>
          <StatTile
            label={t('profile.stats.rating')}
            value={String(rating)}
            tone="accent"
          />
          <StatTile
            label={t('profile.stats.wins')}
            value={String(stats?.wins ?? 0)}
            tone="success"
          />
          <StatTile
            label={t('profile.stats.losses')}
            value={String(stats?.losses ?? 0)}
            tone="destructive"
          />
          <StatTile
            label={t('profile.stats.winRate')}
            value={stats ? formatPercent(stats.win_rate) : '—'}
            tone="primary"
          />
        </View>
        <Spacer size="lg" />
        <View style={styles.statsRow}>
          <StatTile
            label={t('profile.stats.matches')}
            value={String(stats?.matches_played ?? 0)}
          />
          <StatTile
            label={t('profile.stats.hitRate')}
            value={stats ? formatPercent(stats.accuracy) : '—'}
            tone="accent"
          />
          <StatTile
            label={t('profile.stats.shipsSunk')}
            value={String(stats?.ships_sunk ?? 0)}
          />
          <StatTile
            label={t('profile.stats.bestRating')}
            value={String(stats?.best_rating ?? rating)}
            tone="warning"
          />
        </View>
      </Card>

      <Spacer size="xl" />
      <View style={styles.sectionHeaderRow}>
        <SectionHeader title={t('profile.recentMatches')} />
        <Pressable onPress={() => router.push('/history')} accessibilityRole="button">
          <Text variant="callout" color="accent">
            {t('common.seeAll')}
          </Text>
        </Pressable>
      </View>
      {recent.length === 0 ? (
        <Card>
          <Text variant="subhead" color="muted" center>
            {t('history.empty')}
          </Text>
        </Card>
      ) : (
        <Card padded={false}>
          {recent.map((m, i) => (
            <HistoryRow
              key={m.id}
              match={m}
              result={myResult(m)}
              durationMs={matchDurationMs(m)}
              divider={i < recent.length - 1}
              onPress={() => router.push(`/history/${m.id}`)}
            />
          ))}
        </Card>
      )}

      <Spacer size="xl" />

      {/* Settings — appearance */}
      <SectionHeader title={t('settings.appearance')} />
      <Card>
        <Text variant="callout" color="muted" style={styles.groupLabel}>
          {t('settings.theme')}
        </Text>
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

      {/* Settings — gameplay */}
      <SectionHeader title={t('settings.gameplay')} />
      <Card>
        <SettingSwitchRow
          label={t('settings.sound')}
          value={settings.sound}
          onValueChange={settings.setSound}
        />
        <Divider />
        <SettingSwitchRow
          label={t('settings.haptics')}
          value={settings.haptics}
          onValueChange={settings.setHaptics}
        />
        <Divider />
        <SettingSwitchRow
          label={t('settings.animations')}
          value={settings.animations}
          onValueChange={settings.setAnimations}
        />
        <Divider />
        <SettingSwitchRow
          label={t('settings.reducedMotion')}
          value={settings.reducedMotion}
          onValueChange={settings.setReducedMotion}
        />
        <Divider />
        <SettingSwitchRow
          label={t('settings.colorblindMode')}
          value={settings.colorblindMode}
          onValueChange={settings.setColorblindMode}
        />
        <Divider />
        <SettingSwitchRow
          label={t('settings.confirmShot')}
          value={settings.confirmShot}
          onValueChange={settings.setConfirmShot}
        />
      </Card>

      <Spacer size="xl" />

      {/* Account */}
      <SectionHeader title={t('profile.account')} />
      <Button
        testID="profile-logout"
        label={t('profile.logout')}
        icon="log-out"
        variant="ghost"
        fullWidth
        loading={loggingOut}
        onPress={handleLogout}
      />
    </Screen>
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

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identityBody: {
    flex: 1,
    gap: spacing.sm,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupLabel: {
    marginBottom: spacing.sm,
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
});
