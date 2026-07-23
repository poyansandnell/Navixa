import React, { useEffect } from 'react';
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
import { useNotificationDeepLink } from '@/features/onlineMatch';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

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

  useEffect(() => {
    if (!ready) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';
    const inOnboarding = group === 'onboarding';
    const onCompleteProfile = inAuthGroup && segments[1] === 'complete-profile';

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
