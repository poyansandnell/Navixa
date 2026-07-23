/**
 * Navixa — authentication service (REST, non-hook helpers).
 *
 * Interactive auth flows (sign-in, sign-up, email verification, Google OAuth,
 * sign-out) run through Clerk hooks directly inside the auth screens — see
 * app/(auth)/*. This module only holds the non-hook, REST-backed helpers that
 * are safe to call from anywhere: username availability, profile bootstrap and
 * GDPR export / account deletion (both proxied to the api-server).
 */
import { apiFetch } from '@/lib/api';
import type { ServerProfile } from '@/lib/normalize';

/** Metadata collected during onboarding for the profile bootstrap call. */
export interface ProfileBootstrap {
  username: string;
  displayName?: string;
  ageConfirmed: boolean;
  termsAcceptedAt: string;
  locale?: string;
  /** Clerk primary email — lets the server set email_hash for contact matching. */
  email?: string | null;
}

/**
 * Check whether a username is available. Usernames are case-insensitive and
 * unique among non-deleted profiles. We reuse the search endpoint and look for
 * an exact (case-insensitive) match.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const trimmed = username.trim();
  if (!trimmed) return false;
  const res = await apiFetch<{ users: ServerProfile[] }>('/profile/search', {
    query: { q: trimmed, limit: 10 },
  });
  const lower = trimmed.toLowerCase();
  return !res.users.some((u) => u.username.toLowerCase() === lower);
}

/**
 * Create the caller's profile (JIT bootstrap) with the chosen username.
 * Idempotent server-side: a second call for an existing profile returns
 * `created: false`.
 */
export async function completeProfileBootstrap(bootstrap: ProfileBootstrap): Promise<void> {
  const email = bootstrap.email?.trim();
  await apiFetch('/profile/bootstrap', {
    method: 'POST',
    body: {
      username: bootstrap.username.trim(),
      displayName: (bootstrap.displayName ?? bootstrap.username).trim(),
      locale: bootstrap.locale ?? 'en',
      ...(email ? { email } : {}),
    },
  });
}

/** Request a full JSON export of the current user's data. */
export async function exportUserData(): Promise<unknown> {
  return apiFetch('/account/export');
}

/**
 * Permanently delete the current user's account (profile + Clerk user). After
 * the server deletes the Clerk user, the caller should sign out locally; the
 * screen invoking this handles Clerk sign-out.
 */
export async function deleteAccount(): Promise<void> {
  await apiFetch('/account/delete', { method: 'POST', body: { confirm: true } });
}
