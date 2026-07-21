import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { spacing } from '@/constants/theme';
import { Badge, Button, Card, Screen, SectionHeader, Spacer, StatTile, Text } from '@/components/ui';
import { useAuth } from '@/features/auth';
import {
  Avatar,
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  countryFlag,
  divisionForRating,
  fetchPlayerStats,
  fetchProfile,
  fetchRelationship,
  formatMonthYear,
  formatPercent,
  promptReport,
  removeFriendByPair,
  sendFriendRequest,
  unblockUser,
  type PlayerStats,
  type ProfileRow,
  type Relationship,
} from '@/features/social';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const selfId = user?.id ?? null;
  const targetId = String(id);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [relationship, setRelationship] = useState<Relationship>('none');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!targetId || !selfId) return;
    setLoading(true);
    try {
      const [p, s, rel] = await Promise.all([
        fetchProfile(targetId),
        fetchPlayerStats(targetId),
        fetchRelationship(selfId, targetId),
      ]);
      setProfile(p);
      setStats(s);
      setRelationship(rel.relationship);
      setRequestId(rel.requestId);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [targetId, selfId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (error) {
      showAlert(t('social.report.errorTitle'), (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePrimaryAction = () => {
    if (!selfId) return;
    switch (relationship) {
      case 'none':
        void run(() => sendFriendRequest(selfId, targetId));
        break;
      case 'request_received':
        if (requestId) void run(() => acceptFriendRequest(requestId));
        break;
      case 'request_sent':
        if (requestId) void run(() => cancelFriendRequest(requestId));
        break;
      case 'blocked':
        void run(() => unblockUser(selfId, targetId));
        break;
      default:
        break;
    }
  };

  const confirmBlock = () => {
    if (!selfId) return;
    showAlert(t('social.block.title'), t('social.block.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('social.block.confirm'),
        style: 'destructive',
        onPress: () => run(() => blockUser(selfId, targetId)),
      },
    ]);
  };

  const confirmRemove = () => {
    if (!selfId) return;
    showAlert(t('friends.removeTitle'), t('friends.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('friends.remove'),
        style: 'destructive',
        onPress: () => run(() => removeFriendByPair(selfId, targetId)),
      },
    ]);
  };

  if (loading) {
    return (
      <Screen testID="public-profile-screen">
        <View style={styles.centerPad}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen testID="public-profile-screen">
        <Card>
          <Text variant="subhead" color="muted" center>
            {t('social.loadError')}
          </Text>
        </Card>
      </Screen>
    );
  }

  const displayName = profile.display_name || profile.username;
  const rating = stats?.current_rating ?? 1200;
  const division = divisionForRating(rating);
  const isSelf = relationship === 'self';

  const primaryLabel = (() => {
    switch (relationship) {
      case 'friends':
        return null;
      case 'request_received':
        return t('friends.accept');
      case 'request_sent':
        return t('friends.cancel');
      case 'blocked':
        return t('social.unblock');
      default:
        return t('social.addFriend');
    }
  })();

  const primaryIcon = (() => {
    switch (relationship) {
      case 'request_received':
        return 'check' as const;
      case 'request_sent':
        return 'clock' as const;
      case 'blocked':
        return 'unlock' as const;
      default:
        return 'user-plus' as const;
    }
  })();

  return (
    <Screen testID="public-profile-screen">
      <View style={styles.identity}>
        <Avatar avatarUrl={profile.avatar_url} name={profile.username} size={72} />
        <View style={styles.identityBody}>
          <Text variant="h2">{displayName}</Text>
          <Text variant="subhead" color="muted">
            {countryFlag(profile.country_code)} @{profile.username}
          </Text>
          <View style={styles.badgeRow}>
            <Badge label={t(`social.divisions.${division.key}`)} tone="accent" />
            {relationship === 'friends' ? (
              <Badge label={t('friends.title')} tone="success" />
            ) : null}
            {relationship === 'blocked' ? (
              <Badge label={t('social.blocked')} tone="destructive" />
            ) : null}
          </View>
        </View>
      </View>

      <Spacer size="sm" />
      <Text variant="caption" color="muted">
        {t('profile.memberSince', { date: formatMonthYear(profile.created_at, i18n.language) })}
        {'  ·  '}
        {t('profile.level', { level: profile.level })}
      </Text>

      {!isSelf ? (
        <>
          <Spacer size="lg" />
          <View style={styles.actions}>
            {primaryLabel ? (
              <Button
                label={primaryLabel}
                icon={primaryIcon}
                variant={relationship === 'blocked' ? 'secondary' : 'primary'}
                loading={busy}
                onPress={handlePrimaryAction}
                style={styles.flex}
              />
            ) : (
              <Button
                label={t('friends.remove')}
                icon="user-minus"
                variant="secondary"
                onPress={confirmRemove}
                style={styles.flex}
              />
            )}
            {relationship !== 'blocked' ? (
              <Button
                label={t('friends.block')}
                icon="slash"
                variant="ghost"
                onPress={confirmBlock}
              />
            ) : null}
            <Button
              label={t('friends.report')}
              icon="flag"
              variant="ghost"
              onPress={() => promptReport(targetId)}
            />
          </View>
        </>
      ) : (
        <>
          <Spacer size="lg" />
          <Button
            label={t('profile.title')}
            icon="user"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/(tabs)/profile')}
          />
        </>
      )}

      <Spacer size="xl" />

      <SectionHeader title={t('profile.stats.title')} />
      <Card>
        <View style={styles.statsRow}>
          <StatTile label={t('profile.stats.rating')} value={String(rating)} tone="accent" />
          <StatTile label={t('profile.stats.wins')} value={String(stats?.wins ?? 0)} tone="success" />
          <StatTile label={t('profile.stats.losses')} value={String(stats?.losses ?? 0)} tone="destructive" />
          <StatTile
            label={t('profile.stats.winRate')}
            value={stats ? formatPercent(stats.win_rate) : '—'}
            tone="primary"
          />
        </View>
        <Spacer size="lg" />
        <View style={styles.statsRow}>
          <StatTile label={t('profile.stats.matches')} value={String(stats?.matches_played ?? 0)} />
          <StatTile
            label={t('profile.stats.hitRate')}
            value={stats ? formatPercent(stats.accuracy) : '—'}
            tone="accent"
          />
          <StatTile label={t('profile.stats.shipsSunk')} value={String(stats?.ships_sunk ?? 0)} />
          <StatTile
            label={t('profile.stats.bestRating')}
            value={String(stats?.best_rating ?? rating)}
            tone="warning"
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerPad: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identityBody: {
    flex: 1,
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
