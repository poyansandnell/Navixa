/**
 * Navixa — Admin hub.
 *
 * Reachable via /admin only (no tab). Visible only if profiles.is_admin (gated
 * by AdminGate). Every action re-verifies admin status server-side via the
 * admin-actions Edge Function. Settings may link here later.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card, Screen, SectionHeader, Spacer, Text } from '@/components/ui';
import { AdminGate } from '@/features/admin';
import { useColors } from '@/hooks/useColors';
import { iconSize, spacing } from '@/constants/theme';

const LINKS: { route: string; key: string; icon: keyof typeof Feather.glyphMap }[] = [
  { route: '/admin/users', key: 'admin.nav.users', icon: 'users' },
  { route: '/admin/reports', key: 'admin.nav.reports', icon: 'flag' },
  { route: '/admin/tournaments', key: 'admin.nav.tournaments', icon: 'award' },
  { route: '/admin/quests', key: 'admin.nav.quests', icon: 'target' },
  { route: '/admin/cosmetics', key: 'admin.nav.cosmetics', icon: 'shopping-bag' },
  { route: '/admin/banned', key: 'admin.nav.banned', icon: 'slash' },
  { route: '/admin/annul', key: 'admin.nav.annul', icon: 'x-octagon' },
  { route: '/admin/stats', key: 'admin.nav.stats', icon: 'bar-chart-2' },
];

export default function AdminHubScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <AdminGate>
      <Screen testID="admin-hub">
        <SectionHeader title={t('admin.subtitle')} />
        <Card padded={false}>
          {LINKS.map((link, i) => (
            <View key={link.route}>
              {i > 0 ? (
                <View
                  style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                style={styles.row}
                onPress={() => router.push(link.route as never)}
              >
                <View style={styles.left}>
                  <Feather name={link.icon} size={iconSize.md} color={colors.foreground} />
                  <Text variant="body">{t(link.key)}</Text>
                </View>
                <Feather name="chevron-right" size={iconSize.sm} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ))}
        </Card>
        <Spacer size="xl" />
      </Screen>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
