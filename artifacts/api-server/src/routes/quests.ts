/** Daily/weekly quests: list definitions + progress, claim rewards. */
import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  dailyQuestsTable,
  userQuestsTable,
  profilesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler, parseBody } from "../lib/http";
import { appError } from "../lib/errors";
import { claimQuestSchema } from "../lib/schemas";
import { z } from "zod";

const router: IRouter = Router();
router.use(requireAuth);

/** GET /api/quests?period=daily|weekly — active definitions + caller progress. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const { period } = parseBody(
      z.object({ period: z.enum(["daily", "weekly", "event"]).default("daily") }),
      req.query,
    );
    const quests = await db
      .select()
      .from(dailyQuestsTable)
      .where(and(eq(dailyQuestsTable.period, period), eq(dailyQuestsTable.isActive, true)));
    const progress = await db
      .select()
      .from(userQuestsTable)
      .where(eq(userQuestsTable.userId, uid));
    res.json({ quests, progress });
  }),
);

/** POST /api/quests/claim — claim a completed quest's reward (server-authoritative). */
router.post(
  "/claim",
  asyncHandler(async (req, res) => {
    const uid = res.locals.userId as string;
    const body = parseBody(claimQuestSchema, req.body);
    const result = await db.transaction(async (tx) => {
      const [uq] = await tx
        .select()
        .from(userQuestsTable)
        .where(and(eq(userQuestsTable.id, body.userQuestId), eq(userQuestsTable.userId, uid)))
        .for("update")
        .limit(1);
      if (!uq) throw appError("NOT_FOUND", "Quest progress not found");
      if (uq.status === "claimed") throw appError("CONFLICT", "Reward already claimed");
      if (uq.status !== "completed") throw appError("CONFLICT", "Quest is not completed");
      const [quest] = await tx
        .select()
        .from(dailyQuestsTable)
        .where(eq(dailyQuestsTable.id, uq.questId))
        .limit(1);
      await tx
        .update(userQuestsTable)
        .set({ status: "claimed", claimedAt: new Date() })
        .where(eq(userQuestsTable.id, uq.id));
      const rewardXp = quest?.rewardXp ?? 0;
      if (rewardXp > 0) {
        await tx
          .update(profilesTable)
          .set({ xp: sql`${profilesTable.xp} + ${rewardXp}` })
          .where(eq(profilesTable.id, uid));
      }
      return { rewardXp, rewardCoins: quest?.rewardCoins ?? 0 };
    });
    res.json({ ok: true, ...result });
  }),
);

export default router;
