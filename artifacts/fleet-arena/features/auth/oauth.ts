/**
 * Fleet Arena — social OAuth (Apple / Google) stubs.
 *
 * ⚠️ NATIVE OAUTH IS NOT WIRED UP YET.
 *
 * Native Apple / Google Sign-In requires:
 *   1. A custom Expo *development build* (not Expo Go) with the relevant native
 *      modules (e.g. expo-apple-authentication / @react-native-google-signin).
 *   2. Provider configuration in the Supabase dashboard (Apple Services ID +
 *      key, Google OAuth client IDs) and the matching redirect URLs.
 *   3. app.json entitlements / URL schemes (Apple capability, Google reversed
 *      client id) — these need native config we don't ship here.
 *
 * Until that infrastructure exists these providers are hidden behind
 * SOCIAL_AUTH_ENABLED (false). The UI renders the buttons only when the flag is
 * on; the handlers below intentionally throw so nobody ships a half-working
 * flow. When enabling, replace the throws with the real native token exchange
 * that calls supabase.auth.signInWithIdToken({ provider, token }).
 */

/**
 * Master feature flag for social sign-in. Keep FALSE until a development build
 * with the native modules + Supabase provider config is available.
 */
export const SOCIAL_AUTH_ENABLED = false as boolean;

export type SocialProvider = 'apple' | 'google';

/**
 * TODO(social-auth): Implement Apple Sign-In.
 * Requires expo-apple-authentication in a dev build + Apple provider configured
 * in Supabase. Flow:
 *   const credential = await AppleAuthentication.signInAsync({ ... });
 *   await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
 */
export async function signInWithApple(): Promise<never> {
  throw new Error(
    'Apple Sign-In requires a development build and Supabase Apple provider config.',
  );
}

/**
 * TODO(social-auth): Implement Google Sign-In.
 * Requires @react-native-google-signin/google-signin in a dev build + Google
 * provider configured in Supabase. Flow:
 *   const { idToken } = await GoogleSignin.signIn();
 *   await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
 */
export async function signInWithGoogle(): Promise<never> {
  throw new Error(
    'Google Sign-In requires a development build and Supabase Google provider config.',
  );
}
