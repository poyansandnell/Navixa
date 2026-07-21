/**
 * Fleet Arena — authentication context.
 *
 * Owns the Supabase session lifecycle via supabase.auth.onAuthStateChange and
 * exposes it to the app. Protected routing in app/_layout.tsx reads `session`
 * and `initializing` to decide between the onboarding/auth stack and the
 * (tabs) stack.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { isGuestSession } from './authService';

interface AuthContextValue {
  /** Current Supabase session, or null when signed out. */
  session: Session | null;
  /** Convenience accessor for the current user. */
  user: User | null;
  /** True while the initial session is being restored. */
  initializing: boolean;
  /** True when the active session is an anonymous / guest session. */
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Restore any persisted session on mount.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
      })
      .finally(() => {
        if (mounted) setInitializing(false);
      });

    // Subscribe to all subsequent auth state changes (login, logout, token
    // refresh, guest upgrade, etc.).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      isGuest: isGuestSession(session?.user),
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
