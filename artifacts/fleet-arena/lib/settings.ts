/**
 * Settings domain helpers.
 *
 * Thin, UI-agnostic layer on top of the zustand settings store. Components
 * should read raw preferences via `useSettingsStore`, but shared logic that
 * derives behaviour from those preferences lives here so it stays consistent.
 */
import { useSettingsStore, type SettingsState } from '@/store/settings';

/** Whether decorative animations should actually run. */
export function shouldAnimate(state: SettingsState): boolean {
  return state.animations && !state.reducedMotion;
}

/** Hook: whether decorative animations should actually run. */
export function useShouldAnimate(): boolean {
  return useSettingsStore(shouldAnimate);
}

/** Hook: whether haptic feedback should fire. */
export function useHapticsEnabled(): boolean {
  return useSettingsStore((state) => state.haptics);
}

/** Hook: whether sound effects should play. */
export function useSoundEnabled(): boolean {
  return useSettingsStore((state) => state.sound);
}

/** Hook: whether the player must confirm each shot before firing. */
export function useConfirmShot(): boolean {
  return useSettingsStore((state) => state.confirmShot);
}

/** Hook: whether colorblind-friendly markers should be used. */
export function useColorblindMode(): boolean {
  return useSettingsStore((state) => state.colorblindMode);
}
