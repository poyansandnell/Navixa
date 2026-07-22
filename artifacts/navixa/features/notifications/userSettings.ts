/**
 * Navixa — server-side user settings (privacy + push categories).
 *
 * Backs the Settings screen. Reads/writes the `user_settings` row (1:1 with the
 * profile; owner-managed via RLS). The `on_auth_user_created` trigger seeds a
 * row on sign-up, so we upsert defensively in case a guest/legacy account is
 * missing one.
 *
 * NOTE: `user_settings` has no "show country" column in the fixed schema, so
 * that privacy preference is persisted locally (AsyncStorage) via
 * `useLocalPrivacyStore` and consumed when rendering the caller's own country.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { supabase } from '@/lib/supabase';

export interface UserSettingsRow {
  notifications_enabled: boolean;
  push_matches: boolean;
  push_turns: boolean;
  push_social: boolean;
  push_marketing: boolean;
  show_online_status: boolean;
}

export type UserSettingsColumn = keyof UserSettingsRow;

const DEFAULTS: UserSettingsRow = {
  notifications_enabled: true,
  push_matches: true,
  push_turns: true,
  push_social: true,
  push_marketing: false,
  show_online_status: true,
};

/** Fetch the current user's server settings, falling back to defaults. */
export async function fetchUserSettings(
  userId: string,
): Promise<UserSettingsRow> {
  const { data, error } = await supabase
    .from('user_settings')
    .select(
      'notifications_enabled, push_matches, push_turns, push_social, push_marketing, show_online_status',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return { ...DEFAULTS };
  return data as UserSettingsRow;
}

/**
 * Persist a single boolean setting. Upserts so a missing row is created.
 * Returns false on failure (the caller can surface a soft error + revert UI).
 */
export async function updateUserSetting(
  userId: string,
  column: UserSettingsColumn,
  value: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, [column]: value },
      { onConflict: 'user_id' },
    );
  return !error;
}

/** Blocked user (for the settings list). */
export interface BlockedUser {
  blocked_id: string;
  username: string | null;
  display_name: string | null;
}

/** Fetch the users the current user has blocked. */
export async function fetchBlockedUsers(
  userId: string,
): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, blocked:profiles!blocks_blocked_id_fkey(username, display_name)')
    .eq('blocker_id', userId);
  if (error || !data) return [];
  return (data as unknown as {
    blocked_id: string;
    blocked: { username: string | null; display_name: string | null } | null;
  }[]).map((row) => ({
    blocked_id: row.blocked_id,
    username: row.blocked?.username ?? null,
    display_name: row.blocked?.display_name ?? null,
  }));
}

/** Unblock a user by deleting the block row. */
export async function unblockUser(
  userId: string,
  blockedId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedId);
  return !error;
}

/**
 * Local-only privacy prefs that have no server column in the fixed schema.
 * Persisted with AsyncStorage so they survive reloads on-device.
 */
interface LocalPrivacyState {
  showCountry: boolean;
  setShowCountry: (value: boolean) => void;
}

export const useLocalPrivacyStore = create<LocalPrivacyState>()(
  persist(
    (set) => ({
      showCountry: true,
      setShowCountry: (showCountry) => set({ showCountry }),
    }),
    {
      name: 'navixa-privacy',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
