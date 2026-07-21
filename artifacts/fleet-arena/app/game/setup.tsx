import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing, typography } from '@/constants/theme';
import { Button, Card, Screen, SectionHeader, Spacer, Text } from '@/components/ui';
import { PlacementBoard, computeCellSize } from '@/components/game';
import { useGameStore, buildPlacement, nextUnplacedShip } from '@/store/game';
import { selectionHaptic } from '@/features/game/helpers';
import { useSettingsStore } from '@/store/settings';
import { validateFleet } from '@/lib/engine';
import type { BotDifficulty, Coord, Orientation, ShipId } from '@/lib/engine';

const DIFFICULTIES: BotDifficulty[] = ['beginner', 'normal', 'expert'];

export default function SetupScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const haptics = useSettingsStore((s) => s.haptics);

  const rules = useGameStore((s) => s.rules);
  const difficulty = useGameStore((s) => s.difficulty);
  const draftFleet = useGameStore((s) => s.draftFleet);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const randomizeDraft = useGameStore((s) => s.randomizeDraft);
  const resetDraft = useGameStore((s) => s.resetDraft);
  const placeDraftShip = useGameStore((s) => s.placeDraftShip);
  const startMatch = useGameStore((s) => s.startMatch);

  const [selectedShipId, setSelectedShipId] = React.useState<ShipId | null>(null);
  const [orientation, setOrientation] = React.useState<Orientation>('horizontal');

  const cellSize = computeCellSize(rules.boardSize, width, spacing.lg * 2 + spacing.lg * 2);

  // Auto-select the next unplaced ship whenever the draft changes and nothing
  // is selected (keeps the flow moving without extra taps).
  React.useEffect(() => {
    if (selectedShipId == null) {
      const next = nextUnplacedShip(draftFleet, rules);
      if (next) setSelectedShipId(next.id);
    }
  }, [draftFleet, rules, selectedShipId]);

  const selectedSpec = rules.ships.find((s) => s.id === selectedShipId) ?? null;

  const validation = validateFleet(draftFleet, rules);
  const complete = draftFleet.length === rules.ships.length && validation.valid;

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
    // Advance to the next unplaced ship, if any.
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
    // If the selected ship is already placed, rotate it in place.
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

  const handleStart = () => {
    if (!complete) return;
    startMatch(Date.now());
    router.replace('/game/play');
  };

  return (
    <Screen testID="game-setup-screen">
      <SectionHeader title={t('game.setup.placeFleet')} />
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

      {/* Ship selector */}
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
              {placed ? (
                <Feather name="check" size={iconSize.xs} color={colors.accent} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Spacer size="md" />

      {/* Placement controls */}
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
          onPress={() => {
            randomizeDraft(Date.now());
            setSelectedShipId(null);
          }}
        />
        <Button
          label={t('game.setup.reset')}
          icon="trash-2"
          variant="ghost"
          size="sm"
          onPress={() => {
            resetDraft();
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

      <Spacer size="xl" />

      {/* Difficulty */}
      <SectionHeader title={t('game.setup.difficulty')} />
      <View style={styles.difficultyRow}>
        {DIFFICULTIES.map((d) => {
          const active = d === difficulty;
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setDifficulty(d)}
              style={[
                styles.difficultyChip,
                {
                  backgroundColor: active ? colors.accent : colors.card,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                variant="bodyMedium"
                style={{ color: active ? colors.accentForeground : colors.foreground }}
              >
                {t(`game.difficulty.${d}`)}
              </Text>
              <Text
                variant="caption"
                style={{
                  color: active ? colors.accentForeground : colors.mutedForeground,
                }}
              >
                {t(`game.difficultyDesc.${d}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Spacer size="xl" />

      <Button
        label={t('game.setup.start')}
        icon="anchor"
        size="lg"
        fullWidth
        disabled={!complete}
        onPress={handleStart}
        testID="game-start-button"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  difficultyRow: {
    gap: spacing.sm,
  },
  difficultyChip: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
});
