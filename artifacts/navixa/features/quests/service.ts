/**
 * Navixa — daily/weekly quests data access.
 *
 * `daily_quests` is a public catalog (RLS: active rows readable by all).
 * `user_quests` holds per-user progress and is readable by the owner. Writes
 * to `user_quests` are normally server-side (progress is granted by verified
 * game events). The client attempts a claim (update claimed_at/status) and
 * gracefully surfaces a TODO note if RLS blocks it — see claimQuest().
 */
import { supabase } from '@/lib/supabase';

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
}

/** Fetch active quest definitions for a given period. */
export async function fetchQuests(period: QuestPeriod): Promise<DailyQuest[]> {
  const { data, error } = await supabase
    .from('daily_quests')
    .select(
      'id, code, period, title_key, description_key, metric, goal, reward_xp, reward_coins',
    )
    .eq('period', period)
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []) as DailyQuest[];
}

/** Fetch the current user's progress rows. */
export async function fetchUserQuests(userId: string): Promise<UserQuest[]> {
  const { data, error } = await supabase
    .from('user_quests')
    .select('id, quest_id, progress, status, claimed_at')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as UserQuest[];
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
    };
  });
}

export interface ClaimResult {
  ok: boolean;
  /** True when the client write was rejected (typically server-only RLS). */
  needsServer: boolean;
}

/**
 * Attempt to claim a completed quest's reward.
 *
 * TODO(server): Reward granting (XP/coins ledger + inventory) must run in a
 * verified Edge Function so it cannot be forged from the client. Here we only
 * try to stamp the `user_quests` row as claimed; if RLS rejects the write we
 * report `needsServer` so the UI can show the "coming soon" note instead of a
 * hard error.
 */
export async function claimQuest(
  userId: string,
  questId: string,
): Promise<ClaimResult> {
  const { error } = await supabase
    .from('user_quests')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('quest_id', questId)
    .eq('status', 'completed');
  if (error) {
    return { ok: false, needsServer: true };
  }
  return { ok: true, needsServer: false };
}
