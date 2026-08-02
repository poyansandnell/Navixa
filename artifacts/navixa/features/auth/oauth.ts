/**
 * Navixa — social OAuth (Apple + Google) via Clerk SSO.
 *
 * Both providers use Clerk's `useSSO` flow, which opens a web auth session
 * (ASWebAuthenticationSession on iOS via expo-web-browser) and (on success)
 * creates a Clerk session we activate with `setActive`. This is a pure
 * JS/OAuth flow — no native ClerkKit/ClerkKitUI dependencies are introduced.
 *
 * Apple's "Hide My Email" works transparently: Clerk receives the private
 * relay address from Apple and the account behaves like any other.
 *
 * NOTE: In Expo Go the SSO redirect works via the Expo auth proxy; a standalone
 * build needs the app scheme registered as a Clerk redirect URL.
 */
import { useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';

/** Whether to render the social sign-in buttons. Apple + Google supported. */
export const SOCIAL_AUTH_ENABLED = true as boolean;

export type SocialProvider = 'apple' | 'google';

const STRATEGY: Record<SocialProvider, 'oauth_apple' | 'oauth_google'> = {
  apple: 'oauth_apple',
  google: 'oauth_google',
};

// Ensure any lingering web-auth sessions are dismissed on native.
WebBrowser.maybeCompleteAuthSession();

/**
 * Returns a `signInWithProvider(provider)` callback that runs Clerk's OAuth
 * SSO flow for the given provider. On success the created session is
 * activated and the root layout routes the user onward (to profile bootstrap
 * or the tabs).
 */
export function useSocialSignIn() {
  const { startSSOFlow } = useSSO();

  const signInWithProvider = useCallback(
    async (provider: SocialProvider) => {
      const redirectUrl = AuthSession.makeRedirectUri();
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: STRATEGY[provider],
        redirectUrl,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    },
    [startSSOFlow],
  );

  return { signInWithProvider };
}

/** Backwards-compatible Google-only hook (kept for existing call sites). */
export function useGoogleSignIn() {
  const { signInWithProvider } = useSocialSignIn();
  const signInWithGoogle = useCallback(
    () => signInWithProvider('google'),
    [signInWithProvider],
  );
  return { signInWithGoogle };
}
