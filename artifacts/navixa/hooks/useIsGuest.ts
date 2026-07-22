import { useAuth } from '@/features/auth/AuthContext';

/**
 * Returns true when the current session is an anonymous / guest session.
 *
 * Use this to gate features that require a permanent account (e.g. ranked
 * play, friends, purchases) and to prompt guests to upgrade.
 */
export function useIsGuest(): boolean {
  return useAuth().isGuest;
}
