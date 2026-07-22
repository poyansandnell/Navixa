/**
 * Navixa — cosmetics shop data access.
 *
 * Catalog: `cosmetic_items` (public read of non-deleted rows).
 * Ownership: `user_inventory` (owner read). Equipping: `equipped_cosmetics`
 * (owner-managed; upsert on the (user, type) slot). A DB trigger
 * (`guard_equipped_ownership`) rejects equipping items the user does not own.
 *
 * ── Monetization note ────────────────────────────────────────────────────
 * This dev build uses ONLY a test currency (coins / XP). There are NO
 * real-money purchase paths and no `price_cents` products are surfaced.
 * When adding real IAP later, integrate a store SDK (e.g. RevenueCat, or
 * expo-in-app-purchases / StoreKit + Google Play Billing) and validate
 * receipts in an Edge Function that grants inventory server-side. The client
 * should never mint currency or grant inventory directly in production.
 */
import { supabase } from '@/lib/supabase';

export type CosmeticType =
  | 'board_theme'
  | 'ship_skin'
  | 'avatar_frame'
  | 'emote'
  | 'victory_effect'
  | 'title'
  | 'flag';

export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CosmeticItem {
  id: string;
  code: string;
  type: CosmeticType;
  rarity: CosmeticRarity;
  name_key: string;
  description_key: string | null;
  preview_url: string | null;
  price_coins: number | null;
  is_purchasable: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface InventoryRow {
  item_id: string;
}

export interface EquippedRow {
  type: CosmeticType;
  item_id: string;
}

/** Fetch the full catalog, ordered by type then sort order. */
export async function fetchCatalog(): Promise<CosmeticItem[]> {
  const { data, error } = await supabase
    .from('cosmetic_items')
    .select(
      'id, code, type, rarity, name_key, description_key, preview_url, price_coins, is_purchasable, is_default, sort_order',
    )
    .is('deleted_at', null)
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CosmeticItem[];
}

/** Fetch the current user's owned item ids. */
export async function fetchInventory(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_inventory')
    .select('item_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r: InventoryRow) => r.item_id));
}

/** Fetch the current user's equipped item per type. */
export async function fetchEquipped(
  userId: string,
): Promise<Map<CosmeticType, string>> {
  const { data, error } = await supabase
    .from('equipped_cosmetics')
    .select('type, item_id')
    .eq('user_id', userId);
  if (error) throw error;
  const map = new Map<CosmeticType, string>();
  for (const row of (data ?? []) as EquippedRow[]) {
    map.set(row.type, row.item_id);
  }
  return map;
}

/**
 * Equip an owned cosmetic into its (user, type) slot. Uses upsert keyed on the
 * unique (user_id, type) index so re-equipping replaces the previous item.
 * Returns false if the write fails (e.g. item not owned — the DB trigger
 * rejects it).
 */
export async function equipCosmetic(
  userId: string,
  type: CosmeticType,
  itemId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('equipped_cosmetics')
    .upsert(
      { user_id: userId, type, item_id: itemId },
      { onConflict: 'user_id,type' },
    );
  return !error;
}
