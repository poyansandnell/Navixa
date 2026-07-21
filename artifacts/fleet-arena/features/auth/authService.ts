/**
 * Fleet Arena — authentication service.
 *
 * Thin wrappers around the Supabase JS client (anon key only, see
 * lib/supabase.ts) for every auth flow the app needs: email/password sign up
 * and login, magic link, password reset, anonymous ("guest") sessions and
 * guest upgrade, profile bootstrapping, account export and deletion.
 *
 * All privileged / destructive operations (delete account, data export) run
 * through Edge Functions with the service_role key — never on the client.
 */
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/** Deep link used for magic-link / password-reset redirects. */
export const AUTH_REDIRECT_URL = 'fleetarena://auth/callback';

export interface EmailCredentials {
  email: string;
  password: string;
}

/** Metadata written to auth.users.raw_user_meta_data during onboarding. */
export interface ProfileBootstrap {
  username: string;
  displayName?: string;
  ageConfirmed: boolean;
  termsAcceptedAt: string;
  locale?: string;
}

// ---------------------------------------------------------------------------
// Email + password
// ---------------------------------------------------------------------------

/**
 * Create a new account with email + password. The on_auth_user_created trigger
 * seeds a profile + user_settings row automatically; profile metadata (username
 * etc.) is passed through so the trigger can use it.
 */
export async function signUpWithEmail(
  credentials: EmailCredentials,
  bootstrap?: ProfileBootstrap,
) {
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: AUTH_REDIRECT_URL,
      data: bootstrap
        ? {
            username: bootstrap.username,
            display_name: bootstrap.displayName ?? bootstrap.username,
            age_confirmed: bootstrap.ageConfirmed,
            terms_accepted_at: bootstrap.termsAcceptedAt,
            locale: bootstrap.locale ?? 'en',
          }
        : undefined,
    },
  });
  if (error) throw error;
  return data;
}

/** Sign in with email + password. */
export async function signInWithEmail(credentials: EmailCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw error;
  return data;
}

/** Send a passwordless magic link to the given email. */
export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: AUTH_REDIRECT_URL },
  });
  if (error) throw error;
}

/** Send a password reset email. */
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: AUTH_REDIRECT_URL,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Guest (anonymous) sessions
// ---------------------------------------------------------------------------

/** Start an anonymous session. Guests get an `is_anonymous` session. */
export async function signInAsGuest() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data;
}

/**
 * Upgrade the current anonymous session into a permanent email/password
 * account. This attaches an email + password to the existing user id, so the
 * guest keeps their profile, ratings and match history.
 */
export async function upgradeGuestWithEmail(
  credentials: EmailCredentials,
  bootstrap?: ProfileBootstrap,
) {
  const { data, error } = await supabase.auth.updateUser({
    email: credentials.email,
    password: credentials.password,
    data: bootstrap
      ? {
          username: bootstrap.username,
          display_name: bootstrap.displayName ?? bootstrap.username,
          age_confirmed: bootstrap.ageConfirmed,
          terms_accepted_at: bootstrap.termsAcceptedAt,
        }
      : undefined,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function isGuestSession(user: User | null | undefined): boolean {
  if (!user) return false;
  // Supabase flags anonymous users via is_anonymous on the user object.
  return Boolean((user as User & { is_anonymous?: boolean }).is_anonymous);
}

/** Sign out of the current session. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Profile bootstrapping
// ---------------------------------------------------------------------------

/**
 * Check whether a username is available. Usernames are stored as a unique
 * citext on public.profiles (case-insensitive) among non-deleted rows.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const trimmed = username.trim();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', trimmed)
    .is('deleted_at', null)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) === 0;
}

/**
 * Persist the chosen username / display name onto the current user's profile
 * row. The profiles_update_self RLS policy allows the owner to update.
 * Terms acceptance + age confirmation are stored in auth user metadata (the
 * fixed schema has no dedicated column) and locally.
 */
export async function completeProfileBootstrap(bootstrap: ProfileBootstrap) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('No authenticated user');

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      username: bootstrap.username.trim(),
      display_name: (bootstrap.displayName ?? bootstrap.username).trim(),
      locale: bootstrap.locale ?? 'en',
    })
    .eq('id', user.id);
  if (profileError) throw profileError;

  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      age_confirmed: bootstrap.ageConfirmed,
      terms_accepted_at: bootstrap.termsAcceptedAt,
    },
  });
  if (metaError) throw metaError;
}

// ---------------------------------------------------------------------------
// Account management (Edge Functions — service_role only)
// ---------------------------------------------------------------------------

/** Request a full export of the current user's data. */
export async function exportUserData(): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('export-user-data', {
    method: 'POST',
  });
  if (error) throw error;
  return data;
}

/** Permanently delete the current user's account. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;
  // Clear the local session after the server-side deletion.
  await supabase.auth.signOut();
}
