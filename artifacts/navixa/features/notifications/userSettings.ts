/**
 * Navixa — server-side user settings (privacy + push categories) via the
 * api-server.
 *
 *   GET   /api/notifications/settings        → { settings }
 *   PATCH /api/notifications/settings         { key, value } → { settings }
 *   GET   /api/social/blocks                 → { blocks }
 *   DELETE /api/social/blocks/:blockedId
 *
 * The server stores settings as camelCase columns on user_settings and the
 * PATCH endpoint accepts a single camelCase `key`. The app UI uses snake_case
 * column names, so we map between the two here.
 *
 * NOTE: user_settings has no "show country" column, so that privacy preference
 * is persisted locally (AsyncStorage) via `useLocalPrivacyStore`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { apiFetch } from '@/lib/api';
import { toProfileRow, type ServerProfile } from '@/lib/normalize';

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

/** Map an app snake_case column to the server's camelCase setting key. */
const COLUMN_TO_KEY: Record<UserSettingsColumn, string> = {
  notifications_enabled: 'notificationsEnabled',
  push_matches: 'pushMatches',
  push_turns: 'pushTurns',
  push_social: 'pushSocial',
  push_marketing: 'pushMarketing',
  show_online_status: 'showOnlineStatus',
};

interface ServerSettings {
  notificationsEnabled?: boolean;
  pushMatches?: boolean;
  pushTurns?: boolean;
  pushSocial?: boolean;
  pushMarketing?: boolean;
  showOnlineStatus?: boolean;
}

function toSettingsRow(s: ServerSettings | null | undefined): UserSettingsRow {
  if (!s) return { ...DEFAULTS };
  return {
    notifications_enabled: s.notificationsEnabled ?? DEFAULTS.notifications_enabled,
    push_matches: s.pushMatches ?? DEFAULTS.push_matches,
    push_turns: s.pushTurns ?? DEFAULTS.push_turns,
    push_social: s.pushSocial ?? DEFAULTS.push_social,
    push_marketing: s.pushMarketing ?? DEFAULTS.push_marketing,
    show_online_status: s.showOnlineStatus ?? DEFAULTS.show_online_status,
  };
}

/** Fetch the current user's server settings, falling back to defaults. */
export async function fetchUserSettings(_userId: string): Promise<UserSettingsRow> {
  try {
    const res = await apiFetch<{ settings: ServerSettings }>('/notifications/settings');
    return toSettingsRow(res.settings);
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Persist a single boolean setting. Returns false on failure (the caller can
 * surface a soft error + revert UI).
 */
export async function updateUserSetting(
  _userId: string,
  column: UserSettingsColumn,
  value: boolean,
): Promise<boolean> {
  try {
    await apiFetch('/notifications/settings', {
      method: 'PATCH',
      body: { key: COLUMN_TO_KEY[column], value },
    });
    return true;
  } catch {
    return false;
  }
}

/** Blocked user (for the settings list). */
export interface BlockedUser {
  blocked_id: string;
  username: string | null;
  display_name: string | null;
}

interface ServerBlock {
  blockedId: string;
}

/** Fetch the users the current user has blocked (decorated with profiles). */
export async function fetchBlockedUsers(_userId: string): Promise<BlockedUser[]> {
  try {
    const res = await apiFetch<{ blocks: ServerBlock[] }>('/social/blocks');
    const blocks = res.blocks ?? [];
    if (blocks.length === 0) return [];
    const profiles = await Promise.all(
      blocks.map((b) =>
        apiFetch<{ profile: ServerProfile }>(`/profile/${b.blockedId}`)
          .then((r) => toProfileRow(r.profile))
          .catch(() => null),
      ),
    );
    return blocks.map((b, i) => {
      const p = profiles[i];
      return {
        blocked_id: b.blockedId,
        username: p?.username ?? null,
        display_name: p?.display_name ?? null,
      };
    });
  } catch {
    return [];
  }
}

/** Unblock a user by deleting the block row. */
export async function unblockUser(_userId: string, blockedId: string): Promise<boolean> {
  try {
    await apiFetch(`/social/blocks/${blockedId}`, { method: 'DELETE' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Local-only privacy prefs that have no server column. Persisted with
 * AsyncStorage so they survive reloads on-device.
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
