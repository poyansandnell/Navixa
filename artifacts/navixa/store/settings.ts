import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { setLanguage, type SupportedLanguage } from '@/i18n';

export type ThemePreference = 'dark' | 'light' | 'system';
export type LanguagePreference = SupportedLanguage | 'system';

export interface SettingsState {
  /** UI language, or 'system' to follow the device locale. */
  language: LanguagePreference;
  /** Color theme. Navixa defaults to dark. */
  theme: ThemePreference;
  /** Sound effects enabled. */
  sound: boolean;
  /** Haptic feedback enabled. */
  haptics: boolean;
  /** UI/animation effects enabled. */
  animations: boolean;
  /** Reduce motion for accessibility. */
  reducedMotion: boolean;
  /** Colorblind-friendly palette/markers. */
  colorblindMode: boolean;
  /** Require confirmation before firing each shot. */
  confirmShot: boolean;
  /** Whether the persisted state has finished rehydrating. */
  hasHydrated: boolean;

  setLanguage: (language: LanguagePreference) => void;
  setTheme: (theme: ThemePreference) => void;
  setSound: (enabled: boolean) => void;
  setHaptics: (enabled: boolean) => void;
  setAnimations: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setColorblindMode: (enabled: boolean) => void;
  setConfirmShot: (enabled: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'system',
      theme: 'dark',
      sound: true,
      haptics: true,
      animations: true,
      reducedMotion: false,
      colorblindMode: false,
      confirmShot: true,
      hasHydrated: false,

      setLanguage: (language) => {
        setLanguage(language);
        set({ language });
      },
      setTheme: (theme) => set({ theme }),
      setSound: (sound) => set({ sound }),
      setHaptics: (haptics) => set({ haptics }),
      setAnimations: (animations) => set({ animations }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setColorblindMode: (colorblindMode) => set({ colorblindMode }),
      setConfirmShot: (confirmShot) => set({ confirmShot }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'navixa-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
        sound: state.sound,
        haptics: state.haptics,
        animations: state.animations,
        reducedMotion: state.reducedMotion,
        colorblindMode: state.colorblindMode,
        confirmShot: state.confirmShot,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply the persisted language to i18n once rehydrated.
        if (state) {
          setLanguage(state.language);
        }
        useSettingsStore.getState().setHasHydrated(true);
      },
    },
  ),
);
