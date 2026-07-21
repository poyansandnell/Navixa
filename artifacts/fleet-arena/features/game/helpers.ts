/**
 * Small runtime helpers for the local bot match UI: haptics (respecting the
 * settings toggle) and a hook that reports whether motion/animation should be
 * suppressed for accessibility.
 */
import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/store/settings';
import type { ShotResult } from '@/lib/engine';

/** Fire a haptic pulse appropriate to a shot result, if haptics are enabled. */
export function fireHaptic(result: ShotResult, hapticsEnabled: boolean): void {
  if (!hapticsEnabled) return;
  try {
    if (result === 'miss') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (result === 'hit') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    // Haptics may be unavailable (e.g. web) — ignore.
  }
}

/** Light selection haptic for taps (e.g. selecting a target cell). */
export function selectionHaptic(hapticsEnabled: boolean): void {
  if (!hapticsEnabled) return;
  try {
    void Haptics.selectionAsync();
  } catch {
    // ignore
  }
}

/**
 * Returns whether animations should actually run. Animations are gated by BOTH
 * the `animations` setting and (inverted) the `reducedMotion` accessibility
 * setting.
 */
export function useAnimationsEnabled(): boolean {
  const animations = useSettingsStore((s) => s.animations);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  return animations && !reducedMotion;
}
