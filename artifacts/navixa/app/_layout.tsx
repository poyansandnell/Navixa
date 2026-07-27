import React, { useEffect } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider, ClerkLoaded, useAuth as useClerkAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';

import '@/i18n';
import colors from '@/constants/colors';
import { useSettingsStore } from '@/store/settings';
import { AuthProvider, useAuth } from '@/features/auth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { setAuthTokenGetter } from '@/lib/api';
import { setSocketTokenGetter, disconnectSocket } from '@/lib/socket';
import { useNotificationDeepLink, usePendingJoinResume } from '@/features/onlineMatch';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

/**
 * Rendered instead of the app when the Clerk publishable key is missing
 * (e.g. an EAS build produced without the required env vars). A standalone
 * build must never hard-crash at startup over configuration — surface a
 * clear, user-friendly error instead.
 */
function MissingConfigScreen() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View style={missingConfigStyles.container}>
      <RNText style={missingConfigStyles.title}>Navixa</RNText>
      <RNText style={missingConfigStyles.body}>
        The app could not start because it is missing its sign-in
        configuration. Please update to the latest version, or contact support
        at https://sanka-skepp.replit.app/support if the problem persists.
      </RNText>
    </View>
  );
}

const missingConfigStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    padding: 32,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  body: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});

/**
 * Registers the Clerk session-token getter with the REST + Socket clients so
 * every authenticated request/handshake carries a fresh bearer token. Also
 * tears down the socket on sign-out.
 */
function TokenSync() {
  const { getToken, isSignedIn } = useClerkAuth();

  useEffect(() => {
    const getter = () => getToken();
    setAuthTokenGetter(getter);
    setSocketTokenGetter(getter);
    return () => {
      setAuthTokenGetter(null);
      setSocketTokenGetter(null);
    };
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) disconnectSocket();
  }, [isSignedIn]);

  return null;
}

/**
 * Protected routing. Waits for the Clerk session + profile + onboarding flag,
 * then redirects:
 *   - onboarding not completed        → /onboarding
 *   - no session                      → /(auth)/sign-in
 *   - session but no profile          → /(auth)/complete-profile
 *   - session + profile               → /(tabs)
 */
function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { session, initializing, hasProfile } = useAuth();
  const { loading: onboardingLoading, completed: onboardingCompleted } =
    useOnboarding();

  const ready = !initializing && !onboardingLoading;

  // Resume a match when the player taps a daily-match push (incl. cold start).
  useNotificationDeepLink(!!session && hasProfile);

  // Resume a private-match invite (deep/universal link) stashed while the user
  // was signed out, once they have authenticated.
  usePendingJoinResume(!!session && hasProfile);

  useEffect(() => {
    if (!ready) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';
    const inOnboarding = group === 'onboarding';
    const onCompleteProfile = inAuthGroup && segments[1] === 'complete-profile';
    // Public pages reachable without a session (e.g. the App Store reviewer's
    // support URL and legal documents served by the web build).
    const isPublicPage = group === 'support' || group === 'legal';

    if (isPublicPage) return;

    if (!onboardingCompleted) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (!session) {
      // Signed out: allow the auth stack + onboarding, otherwise redirect.
      if (!inAuthGroup && !inOnboarding) {
        router.replace('/(auth)/sign-in');
      }
      return;
    }

    // Signed in but no profile yet → force the profile bootstrap screen.
    if (!hasProfile) {
      if (!onCompleteProfile) router.replace('/(auth)/complete-profile');
      return;
    }

    // Signed in with a profile: keep users out of onboarding / auth stacks.
    if (inOnboarding || inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [ready, session, hasProfile, onboardingCompleted, segments, router]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }} />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const theme = useSettingsStore((state) => state.theme);
  const isDark = theme !== 'light';

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(
      isDark ? colors.dark.background : colors.light.background,
    );
  }, [isDark]);

  if (!fontsLoaded && !fontError) return null;

  if (!CLERK_PUBLISHABLE_KEY) {
    console.error(
      '[startup] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing — this build was ' +
        'produced without the required env vars. Rendering config-error screen ' +
        'instead of crashing.',
    );
    return <MissingConfigScreen />;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <AuthProvider>
                    <TokenSync />
                    <StatusBar style={isDark ? 'light' : 'dark'} />
                    <RootLayoutNav />
                  </AuthProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
