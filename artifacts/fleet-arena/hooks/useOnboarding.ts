import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const ONBOARDING_KEY = 'fleet-arena-onboarding-complete';

interface OnboardingState {
  /** True while the persisted flag is being read. */
  loading: boolean;
  /** Whether the user has finished the onboarding flow. */
  completed: boolean;
  /** Persist that onboarding has been completed. */
  complete: () => Promise<void>;
  /** Internal: hydrate from AsyncStorage (runs once). */
  hydrate: () => Promise<void>;
}

let hydrateStarted = false;

/**
 * Shared (module-level) onboarding flag so every consumer — including the
 * root layout's protected routing — sees updates immediately. A plain
 * per-component useState version caused the root layout to never learn the
 * flag flipped, leaving users stuck on /onboarding after guest sign-in.
 */
const useOnboardingStore = create<OnboardingState>((set) => ({
  loading: true,
  completed: false,
  complete: async () => {
    set({ completed: true });
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  },
  hydrate: async () => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_KEY);
      set({ completed: value === 'true', loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));

export function useOnboarding(): Pick<
  OnboardingState,
  'loading' | 'completed' | 'complete'
> {
  const { loading, completed, complete, hydrate } = useOnboardingStore();

  useEffect(() => {
    if (!hydrateStarted) {
      hydrateStarted = true;
      void hydrate();
    }
  }, [hydrate]);

  return { loading, completed, complete };
}
