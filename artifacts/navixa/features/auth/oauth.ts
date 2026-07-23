/**
 * Navixa — social OAuth (Google) via Clerk SSO.
 *
 * Google Sign-In uses Clerk's `useSSO` flow, which opens a web auth session and
 * (on success) creates a Clerk session we activate with `setActive`. Apple
 * Sign-In is not wired up yet; `SOCIAL_AUTH_ENABLED` gates whether the social
 * buttons render at all.
 *
 * NOTE: In Expo Go the SSO redirect works via the Expo auth proxy; a standalone
 * build needs the app scheme registered as a Clerk redirect URL.
 */
import { useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';

/** Whether to render the social sign-in buttons. Google is supported. */
export const SOCIAL_AUTH_ENABLED = true as boolean;

export type SocialProvider = 'apple' | 'google';

// Ensure any lingering web-auth sessions are dismissed on native.
WebBrowser.maybeCompleteAuthSession();

/**
 * Returns a `signInWithGoogle` callback that runs Clerk's Google OAuth SSO
 * flow. On success the created session is activated and the root layout routes
 * the user onward (to profile bootstrap or the tabs).
 */
export function useGoogleSignIn() {
  const { startSSOFlow } = useSSO();

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl = AuthSession.makeRedirectUri();
    const { createdSessionId, setActive } = await startSSOFlow({
      strategy: 'oauth_google',
      redirectUrl,
    });
    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId });
    }
  }, [startSSOFlow]);

  return { signInWithGoogle };
}
