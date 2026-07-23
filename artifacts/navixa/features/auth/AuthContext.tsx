/**
 * Navixa — authentication context (Clerk adapter).
 *
 * Wraps Clerk's `useUser` / `useAuth` and the app's own profile (fetched from
 * `GET /api/profile/me`) behind the historical AuthContext shape so consuming
 * components need minimal changes. Protected routing in app/_layout.tsx reads
 * `session` / `initializing` (and `hasProfile`) to decide between the
 * onboarding/auth stack and the (tabs) stack.
 *
 * Authentication is account-only: email/password or Google via Clerk. Guest /
 * anonymous sessions and magic-link sign-in are not supported.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/expo';

import { apiFetch, ApiError } from '@/lib/api';
import { toProfileRow, type ServerProfile } from '@/lib/normalize';
import type { ProfileRow } from '@/features/social/api';

/** Minimal user shape consumed by the app (Clerk user id). */
export interface AuthUser {
  id: string;
  email: string | null;
}

interface AuthContextValue {
  /** Truthy sentinel when signed in, null when signed out. */
  session: { userId: string } | null;
  /** Convenience accessor for the current user. */
  user: AuthUser | null;
  /** True while Clerk is loading or the profile is being restored. */
  initializing: boolean;
  /** The app profile from GET /api/profile/me, or null when not bootstrapped. */
  profile: ProfileRow | null;
  /** True once the profile has been fetched (created via bootstrap). */
  hasProfile: boolean;
  /** True while the profile fetch is in flight. */
  profileLoading: boolean;
  /** Re-fetch the profile (call after bootstrap / profile edits). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
  const { user: clerkUser } = useUser();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!isSignedIn) {
      setProfile(null);
      setProfileChecked(true);
      return;
    }
    setProfileLoading(true);
    try {
      const res = await apiFetch<{ profile: ServerProfile }>('/profile/me');
      setProfile(toProfileRow(res.profile));
    } catch (err) {
      // A NOT_FOUND means the profile has not been bootstrapped yet.
      if (err instanceof ApiError && (err.code === 'NOT_FOUND' || err.status === 404)) {
        setProfile(null);
      } else {
        console.warn('[auth] profile fetch failed', err);
      }
    } finally {
      setProfileLoading(false);
      setProfileChecked(true);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      void refreshProfile();
    } else {
      setProfile(null);
      setProfileChecked(true);
    }
  }, [isLoaded, isSignedIn, refreshProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const email =
      clerkUser?.primaryEmailAddress?.emailAddress ??
      clerkUser?.emailAddresses?.[0]?.emailAddress ??
      null;
    return {
      session: isSignedIn && userId ? { userId } : null,
      user: isSignedIn && userId ? { id: userId, email } : null,
      initializing: !isLoaded || (isSignedIn ? !profileChecked : false),
      profile,
      hasProfile: profile !== null,
      profileLoading,
      refreshProfile,
    };
  }, [isLoaded, isSignedIn, userId, clerkUser, profile, profileChecked, profileLoading, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
