import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { Button, Card, Screen, Spacer, Text } from '@/components/ui';
import { PlacementBoard, computeCellSize } from '@/components/game';
import { buildPlacement, nextUnplacedShip } from '@/store/game';
import { selectionHaptic } from '@/features/game/helpers';
import { useSettingsStore } from '@/store/settings';
import {
  DEFAULT_RULES,
  createRng,
  generateRandomFleet,
  validateFleet,
} from '@/lib/engine';
import type { Coord, Orientation, Placement, ShipId } from '@/lib/engine';
import {
  OnlineError,
  submitFleet,
  useOnlineMatchStore,
} from '@/features/onlineMatch';
import { useMatchRealtime } from '@/features/onlineMatch';

/**
 * Online fleet placement. Reuses the offline PlacementBoard, but keeps its own
 * local draft (the offline game store is reserved for bot matches) and submits
 * the fleet to the server via submit-fleet. After submitting, it waits for the
 * opponent — realtime on the matches row transitions us to the play screen when
 * the match becomes `active`.
 */
export default function OnlineSetupScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const haptics = useSettingsStore((s) => s.haptics);

  const matchId = useOnlineMatchStore((s) => s.matchId);
  const setStatus = useOnlineMatchStore((s) => s.setStatus);
  const reconnect = useOnlineMatchStore((s) => s.reconnect);

  const rules = DEFAULT_RULES;

  const [draftFleet, setDraftFleet] = React.useState<Placement[]>([]);
  const [selectedShipId, setSelectedShipId] = React.useState<ShipId | null>(null);
  const [orientation, setOrientation] = React.useState<Orientation>('horizontal');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Redirect out if we somehow arrive without a match (reload / deep link).
  React.useEffect(() => {
    if (!matchId) router.replace('/(tabs)');
  }, [matchId]);

  const cellSize = computeCellSize(rules.boardSize, width, spacing.lg * 2 + spacing.lg * 2);

  React.useEffect(() => {
    if (selectedShipId == null) {
      const next = nextUnplacedShip(draftFleet, rules);
      if (next) setSelectedShipId(next.id);
    }
  }, [draftFleet, rules, selectedShipId]);

  const selectedSpec = rules.ships.find((s) => s.id === selectedShipId) ?? null;
  const validation = validateFleet(draftFleet, rules);
  const complete = draftFleet.length === rules.ships.length && validation.valid;

  const placeDraftShip = (placement: Placement) => {
    setDraftFleet((prev) => [...prev.filter((p) => p.id !== placement.id), placement]);
  };

  const handlePlace = (origin: Coord) => {
    if (!selectedSpec) return;
    const placement = buildPlacement(
      selectedSpec.id,
      selectedSpec.length,
      origin,
      orientation,
      rules.boardSize,
    );
    placeDraftShip(placement);
    selectionHaptic(haptics);
    const nextDraft = [...draftFleet.filter((p) => p.id !== placement.id), placement];
    const next = nextUnplacedShip(nextDraft, rules);
    setSelectedShipId(next ? next.id : placement.id);
  };

  const handleSelectShip = (id: ShipId) => {
    setSelectedShipId(id);
    const existing = draftFleet.find((p) => p.id === id);
    if (existing) setOrientation(existing.orientation);
    selectionHaptic(haptics);
  };

  const handleRotate = () => {
    setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'));
    if (selectedSpec) {
      const existing = draftFleet.find((p) => p.id === selectedSpec.id);
      if (existing) {
        const newOrientation: Orientation =
          existing.orientation === 'horizontal' ? 'vertical' : 'horizontal';
        placeDraftShip(
          buildPlacement(
            selectedSpec.id,
            selectedSpec.length,
            existing.origin,
            newOrientation,
            rules.boardSize,
          ),
        );
      }
    }
  };

  const handleRandomize = () => {
    const fleet = generateRandomFleet(rules, createRng(Date.now() >>> 0));
    setDraftFleet(fleet);
    setSelectedShipId(null);
  };

  const handleSubmit = async () => {
    if (!complete || !matchId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitFleet({ matchId, fleet: draftFleet });
      setSubmitted(true);
      if (res.matchStarted) {
        setStatus('active');
        router.replace('/online/play');
      }
      // Otherwise stay on this screen showing the waiting state; the realtime
      // subscription below advances us when the match activates.
    } catch (err) {
      const message = err instanceof OnlineError ? err.message : t('online.setup.error');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // While waiting, watch the match row for activation.
  useMatchRealtime(matchId, submitted, {
    onMatchRow: (row) => {
      const status = row.status as string | undefined;
      if (status === 'active') {
        setStatus('active');
        // Rebuild authoritative state before entering the game.
        void reconnect().then(() => router.replace('/online/play'));
      }
    },
  });

  // Fallback poll: if realtime is unavailable, reconnect periodically to detect
  // activation.
  React.useEffect(() => {
    if (!submitted) return;
    const id = setInterval(() => {
      void reconnect();
    }, 4000);
    return () => clearInterval(id);
  }, [submitted, reconnect]);

  const status = useOnlineMatchStore((s) => s.status);
  React.useEffect(() => {
    if (submitted && status === 'active') {
      router.replace('/online/play');
    }
  }, [submitted, status]);

  if (submitted) {
    return (
      <Screen testID="online-setup-screen">
        <Spacer size="xxl" />
        <View style={styles.waiting}>
          <Feather name="anchor" size={iconSize.xxl} color={colors.accent} />
          <Spacer size="lg" />
          <Text variant="h2" center>
            {t('online.setup.waitingOpponent')}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="online-setup-screen" scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.content}>
        <Card padded={false} style={styles.boardCard}>
          <View style={styles.boardWrap}>
            <PlacementBoard
              boardSize={rules.boardSize}
              cellSize={cellSize}
              placements={draftFleet}
              selectedShipId={selectedShipId}
              selectedLength={selectedSpec?.length ?? 0}
              orientation={orientation}
              onPlace={handlePlace}
              onSelectShip={handleSelectShip}
            />
          </View>
        </Card>

        <Spacer size="md" />

        <View style={styles.shipRow}>
        {rules.ships.map((ship) => {
          const placed = draftFleet.some((p) => p.id === ship.id);
          const selected = ship.id === selectedShipId;
          return (
            <Pressable
              key={ship.id}
              accessibilityRole="button"
              accessibilityLabel={t(`game.ships.${ship.id}`)}
              accessibilityState={{ selected }}
              onPress={() => handleSelectShip(ship.id)}
              style={[
                styles.shipChip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: placed ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                variant="caption"
                style={{ color: selected ? colors.primaryForeground : colors.foreground }}
              >
                {t(`game.ships.${ship.id}`)} · {ship.length}
              </Text>
              {placed ? <Feather name="check" size={iconSize.xs} color={colors.accent} /> : null}
            </Pressable>
          );
          })}
        </View>

        <Spacer size="sm" />

        <View style={styles.controls}>
          <Button
            label={t('game.setup.rotate')}
            icon="rotate-cw"
            variant="secondary"
            size="sm"
            onPress={handleRotate}
          />
          <Button
            label={t('game.setup.randomize')}
            icon="shuffle"
            variant="secondary"
            size="sm"
            onPress={handleRandomize}
          />
          <Button
            label={t('game.setup.reset')}
            icon="trash-2"
            variant="ghost"
            size="sm"
            onPress={() => {
              setDraftFleet([]);
              setSelectedShipId(null);
            }}
          />
        </View>

        {!validation.valid && draftFleet.length > 0 ? (
          <>
            <Spacer size="sm" />
            <Text variant="caption" color="destructive" center>
              {t('game.setup.invalid')}
            </Text>
          </>
        ) : null}

        {error ? (
          <>
            <Spacer size="sm" />
            <Text variant="subhead" color="destructive" center>
              {error}
            </Text>
          </>
        ) : null}
      </View>

      {/* Pinned CTA — always visible above the safe-area, no scrolling. */}
      <View style={styles.footer}>
        <Button
          label={t('online.setup.confirm')}
          icon="anchor"
          size="lg"
          fullWidth
          disabled={!complete}
          loading={submitting}
          onPress={handleSubmit}
          testID="online-setup-confirm"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingTop: spacing.sm,
  },
  boardCard: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  boardWrap: {
    alignSelf: 'center',
  },
  shipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  shipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  waiting: {
    alignItems: 'center',
  },
});
