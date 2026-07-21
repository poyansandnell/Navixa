/**
 * Fleet Arena — cosmetics shop.
 *
 * Grid of `cosmetic_items` grouped by category, showing ownership + equip state
 * from `user_inventory` / `equipped_cosmetics`. Equipping upserts the (user,
 * type) slot in `equipped_cosmetics`.
 *
 * ── Monetization ─────────────────────────────────────────────────────────
 * DEV BUILD: prices are shown in a TEST currency (coins) or XP only. There are
 * intentionally NO real-money purchase buttons and no `price_cents` products
 * are surfaced. For a production storefront, wire real IAP behind a store SDK
 * (RevenueCat / expo-in-app-purchases) and validate receipts + grant inventory
 * in a trusted Edge Function — never mint currency or grant items client-side.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
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
  equipCosmetic,
  fetchCatalog,
  fetchEquipped,
  fetchInventory,
  type CosmeticItem,
  type CosmeticType,
} from '@/features/shop/service';

/** Display order of categories in the shop. */
const CATEGORY_ORDER: CosmeticType[] = [
  'board_theme',
  'ship_skin',
  'victory_effect',
  'avatar_frame',
  'title',
  'emote',
  'flag',
];

const RARITY_TONE: Record<
  CosmeticItem['rarity'],
  'muted' | 'accent' | 'primary' | 'warning'
> = {
  common: 'muted',
  rare: 'accent',
  epic: 'primary',
  legendary: 'warning',
};

export default function ShopScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const isGuest = useIsGuest();

  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CosmeticItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<Map<CosmeticType, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchCatalog();
      setCatalog(items);
      if (user && !isGuest) {
        const [inv, eq] = await Promise.all([
          fetchInventory(user.id),
          fetchEquipped(user.id),
        ]);
        setOwned(inv);
        setEquipped(eq);
      }
    } catch {
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }, [user, isGuest]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleEquip = async (item: CosmeticItem) => {
    if (!user || isGuest) return;
    setBusyId(item.id);
    try {
      const ok = await equipCosmetic(user.id, item.type, item.id);
      if (ok) {
        setEquipped((prev) => new Map(prev).set(item.type, item.id));
      } else {
        showAlert(t('common.appName'), t('shop.equipError'));
      }
    } finally {
      setBusyId(null);
    }
  };

  const priceLabel = (item: CosmeticItem) => {
    if (item.is_default || item.price_coins === 0) return t('shop.free');
    if (item.price_coins == null || !item.is_purchasable) return t('shop.notForSale');
    return t('shop.priceCoins', { coins: item.price_coins });
  };

  const renderItem = (item: CosmeticItem) => {
    const isOwned = owned.has(item.id) || item.is_default;
    const isEquipped = equipped.get(item.type) === item.id;
    return (
      <Card key={item.id} style={styles.tile}>
        <View style={[styles.preview, { backgroundColor: colors.secondary }]}>
          <Feather name="image" size={iconSize.lg} color={colors.mutedForeground} />
        </View>
        <Spacer size="sm" />
        <Text variant="callout" numberOfLines={1}>
          {t(item.name_key, item.code)}
        </Text>
        <View style={styles.tileMeta}>
          <Badge label={t(`shop.rarity.${item.rarity}`)} tone={RARITY_TONE[item.rarity]} />
        </View>
        <Spacer size="sm" />
        {isEquipped ? (
          <Button label={t('shop.equipped')} variant="secondary" size="sm" fullWidth disabled />
        ) : isOwned ? (
          <Button
            label={t('shop.equip')}
            size="sm"
            fullWidth
            loading={busyId === item.id}
            disabled={busyId === item.id}
            onPress={() => handleEquip(item)}
          />
        ) : (
          <View style={styles.priceRow}>
            <Feather name="disc" size={iconSize.xs} color={colors.warning} />
            <Text variant="caption" color="muted">
              {priceLabel(item)}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <Screen testID="shop-screen">
      <Text variant="h1">{t('shop.title')}</Text>
      <Text variant="subhead" color="muted">
        {t('shop.subtitle')}
      </Text>

      <Spacer size="lg" />

      {/* Clearly marked dev currency notice — no real-money purchases. */}
      <Card style={[styles.banner, { backgroundColor: colors.secondary }]}>
        <View style={styles.bannerRow}>
          <Feather name="alert-triangle" size={iconSize.md} color={colors.warning} />
          <Text variant="caption" color="muted" style={styles.flex}>
            {t('shop.devCurrencyBanner')}
          </Text>
        </View>
      </Card>

      <Spacer size="xl" />

      {isGuest || !user ? (
        <Card>
          <Text variant="title">{t('shop.guestBlockedTitle')}</Text>
          <Spacer size="xs" />
          <Text variant="subhead" color="muted">
            {t('shop.guestBlockedBody')}
          </Text>
        </Card>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : catalog.length === 0 ? (
        <Card>
          <EmptyState icon="shopping-bag" title={t('shop.empty')} />
        </Card>
      ) : (
        CATEGORY_ORDER.map((type) => {
          const items = catalog.filter((i) => i.type === type);
          if (items.length === 0) return null;
          return (
            <View key={type} style={styles.categoryBlock}>
              <SectionHeader title={t(`shop.categories.${type}`)} />
              <View style={styles.grid}>{items.map(renderItem)}</View>
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: spacing.xxl },
  banner: { borderWidth: 0 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  categoryBlock: { marginBottom: spacing.xl },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
  },
  preview: {
    height: 80,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMeta: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
