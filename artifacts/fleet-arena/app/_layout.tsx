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

import '@/i18n';
import colors from '@/constants/colors';
import { useSettingsStore } from '@/store/settings';
import { AuthProvider, useAuth } from '@/features/auth';
import { useOnboarding } from '@/hooks/useOnboarding';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Protected routing. Waits for the persisted session + onboarding flag, then
 * redirects:
 *   - onboarding not completed → /onboarding
 *   - no session               → /(auth)/sign-in
 *   - session present          → /(tabs)
 */
function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { session, initializing } = useAuth();
  const { loading: onboardingLoading, completed: onboardingCompleted } =
    useOnboarding();

  const ready = !initializing && !onboardingLoading;

  useEffect(() => {
    if (!ready) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';
    const inOnboarding = group === 'onboarding';

    if (!onboardingCompleted) {
      // Force onboarding first.
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

    // Signed in: keep users out of the onboarding stack. The auth stack is
    // left reachable so complete-profile / guest upgrade still work, and other
    // authenticated groups (e.g. game) are free to navigate.
    if (inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [ready, session, onboardingCompleted, segments, router]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
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
    // Keep the native window background in sync with the active theme so the
    // launch/splash transition matches the app surface (dark navy by default).
    SystemUI.setBackgroundColorAsync(
      isDark ? colors.dark.background : colors.light.background,
    );
  }, [isDark]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AuthProvider>
                <StatusBar style={isDark ? 'light' : 'dark'} />
                <RootLayoutNav />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
