import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import {
  Badge,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  Spacer,
  Text,
} from '@/components/ui';
import {
  fetchEntries,
  fetchMatches,
  fetchPlayerNames,
  fetchRounds,
  fetchTournaments,
} from '@/features/tournaments/service';
import type {
  Tournament,
  TournamentEntry,
  TournamentMatch,
  TournamentRound,
} from '@/features/tournaments/types';

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [all, rnds, mtchs, ents] = await Promise.all([
        fetchTournaments(),
        fetchRounds(id),
        fetchMatches(id),
        fetchEntries([id]),
      ]);
      setTournament(all.find((tn) => tn.id === id) ?? null);
      setRounds(rnds);
      setMatches(mtchs);
      setEntries(ents);
      const ids = [
        ...mtchs.flatMap((m) => [m.player_one_id, m.player_two_id, m.winner_id]),
        ...ents.map((e) => e.player_id),
      ].filter((x): x is string => !!x);
      setNames(await fetchPlayerNames(ids));
    } catch {
      setTournament(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = (playerId: string | null) =>
    playerId ? (names.get(playerId) ?? playerId.slice(0, 6)) : t('competeMeta.tbd');

  const podium = entries
    .filter((e) => e.final_rank != null)
    .sort((a, b) => (a.final_rank ?? 99) - (b.final_rank ?? 99))
    .slice(0, 3);

  return (
    <Screen testID="tournament-detail-screen">
      <Stack.Screen options={{ title: tournament?.name ?? t('competeMeta.bracket') }} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : !tournament ? (
        <Card>
          <EmptyState icon="alert-circle" title={t('competeMeta.noTournaments')} />
        </Card>
      ) : (
        <>
          <Text variant="h2">{tournament.name}</Text>
          {tournament.description ? (
            <>
              <Spacer size="xs" />
              <Text variant="subhead" color="muted">
                {tournament.description}
              </Text>
            </>
          ) : null}

          {podium.length > 0 ? (
            <>
              <Spacer size="xl" />
              <SectionHeader title={t('competeMeta.podium')} />
              <Card>
                {podium.map((e, i) => (
                  <View key={e.id} style={styles.podiumRow}>
                    <Feather
                      name="award"
                      size={iconSize.md}
                      color={[colors.warning, colors.mutedForeground, colors.accent][i]}
                    />
                    <Text variant="bodyMedium" style={styles.flex}>
                      {nameOf(e.player_id)}
                    </Text>
                    <Badge
                      label={
                        [
                          t('competeMeta.firstPlace'),
                          t('competeMeta.secondPlace'),
                          t('competeMeta.thirdPlace'),
                        ][i]
                      }
                      tone={i === 0 ? 'warning' : 'muted'}
                    />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <Spacer size="xl" />
          <SectionHeader title={t('competeMeta.bracket')} />

          {rounds.length === 0 ? (
            <Card>
              <EmptyState icon="git-merge" title={t('competeMeta.tbd')} />
            </Card>
          ) : (
            rounds.map((round) => {
              const roundMatches = matches.filter((m) => m.round_id === round.id);
              return (
                <View key={round.id} style={styles.roundBlock}>
                  <Text variant="title" color="muted">
                    {round.name ?? t('competeMeta.round', { n: round.round_number })}
                  </Text>
                  <Spacer size="sm" />
                  <View style={styles.list}>
                    {roundMatches.map((m) => (
                      <Card key={m.id}>
                        <BracketSlot
                          name={nameOf(m.player_one_id)}
                          winner={!!m.winner_id && m.winner_id === m.player_one_id}
                        />
                        <View
                          style={[styles.vsDivider, { borderColor: colors.border }]}
                        >
                          <Text variant="label" color="muted">
                            VS
                          </Text>
                        </View>
                        <BracketSlot
                          name={nameOf(m.player_two_id)}
                          winner={!!m.winner_id && m.winner_id === m.player_two_id}
                        />
                      </Card>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </>
      )}
    </Screen>
  );
}

function BracketSlot({ name, winner }: { name: string; winner: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.slot}>
      <Text variant="bodyMedium" color={winner ? 'success' : 'foreground'}>
        {name}
      </Text>
      {winner ? <Feather name="check" size={iconSize.sm} color={colors.success} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  flex: { flex: 1 },
  list: { gap: spacing.md },
  roundBlock: { marginBottom: spacing.xl },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  vsDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
    paddingTop: spacing.xs,
    alignItems: 'center',
    borderRadius: radii.none,
  },
});
