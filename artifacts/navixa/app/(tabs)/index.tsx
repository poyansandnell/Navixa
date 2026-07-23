import React from 'react';
import { StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import {
  Badge,
  Button,
  Card,
  Screen,
  SectionHeader,
  Spacer,
  Text,
} from '@/components/ui';
import { useIsGuest } from '@/hooks/useIsGuest';
import type { OnlineMode } from '@/features/matchmaking';
import { ActiveMatches } from '@/features/onlineMatch';

interface ModeDef {
  key: OnlineMode;
  icon: keyof typeof Feather.glyphMap;
  titleKey: string;
  descriptionKey: string;
  /** Requires a registered account (guests are prompted to upgrade). */
  requiresAccount?: boolean;
}

const MODES: ModeDef[] = [
  {
    key: 'quick',
    icon: 'zap',
    titleKey: 'online.picker.quick',
    descriptionKey: 'online.picker.quickDesc',
  },
  {
    key: 'ranked',
    icon: 'trending-up',
    titleKey: 'online.picker.ranked',
    descriptionKey: 'online.picker.rankedDesc',
    requiresAccount: true,
  },
  {
    key: 'blitz',
    icon: 'wind',
    titleKey: 'online.picker.blitz',
    descriptionKey: 'online.picker.blitzDesc',
  },
  {
    key: 'classic',
    icon: 'anchor',
    titleKey: 'online.picker.classic',
    descriptionKey: 'online.picker.classicDesc',
  },
  {
    key: 'private',
    icon: 'users',
    titleKey: 'online.picker.private',
    descriptionKey: 'online.picker.privateDesc',
  },
  {
    key: 'bot',
    icon: 'cpu',
    titleKey: 'online.picker.bot',
    descriptionKey: 'online.picker.botDesc',
  },
];

export default function PlayScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const isGuest = useIsGuest();

  const startTraining = () => router.push('/game/setup');

  const promptUpgrade = () => {
    showAlert(t('online.picker.guestTitle'), t('online.picker.guestBody'), [
      { text: t('online.picker.cancel'), style: 'cancel' },
      {
        text: t('online.picker.upgrade'),
        onPress: () => router.push('/(auth)/sign-up'),
      },
    ]);
  };

  const handleModePress = (mode: ModeDef) => {
    if (mode.requiresAccount && isGuest) {
      promptUpgrade();
      return;
    }
    switch (mode.key) {
      case 'bot':
        startTraining();
        break;
      case 'private':
        router.push('/online/private');
        break;
      default:
        router.push({ pathname: '/online/search', params: { mode: mode.key } });
        break;
    }
  };

  return (
    <Screen testID="play-screen">
      {/* Rating / division header card */}
      <Card elevated style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text variant="subhead" color="muted">
              {t('play.greeting')}
            </Text>
            <Text variant="h2">{t('common.appName')}</Text>
          </View>
          <Badge label={t('play.division')} tone="accent" />
        </View>
        <View style={styles.ratingRow}>
          <Feather name="award" size={iconSize.lg} color={colors.accent} />
          <View>
            <Text variant="caption" color="muted">
              {t('play.rating').toUpperCase()}
            </Text>
            <Text variant="h1" color="accent">
              1450
            </Text>
          </View>
        </View>
      </Card>

      <Spacer size="lg" />

      {/* Big primary Play now button — jumps into a quick match */}
      <Button
        label={t('play.playNow')}
        icon="play"
        size="lg"
        fullWidth
        onPress={() => router.push({ pathname: '/online/search', params: { mode: 'quick' } })}
        testID="play-now-button"
      />
      <View style={styles.subtitleWrap}>
        <Text variant="subhead" color="muted" center>
          {t('online.picker.quickDesc')}
        </Text>
      </View>

      <Spacer size="xl" />

      {/* Join by code */}
      <Button
        label={t('online.private.joinTitle')}
        icon="log-in"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/online/join/new')}
        testID="play-join-code-button"
      />

      <Spacer size="xl" />

      {/* Active matches ("Dina matcher") */}
      <SectionHeader title={t('online.active.title')} />
      <ActiveMatches />

      <Spacer size="xl" />

      {/* Game modes */}
      <SectionHeader title={t('online.picker.title')} />
      <View style={styles.modeList}>
        {MODES.map((mode) => {
          const locked = mode.requiresAccount && isGuest;
          return (
            <Card key={mode.key} onPress={() => handleModePress(mode)}>
              <View style={styles.row}>
                <View style={[styles.iconTile, { backgroundColor: colors.secondary }]}>
                  <Feather name={mode.icon} size={iconSize.md} color={colors.accent} />
                </View>
                <View style={styles.rowBody}>
                  <Text variant="bodyMedium">{t(mode.titleKey)}</Text>
                  <Text variant="caption" color="muted">
                    {t(mode.descriptionKey)}
                  </Text>
                </View>
                {locked ? (
                  <Feather name="lock" size={iconSize.md} color={colors.mutedForeground} />
                ) : (
                  <Feather
                    name="chevron-right"
                    size={iconSize.md}
                    color={colors.mutedForeground}
                  />
                )}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    gap: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subtitleWrap: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  modeList: {
    gap: spacing.md,
  },
});
