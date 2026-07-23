/** Cosmetics shop: catalog, inventory, equipped, purchase, equip. */
import { Router, type IRouter } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  db,
  cosmeticItemsTable,
  userInventoryTable,
  equippedCosmeticsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import { equipCosmeticSchema } from "../lib/schemas";
import { z } from "zod";
import { uuidSchema } from "../lib/schemas";

const router: IRouter = Router();
router.use(requireAuth);

/** GET /api/shop/catalog — purchasable cosmetics. */
router.get(
  "/catalog",
  asyncHandler(async (_req, res) => {
    const items = await db
      .select()
      .from(cosmeticItemsTable)
      .where(isNull(cosmeticItemsTable.deletedAt))
      .orderBy(asc(cosmeticItemsTable.type), asc(cosmeticItemsTable.sortOrder));
    res.json({ items });
  }),
);

/** GET /api/shop/inventory — caller's owned + equipped items. */
router.get(
  "/inventory",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const inventory = await db
      .select()
      .from(userInventoryTable)
      .where(eq(userInventoryTable.userId, uid));
    const equipped = await db
      .select()
      .from(equippedCosmeticsTable)
      .where(eq(equippedCosmeticsTable.userId, uid));
    res.json({ inventory, equipped });
  }),
);

/** POST /api/shop/purchase — acquire a purchasable/free item. */
router.post(
  "/purchase",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { itemId } = parseBody(z.object({ itemId: uuidSchema }), req.body);
    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(cosmeticItemsTable)
        .where(and(eq(cosmeticItemsTable.id, itemId), isNull(cosmeticItemsTable.deletedAt)))
        .limit(1);
      if (!item) throw appError("NOT_FOUND", "Item not found");
      if (!item.isPurchasable && !item.isDefault) {
        throw appError("FORBIDDEN", "Item is not purchasable");
      }
      const [inv] = await tx
        .insert(userInventoryTable)
        .values({ userId: uid, itemId, source: "purchase" })
        .onConflictDoNothing()
        .returning();
      return { granted: !!inv, item };
    });
    res.json({ ok: true, granted: result.granted });
  }),
);

/** POST /api/shop/equip — equip an owned cosmetic into its type slot. */
router.post(
  "/equip",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const body = parseBody(equipCosmeticSchema, req.body);
    const [owned] = await db
      .select({ id: userInventoryTable.id })
      .from(userInventoryTable)
      .where(and(eq(userInventoryTable.userId, uid), eq(userInventoryTable.itemId, body.itemId)))
      .limit(1);
    if (!owned) throw appError("FORBIDDEN", "You do not own this item");
    await db
      .insert(equippedCosmeticsTable)
      .values({ userId: uid, type: body.type, itemId: body.itemId })
      .onConflictDoUpdate({
        target: [equippedCosmeticsTable.userId, equippedCosmeticsTable.type],
        set: { itemId: body.itemId, updatedAt: new Date() },
      });
    res.json({ ok: true });
  }),
);

export default router;
