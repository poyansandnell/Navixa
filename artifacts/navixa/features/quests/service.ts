/**
 * Navixa — daily/weekly quests data access via the api-server.
 *
 *   GET  /api/quests?period=daily|weekly|event → { quests, progress }
 *   POST /api/quests/claim { userQuestId }      → { ok, rewardXp, rewardCoins }
 *
 * Reward granting is fully server-authoritative. The server returns camelCase
 * rows which we normalise to the app's snake_case view models here.
 */
import { apiFetch } from '@/lib/api';

export type QuestPeriod = 'daily' | 'weekly' | 'event';
export type QuestStatus = 'in_progress' | 'completed' | 'claimed' | 'expired';

export interface DailyQuest {
  id: string;
  code: string;
  period: QuestPeriod;
  title_key: string;
  description_key: string;
  metric: string;
  goal: number;
  reward_xp: number;
  reward_coins: number;
}

export interface UserQuest {
  id: string;
  quest_id: string;
  progress: number;
  status: QuestStatus;
  claimed_at: string | null;
}

export interface QuestView extends DailyQuest {
  progress: number;
  status: QuestStatus;
  claimed: boolean;
  /** The user_quests row id, needed to claim (null when no progress yet). */
  userQuestId: string | null;
}

interface ServerDailyQuest {
  id: string;
  code: string;
  period: QuestPeriod;
  titleKey: string;
  descriptionKey: string;
  metric: string;
  goal: number;
  rewardXp: number;
  rewardCoins: number;
}

interface ServerUserQuest {
  id: string;
  questId: string;
  progress: number;
  status: QuestStatus;
  claimedAt: string | null;
}

function toDailyQuest(q: ServerDailyQuest): DailyQuest {
  return {
    id: q.id,
    code: q.code,
    period: q.period,
    title_key: q.titleKey,
    description_key: q.descriptionKey,
    metric: q.metric,
    goal: q.goal,
    reward_xp: q.rewardXp ?? 0,
    reward_coins: q.rewardCoins ?? 0,
  };
}

function toUserQuest(u: ServerUserQuest): UserQuest {
  return {
    id: u.id,
    quest_id: u.questId,
    progress: u.progress ?? 0,
    status: u.status,
    claimed_at: u.claimedAt ?? null,
  };
}

/** Fetch active quest definitions for a given period (+ the caller's progress). */
export async function fetchQuests(period: QuestPeriod): Promise<DailyQuest[]> {
  const res = await apiFetch<{ quests: ServerDailyQuest[]; progress: ServerUserQuest[] }>(
    '/quests',
    { query: { period } },
  );
  return res.quests.map(toDailyQuest);
}

/** Fetch the current user's progress rows (all periods). */
export async function fetchUserQuests(_userId: string): Promise<UserQuest[]> {
  const res = await apiFetch<{ quests: ServerDailyQuest[]; progress: ServerUserQuest[] }>(
    '/quests',
    { query: { period: 'daily' } },
  );
  return res.progress.map(toUserQuest);
}

/** Join quest definitions with the user's progress into view models. */
export function mergeQuests(
  quests: DailyQuest[],
  progress: UserQuest[],
): QuestView[] {
  const byQuest = new Map(progress.map((p) => [p.quest_id, p]));
  return quests.map((q) => {
    const p = byQuest.get(q.id);
    return {
      ...q,
      progress: p?.progress ?? 0,
      status: p?.status ?? 'in_progress',
      claimed: Boolean(p?.claimed_at) || p?.status === 'claimed',
      userQuestId: p?.id ?? null,
    };
  });
}

export interface ClaimResult {
  ok: boolean;
  /** True when the reward cannot be claimed client-side (no progress row). */
  needsServer: boolean;
  rewardXp?: number;
  rewardCoins?: number;
}

/**
 * Claim a completed quest's reward. Pass the `userQuestId` from the merged
 * QuestView; when it is null there is no progress row to claim yet.
 */
export async function claimQuest(
  userQuestId: string | null,
): Promise<ClaimResult> {
  if (!userQuestId) return { ok: false, needsServer: true };
  try {
    const res = await apiFetch<{ ok: boolean; rewardXp: number; rewardCoins: number }>(
      '/quests/claim',
      { method: 'POST', body: { userQuestId } },
    );
    return {
      ok: res.ok,
      needsServer: false,
      rewardXp: res.rewardXp,
      rewardCoins: res.rewardCoins,
    };
  } catch {
    return { ok: false, needsServer: true };
  }
}
