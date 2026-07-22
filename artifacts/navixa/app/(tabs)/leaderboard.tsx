import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { radii, spacing } from '@/constants/theme';
import { Badge, Button, Card, Screen, Spacer, Text } from '@/components/ui';
import { useAuth } from '@/features/auth';
import {
  Avatar,
  countryFlag,
  divisionForRating,
  fetchLeaderboardPage,
  fetchProfile,
  fetchYourPosition,
  type LeaderboardEntry,
  type LeaderboardScope,
} from '@/features/social';

const SCOPES: LeaderboardScope[] = ['global', 'national', 'friends'];

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const selfId = user?.id ?? null;

  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [yourPos, setYourPos] = useState<{ rank: number | null; rating: number } | null>(null);

  // Resolve the user's country once (for national scope + your-position).
  useEffect(() => {
    if (!selfId) return;
    let cancelled = false;
    void fetchProfile(selfId).then((p) => {
      if (!cancelled) setCountryCode(p?.country_code ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [selfId]);

  const loadPage = useCallback(
    async (nextScope: LeaderboardScope, nextPage: number, append: boolean) => {
      if (!selfId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const { entries: rows, hasMore: more } = await fetchLeaderboardPage({
          scope: nextScope,
          page: nextPage,
          selfId,
          countryCode,
        });
        setEntries((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore(more);
        setPage(nextPage);
      } catch {
        if (!append) setEntries([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selfId, countryCode],
  );

  // Reload on scope / country change.
  useEffect(() => {
    if (!selfId) return;
    void loadPage(scope, 0, false);
    void fetchYourPosition({ scope, selfId, countryCode }).then(setYourPos).catch(() => setYourPos(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, selfId, countryCode]);

  const showNoCountry = scope === 'national' && !countryCode;

  return (
    <Screen testID="leaderboard-screen">
      <View style={styles.header}>
        <Text variant="h1">{t('leaderboard.title')}</Text>
        <Text variant="subhead" color="muted">
          {t('leaderboard.subtitle')}
        </Text>
      </View>

      <Spacer size="lg" />

      {/* Scope segmented control */}
      <View style={[styles.segment, { backgroundColor: colors.secondary }]}>
        {SCOPES.map((key) => {
          const active = scope === key;
          return (
            <Pressable
              key={key}
              onPress={() => setScope(key)}
              accessibilityRole="button"
              style={[styles.segmentItem, active && { backgroundColor: colors.card }]}
            >
              <Text variant="callout" color={active ? 'foreground' : 'muted'}>
                {t(`leaderboard.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Spacer size="lg" />

      {loading ? (
        <View style={styles.centerPad}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : showNoCountry ? (
        <Card>
          <Text variant="subhead" color="muted" center>
            {t('leaderboard.noCountry')}
          </Text>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <Text variant="subhead" color="muted" center>
            {t('leaderboard.empty')}
          </Text>
        </Card>
      ) : (
        <>
          <Card padded={false}>
            {entries.map((entry, i) => (
              <EntryRow
                key={`${entry.playerId}-${entry.rank}`}
                entry={entry}
                highlight={entry.playerId === selfId}
                divider={i < entries.length - 1}
                onPress={() => router.push(`/profile/${entry.playerId}`)}
              />
            ))}
          </Card>

          {hasMore ? (
            <>
              <Spacer size="md" />
              <Button
                label={t('leaderboard.loadMore')}
                variant="secondary"
                fullWidth
                loading={loadingMore}
                onPress={() => loadPage(scope, page + 1, true)}
              />
            </>
          ) : null}
        </>
      )}

      {/* Sticky "your position" — shown even when outside the current page. */}
      {yourPos && !showNoCountry ? (
        <>
          <Spacer size="lg" />
          <Card style={[styles.yourRank, { borderColor: colors.primary }]} padded={false}>
            <View style={styles.entry}>
              <Text variant="title" color="primary" style={styles.rank}>
                {yourPos.rank ?? '—'}
              </Text>
              <Avatar avatarUrl={user?.user_metadata?.avatar_url as string} name={user?.user_metadata?.username as string} size={32} />
              <View style={styles.name}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {t('leaderboard.you')}
                </Text>
              </View>
              <Text variant="bodyMedium" color="primary">
                {yourPos.rating}
              </Text>
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function EntryRow({
  entry,
  highlight,
  divider,
  onPress,
}: {
  entry: LeaderboardEntry;
  highlight: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const name = entry.profile?.display_name || entry.profile?.username || '—';
  const flag = countryFlag(entry.profile?.country_code);
  const division = divisionForRating(entry.rating);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.entry,
        highlight && { backgroundColor: colors.secondary },
        divider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Text
        variant="title"
        color={entry.rank <= 3 ? 'accent' : 'muted'}
        style={styles.rank}
      >
        {entry.rank}
      </Text>
      <Avatar avatarUrl={entry.profile?.avatar_url} name={entry.profile?.username} size={36} />
      <View style={styles.name}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {flag} {name}
        </Text>
        <View style={styles.divisionRow}>
          <Badge label={t(`social.divisions.${division.key}`)} tone="muted" />
        </View>
      </View>
      <Text variant="bodyMedium" color="accent">
        {entry.rating}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
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
  centerPad: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rank: {
    width: 32,
    textAlign: 'center',
  },
  name: {
    flex: 1,
    gap: spacing.xs,
  },
  divisionRow: {
    flexDirection: 'row',
  },
  yourRank: {
    borderWidth: 1,
  },
});
