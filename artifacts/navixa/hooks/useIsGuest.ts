/**
 * Returns true when the current session is an anonymous / guest session.
 *
 * Guest / anonymous sessions were removed during the Clerk migration, so this
 * always returns false. It is retained to avoid churning the many consumers
 * that gate account-only features on it.
 */
export function useIsGuest(): boolean {
  return false;
}
