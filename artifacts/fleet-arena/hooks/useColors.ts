import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';
import { useSettingsStore } from '@/store/settings';

export type ColorTokens = typeof colors.dark & { radius: number };

/**
 * Returns the design tokens for the resolved color scheme.
 *
 * Fleet Arena defaults to the dark palette. The resolved scheme is driven by
 * the user's theme preference in the settings store:
 *   - 'dark'   → always dark
 *   - 'light'  → always light
 *   - 'system' → follow the device appearance (falling back to dark)
 *
 * The returned object contains all color tokens for the active palette plus
 * scheme-independent values like `radius`.
 */
export function useColors(): ColorTokens {
  const deviceScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.theme);

  let resolved: 'dark' | 'light';
  if (themePreference === 'system') {
    resolved = deviceScheme === 'light' ? 'light' : 'dark';
  } else {
    resolved = themePreference;
  }

  const palette = resolved === 'light' ? colors.light : colors.dark;
  return { ...palette, radius: colors.radius };
}
