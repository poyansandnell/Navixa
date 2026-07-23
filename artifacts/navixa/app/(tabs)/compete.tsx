import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useIsGuest } from '@/hooks/useIsGuest';
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
  fetchEntries,
  fetchTournaments,
  registerForTournament,
  unregisterFromTournament,
} from '@/features/tournaments/service';
import type { Tournament, TournamentEntry } from '@/features/tournaments/types';
import {
  claimQuest,
  fetchQuests,
  fetchUserQuests,
  mergeQuests,
  type QuestView,
} from '@/features/quests/service';

type TabStatus = Tournament['status'];

const ONGOING: TabStatus[] = ['ongoing'];
const OPEN: TabStatus[] = ['registration', 'upcoming'];
const DONE: TabStatus[] = ['completed'];

function ProgressBar({ progress, goal }: { progress: number; goal: number }) {
  const colors = useColors();
  const pct = goal > 0 ? Math.min(1, progress / goal) : 0;
  return (
    <View style={[styles.track, { backgroundColor: colors.secondary }]}>
      <View
        style={[
          styles.fill,
          { backgroundColor: colors.primary, width: `${pct * 100}%` },
        ]}
      />
    </View>
  );
}

export default function CompeteScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const isGuest = useIsGuest();

  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [quests, setQuests] = useState<QuestView[]>([]);
  const [weeklyQuests, setWeeklyQuests] = useState<QuestView[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchTournaments();
      setTournaments(list);
      const ents = await fetchEntries(list.map((tn) => tn.id));
      setEntries(ents);

      if (user) {
        const [daily, weekly, mine] = await Promise.all([
          fetchQuests('daily'),
          fetchQuests('weekly'),
          fetchUserQuests(user.id),
        ]);
        setQuests(mergeQuests(daily, mine));
        setWeeklyQuests(mergeQuests(weekly, mine));
      }
    } catch {
      // Soft-fail: show empty states rather than crashing the tab.
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const entryCount = useCallback(
    (id: string) => entries.filter((e) => e.tournament_id === id).length,
    [entries],
  );
  const isRegistered = useCallback(
    (id: string) =>
      !!user && entries.some((e) => e.tournament_id === id && e.player_id === user.id),
    [entries, user],
  );

  const handleRegister = async (tn: Tournament) => {
    if (isGuest || !user) {
      showAlert(t('competeMeta.guestBlockedTitle'), t('competeMeta.guestBlockedBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('onboarding.getStarted.createAccount'), onPress: () => router.push('/(auth)/sign-up') },
      ]);
      return;
    }
    setBusyId(tn.id);
    try {
      if (isRegistered(tn.id)) {
        const ok = await unregisterFromTournament(tn.id, user.id);
        if (ok) setEntries((prev) => prev.filter((e) => !(e.tournament_id === tn.id && e.player_id === user.id)));
      } else {
        const res = await registerForTournament(tn.id, user.id, tn.max_players);
        if (res.ok) {
          await load();
          showAlert(t('competeMeta.registerSuccessTitle'), t('competeMeta.registerSuccessBody'));
        } else {
          showAlert(t('common.appName'), t('competeMeta.registerError'));
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const renderTournament = (tn: Tournament) => {
    const count = entryCount(tn.id);
    const registered = isRegistered(tn.id);
    const full = count >= tn.max_players;
    const canRegister = OPEN.includes(tn.status);
    return (
      <Card key={tn.id}>
        <View style={styles.row}>
          <View style={[styles.iconTile, { backgroundColor: colors.secondary }]}>
            <Feather name="award" size={iconSize.md} color={colors.accent} />
          </View>
          <View style={styles.rowBody}>
            <Text variant="bodyMedium">{tn.name}</Text>
            <Text variant="caption" color="muted">
              {t('competeMeta.players', { count, max: tn.max_players })}
            </Text>
          </View>
          {registered ? <Badge label={t('competeMeta.registered')} tone="success" /> : null}
        </View>
        <Spacer size="md" />
        <View style={styles.actions}>
          <Button
            label={t('competeMeta.viewBracket')}
            variant="ghost"
            size="sm"
            icon="git-merge"
            onPress={() => router.push(`/tournaments/${tn.id}`)}
          />
          {canRegister ? (
            <Button
              label={
                registered
                  ? t('competeMeta.unregister')
                  : full
                    ? t('competeMeta.full')
                    : t('competeMeta.register')
              }
              variant={registered ? 'secondary' : 'primary'}
              size="sm"
              disabled={(!registered && full) || busyId === tn.id}
              loading={busyId === tn.id}
              onPress={() => handleRegister(tn)}
            />
          ) : null}
        </View>
      </Card>
    );
  };

  const ongoing = tournaments.filter((tn) => ONGOING.includes(tn.status));
  const open = tournaments.filter((tn) => OPEN.includes(tn.status));
  const completed = tournaments.filter((tn) => DONE.includes(tn.status));
  const allQuests = [...quests, ...weeklyQuests];

  return (
    <Screen testID="compete-screen">
      <View style={styles.header}>
        <Text variant="h1">{t('compete.title')}</Text>
        <Text variant="subhead" color="muted">
          {t('compete.subtitle')}
        </Text>
      </View>

      <Spacer size="xl" />

      {/* Season teaser */}
      <Card elevated style={[styles.seasonCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.row}>
          <View style={[styles.iconTile, { backgroundColor: colors.card }]}>
            <Feather name="star" size={iconSize.lg} color={colors.warning} />
          </View>
          <View style={styles.rowBody}>
            <Text variant="title">{t('competeMeta.seasonTitle')}</Text>
            <Text variant="subhead" color="muted">
              {t('competeMeta.seasonTeaser')}
            </Text>
          </View>
        </View>
      </Card>

      <Spacer size="xl" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <SectionHeader title={t('competeMeta.ongoing')} />
          {ongoing.length > 0 ? (
            <View style={styles.list}>{ongoing.map(renderTournament)}</View>
          ) : (
            <Card>
              <EmptyState icon="activity" title={t('competeMeta.noTournaments')} />
            </Card>
          )}

          <Spacer size="xl" />

          <SectionHeader title={t('competeMeta.upcoming')} />
          {open.length > 0 ? (
            <View style={styles.list}>{open.map(renderTournament)}</View>
          ) : (
            <Card>
              <EmptyState icon="calendar" title={t('competeMeta.noTournaments')} />
            </Card>
          )}

          {completed.length > 0 ? (
            <>
              <Spacer size="xl" />
              <SectionHeader title={t('competeMeta.completed')} />
              <View style={styles.list}>{completed.map(renderTournament)}</View>
            </>
          ) : null}

          <Spacer size="xl" />

          <SectionHeader title={t('competeMeta.dailyQuests')} />
          {isGuest || !user ? (
            <Card>
              <Text variant="subhead" color="muted">
                {t('competeMeta.guestBlockedBody')}
              </Text>
            </Card>
          ) : allQuests.length > 0 ? (
            <View style={styles.list}>
              {allQuests.map((q) => (
                <QuestCard key={`${q.id}`} quest={q} userId={user.id} onClaimed={load} />
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState icon="target" title={t('competeMeta.noQuests')} />
            </Card>
          )}

          <Spacer size="xl" />

          {/* Weekly best teaser */}
          <Card style={[styles.seasonCard, { backgroundColor: colors.secondary }]}>
            <View style={styles.row}>
              <View style={[styles.iconTile, { backgroundColor: colors.card }]}>
                <Feather name="trending-up" size={iconSize.lg} color={colors.accent} />
              </View>
              <View style={styles.rowBody}>
                <Text variant="title">{t('competeMeta.weeklyBestTitle')}</Text>
                <Text variant="subhead" color="muted">
                  {t('competeMeta.weeklyBestTeaser')}
                </Text>
              </View>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

function QuestCard({
  quest,
  userId,
  onClaimed,
}: {
  quest: QuestView;
  userId: string;
  onClaimed: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const completed = quest.progress >= quest.goal;

  const handleClaim = async () => {
    setBusy(true);
    try {
      const res = await claimQuest(quest.userQuestId);
      if (res.ok) {
        onClaimed();
      } else if (res.needsServer) {
        showAlert(t('common.appName'), t('competeMeta.questClaimTodo'));
      }
    } finally {
      setBusy(false);
    }
  };

  const rewardLabel = quest.reward_xp
    ? t('competeMeta.rewardXp', { xp: quest.reward_xp })
    : t('competeMeta.rewardCoins', { coins: quest.reward_coins });

  return (
    <Card>
      <View style={styles.questHead}>
        <Text variant="bodyMedium">{t(quest.title_key, quest.code)}</Text>
        <Badge label={rewardLabel} tone="accent" />
      </View>
      <Spacer size="xs" />
      <Text variant="caption" color="muted">
        {t(quest.description_key, '')}
      </Text>
      <Spacer size="sm" />
      <ProgressBar progress={quest.progress} goal={quest.goal} />
      <Spacer size="xs" />
      <View style={styles.questFoot}>
        <Text variant="caption" color="muted">
          {t('competeMeta.questProgress', { progress: quest.progress, goal: quest.goal })}
        </Text>
        <Button
          label={quest.claimed ? t('competeMeta.claimed') : t('competeMeta.claim')}
          size="sm"
          variant={quest.claimed ? 'secondary' : 'success'}
          disabled={!completed || quest.claimed || busy}
          loading={busy}
          onPress={handleClaim}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  seasonCard: { borderWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: 2 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  loader: { marginTop: spacing.xxl },
  questHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  questFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  track: { height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radii.pill },
});
