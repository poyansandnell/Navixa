/**
 * Admin actions dispatcher — mirrors the Supabase `admin-actions` Edge Function
 * (a single POST /api/admin/actions with a `{ action, payload }` envelope).
 * Guarded by requireAdmin (profiles.is_admin).
 */
import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  profilesTable,
  reportsTable,
  bannedUsernamesTable,
  moderationActionsTable,
  auditLogsTable,
  tournamentsTable,
  dailyQuestsTable,
  cosmeticItemsTable,
  matchesTable,
  supportTicketsTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import { annulMatch } from "../game/annul";
import { publicProfileColumns } from "../lib/sanitizeProfile";

const router: IRouter = Router();
router.use(requireAuth, requireAdmin);

const p = <T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> =>
  parseBody(schema, payload ?? {});

async function audit(actorId: string, action: string, meta: Record<string, unknown>) {
  await db.insert(auditLogsTable).values({ actorId, action, metadata: meta });
}

type Handler = (payload: unknown, adminId: string) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  async search_users(payload) {
    const { query, limit } = p(
      z.object({ query: z.string().min(1).max(64), limit: z.number().int().min(1).max(100).default(25) }),
      payload,
    );
    const users = await db
      .select(publicProfileColumns)
      .from(profilesTable)
      .where(ilike(profilesTable.username, `%${query}%`))
      .limit(limit);
    return { users };
  },

  async list_support_tickets() {
    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(100);
    return { tickets };
  },

  async get_user_status(payload) {
    const { userId } = p(z.object({ userId: z.string().min(1).max(255) }), payload);
    const [profile] = await db
      .select(publicProfileColumns)
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    if (!profile) throw appError("NOT_FOUND", "User not found");
    const actions = await db
      .select()
      .from(moderationActionsTable)
      .where(and(eq(moderationActionsTable.targetId, userId), eq(moderationActionsTable.isActive, true)))
      .orderBy(desc(moderationActionsTable.createdAt));
    const suspended = actions.some((a) => a.action === "suspend" || a.action === "ban");
    return { profile, suspended, activeActions: actions };
  },

  async suspend_account(payload, adminId) {
    const data = p(
      z.object({
        userId: z.string().min(1).max(255),
        reason: z.string().max(500).optional(),
        notes: z.string().max(2000).optional(),
        until: z.string().datetime().optional(),
        permanent: z.boolean().default(false),
      }),
      payload,
    );
    await db.insert(moderationActionsTable).values({
      targetId: data.userId,
      moderatorId: adminId,
      action: data.permanent ? "ban" : "suspend",
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      expiresAt: data.until ? new Date(data.until) : null,
      isActive: true,
    });
    await audit(adminId, "suspend_account", { userId: data.userId, permanent: data.permanent });
    return { ok: true };
  },

  async unsuspend_account(payload, adminId) {
    const { userId } = p(z.object({ userId: z.string().min(1).max(255) }), payload);
    await db
      .update(moderationActionsTable)
      .set({ isActive: false })
      .where(
        and(
          eq(moderationActionsTable.targetId, userId),
          eq(moderationActionsTable.isActive, true),
          sql`${moderationActionsTable.action} in ('suspend', 'ban')`,
        ),
      );
    await audit(adminId, "unsuspend_account", { userId });
    return { ok: true };
  },

  async list_reports(payload) {
    const { status, limit } = p(
      z.object({
        status: z.enum(["open", "reviewing", "actioned", "dismissed"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
      payload,
    );
    const reports = await db
      .select()
      .from(reportsTable)
      .where(status ? eq(reportsTable.status, status) : undefined)
      .orderBy(desc(reportsTable.createdAt))
      .limit(limit);
    return { reports };
  },

  async resolve_report(payload, adminId) {
    const data = p(
      z.object({
        reportId: z.string().uuid(),
        status: z.enum(["reviewing", "actioned", "dismissed"]),
        resolution: z.string().max(2000).optional(),
      }),
      payload,
    );
    await db
      .update(reportsTable)
      .set({
        status: data.status,
        resolution: data.resolution ?? null,
        handledBy: adminId,
        handledAt: new Date(),
      })
      .where(eq(reportsTable.id, data.reportId));
    await audit(adminId, "resolve_report", { reportId: data.reportId, status: data.status });
    return { ok: true };
  },

  async list_banned_usernames() {
    const banned = await db
      .select()
      .from(bannedUsernamesTable)
      .orderBy(desc(bannedUsernamesTable.createdAt));
    return { banned };
  },

  async add_banned_username(payload, adminId) {
    const { pattern, reason } = p(
      z.object({ pattern: z.string().min(1).max(64), reason: z.string().max(500).optional() }),
      payload,
    );
    const [row] = await db
      .insert(bannedUsernamesTable)
      .values({ pattern: pattern.toLowerCase(), reason: reason ?? null, createdBy: adminId })
      .onConflictDoUpdate({
        target: bannedUsernamesTable.pattern,
        set: { isActive: true, reason: reason ?? null },
      })
      .returning();
    return { id: row.id };
  },

  async remove_banned_username(payload) {
    const { id } = p(z.object({ id: z.string().uuid() }), payload);
    await db.delete(bannedUsernamesTable).where(eq(bannedUsernamesTable.id, id));
    return { ok: true };
  },

  async create_tournament(payload, adminId) {
    const data = p(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
        mode: z.enum(["ranked", "casual", "friendly", "tournament", "bot"]).default("tournament"),
        format: z
          .enum(["single_elimination", "double_elimination", "round_robin", "swiss"])
          .default("single_elimination"),
        maxPlayers: z.number().int().min(2).max(256).default(16),
        minPlayers: z.number().int().min(2).max(256).default(2),
        boardSize: z.number().int().min(8).max(16).default(10),
        entryFeeCoins: z.number().int().min(0).default(0),
        startsAt: z.string().datetime().optional(),
      }),
      payload,
    );
    const [t] = await db
      .insert(tournamentsTable)
      .values({
        name: data.name,
        description: data.description ?? null,
        mode: data.mode,
        format: data.format,
        maxPlayers: data.maxPlayers,
        minPlayers: data.minPlayers,
        boardSize: data.boardSize,
        entryFeeCoins: data.entryFeeCoins,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        createdBy: adminId,
        status: "draft",
      })
      .returning({ id: tournamentsTable.id });
    await audit(adminId, "create_tournament", { tournamentId: t.id });
    return { tournamentId: t.id };
  },

  async update_tournament_status(payload, adminId) {
    const { tournamentId, status } = p(
      z.object({
        tournamentId: z.string().uuid(),
        status: z.enum(["draft", "registration", "upcoming", "ongoing", "completed", "cancelled"]),
      }),
      payload,
    );
    await db
      .update(tournamentsTable)
      .set({ status })
      .where(eq(tournamentsTable.id, tournamentId));
    await audit(adminId, "update_tournament_status", { tournamentId, status });
    return { ok: true };
  },

  async create_daily_quest(payload, adminId) {
    const data = p(
      z.object({
        code: z.string().min(1).max(64),
        period: z.enum(["daily", "weekly", "event"]).default("daily"),
        titleKey: z.string().min(1).max(120),
        descriptionKey: z.string().min(1).max(200),
        metric: z.string().min(1).max(64),
        goal: z.number().int().min(1),
        rewardXp: z.number().int().min(0).default(0),
        rewardCoins: z.number().int().min(0).default(0),
      }),
      payload,
    );
    const [q] = await db
      .insert(dailyQuestsTable)
      .values({
        code: data.code,
        period: data.period,
        titleKey: data.titleKey,
        descriptionKey: data.descriptionKey,
        metric: data.metric,
        goal: data.goal,
        rewardXp: data.rewardXp,
        rewardCoins: data.rewardCoins,
      })
      .returning({ id: dailyQuestsTable.id });
    await audit(adminId, "create_daily_quest", { questId: q.id });
    return { questId: q.id };
  },

  async upsert_cosmetic_item(payload, adminId) {
    const data = p(
      z.object({
        code: z.string().min(1).max(64),
        type: z.enum([
          "board_theme",
          "ship_skin",
          "avatar_frame",
          "emote",
          "victory_effect",
          "title",
          "flag",
        ]),
        rarity: z.enum(["common", "rare", "epic", "legendary"]).default("common"),
        nameKey: z.string().min(1).max(120),
        descriptionKey: z.string().max(200).optional(),
        priceCoins: z.number().int().min(0).nullish(),
        priceCents: z.number().int().min(0).nullish(),
        isPurchasable: z.boolean().default(true),
        sortOrder: z.number().int().min(0).default(0),
      }),
      payload,
    );
    const [item] = await db
      .insert(cosmeticItemsTable)
      .values({
        code: data.code,
        type: data.type,
        rarity: data.rarity,
        nameKey: data.nameKey,
        descriptionKey: data.descriptionKey ?? null,
        priceCoins: data.priceCoins ?? null,
        priceCents: data.priceCents ?? null,
        isPurchasable: data.isPurchasable,
        sortOrder: data.sortOrder,
      })
      .onConflictDoUpdate({
        target: cosmeticItemsTable.code,
        set: {
          type: data.type,
          rarity: data.rarity,
          nameKey: data.nameKey,
          descriptionKey: data.descriptionKey ?? null,
          priceCoins: data.priceCoins ?? null,
          priceCents: data.priceCents ?? null,
          isPurchasable: data.isPurchasable,
          sortOrder: data.sortOrder,
        },
      })
      .returning({ id: cosmeticItemsTable.id });
    await audit(adminId, "upsert_cosmetic_item", { itemId: item.id });
    return { itemId: item.id };
  },

  async annul_match(payload, adminId) {
    const { matchId, reason } = p(
      z.object({ matchId: z.string().uuid(), reason: z.string().max(500).optional() }),
      payload,
    );
    await annulMatch(matchId, adminId, reason ?? null);
    await audit(adminId, "annul_match", { matchId });
    return { ok: true };
  },

  async platform_stats() {
    const [users] = await db
      .select({ n: count() })
      .from(profilesTable)
      .where(isNull(profilesTable.deletedAt));
    const [totalMatches] = await db.select({ n: count() }).from(matchesTable);
    const [activeMatches] = await db
      .select({ n: count() })
      .from(matchesTable)
      .where(eq(matchesTable.status, "active"));
    const [openReports] = await db
      .select({ n: count() })
      .from(reportsTable)
      .where(eq(reportsTable.status, "open"));
    return {
      stats: {
        totalUsers: users?.n ?? 0,
        totalMatches: totalMatches?.n ?? 0,
        activeMatches: activeMatches?.n ?? 0,
        openReports: openReports?.n ?? 0,
      },
    };
  },
};

/** POST /api/admin/actions — single dispatcher, `{ action, payload }`. */
router.post(
  "/actions",
  asyncHandler(async (req, res) => {
    const adminId = res.locals.userId as string;
    const { action, payload } = parseBody(
      z.object({ action: z.string().min(1).max(64), payload: z.unknown().optional() }),
      req.body,
    );
    const handler = handlers[action];
    if (!handler) throw appError("INVALID_PAYLOAD", `Unknown admin action '${action}'`);
    const result = await handler(payload, adminId);
    res.json(result);
  }),
);

export default router;
