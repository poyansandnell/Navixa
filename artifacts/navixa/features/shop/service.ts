/**
 * Navixa — cosmetics shop data access via the api-server.
 *
 *   GET  /api/shop/catalog    → { items }
 *   GET  /api/shop/inventory  → { inventory, equipped }
 *   POST /api/shop/purchase    { itemId } → { ok, granted }
 *   POST /api/shop/equip       { type, itemId } → { ok }
 *
 * The server returns camelCase drizzle rows which we normalise into the app's
 * snake_case view models here. Ownership + equip guards are enforced
 * server-side (you cannot equip an item you do not own).
 *
 * ── Monetization note ────────────────────────────────────────────────────
 * This dev build uses ONLY a test currency (coins / XP). There are NO
 * real-money purchase paths and no `price_cents` products are surfaced.
 * When adding real IAP later, integrate a store SDK and validate receipts
 * server-side; the client should never mint currency or grant inventory.
 */
import { apiFetch } from '@/lib/api';

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

interface ServerCosmeticItem {
  id: string;
  code: string;
  type: CosmeticType;
  rarity: CosmeticRarity;
  nameKey: string;
  descriptionKey?: string | null;
  previewUrl?: string | null;
  priceCoins?: number | null;
  isPurchasable?: boolean | null;
  isDefault?: boolean | null;
  sortOrder?: number | null;
}

interface ServerInventoryRow {
  itemId: string;
}

interface ServerEquippedRow {
  type: CosmeticType;
  itemId: string;
}

function toCosmeticItem(i: ServerCosmeticItem): CosmeticItem {
  return {
    id: i.id,
    code: i.code,
    type: i.type,
    rarity: i.rarity,
    name_key: i.nameKey,
    description_key: i.descriptionKey ?? null,
    preview_url: i.previewUrl ?? null,
    price_coins: i.priceCoins ?? null,
    is_purchasable: Boolean(i.isPurchasable),
    is_default: Boolean(i.isDefault),
    sort_order: i.sortOrder ?? 0,
  };
}

/** Fetch the full catalog, ordered by type then sort order. */
export async function fetchCatalog(): Promise<CosmeticItem[]> {
  const res = await apiFetch<{ items: ServerCosmeticItem[] }>('/shop/catalog');
  return res.items.map(toCosmeticItem);
}

/** Fetch the current user's owned item ids. */
export async function fetchInventory(_userId: string): Promise<Set<string>> {
  const res = await apiFetch<{ inventory: ServerInventoryRow[]; equipped: ServerEquippedRow[] }>(
    '/shop/inventory',
  );
  return new Set(res.inventory.map((r) => r.itemId));
}

/** Fetch the current user's equipped item per type. */
export async function fetchEquipped(_userId: string): Promise<Map<CosmeticType, string>> {
  const res = await apiFetch<{ inventory: ServerInventoryRow[]; equipped: ServerEquippedRow[] }>(
    '/shop/inventory',
  );
  const map = new Map<CosmeticType, string>();
  for (const row of res.equipped) map.set(row.type, row.itemId);
  return map;
}

/**
 * Purchase (or claim a free/default) cosmetic. Returns true when newly granted.
 */
export async function purchaseItem(_userId: string, itemId: string): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean; granted: boolean }>('/shop/purchase', {
    method: 'POST',
    body: { itemId },
  });
  return res.granted;
}

/**
 * Equip an owned cosmetic into its (user, type) slot. Returns false if the
 * write fails (e.g. item not owned — the server rejects it).
 */
export async function equipCosmetic(
  _userId: string,
  type: CosmeticType,
  itemId: string,
): Promise<boolean> {
  try {
    await apiFetch('/shop/equip', { method: 'POST', body: { type, itemId } });
    return true;
  } catch {
    return false;
  }
}
