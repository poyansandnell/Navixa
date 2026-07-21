/**
 * Scheme-independent design tokens for Fleet Arena: typography, spacing,
 * radii, shadows, icon sizes, and animation durations.
 *
 * Color tokens live in constants/colors.ts and are consumed via useColors().
 * These tokens are static across themes and can be imported directly.
 */
import { Platform } from 'react-native';

/** Font families loaded in app/_layout.tsx (Inter). */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/**
 * Typographic scale (in pt). Keeps display text within mobile-safe limits
 * (<= 64pt) per the Expo skill guidance.
 */
export const typography = {
  display: { fontFamily: fontFamily.bold, fontSize: 48, lineHeight: 52 },
  h1: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 38 },
  h2: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32 },
  h3: { fontFamily: fontFamily.semibold, fontSize: 22, lineHeight: 28 },
  title: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 20 },
  subhead: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
} as const;

/** Spacing scale (in px) on a 4pt grid. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Border radii (in px). `card`/`button` mirror colors.radius. */
export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
  full: 9999,
} as const;

/** Icon sizes (in px). */
export const iconSize = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
  xxl: 48,
} as const;

/** Animation durations (in ms). */
export const duration = {
  instant: 80,
  fast: 160,
  normal: 240,
  slow: 360,
  slowest: 600,
} as const;

/**
 * Elevation / shadow presets. Cross-platform: iOS uses shadow*, Android uses
 * elevation. Consumers spread these into a style object.
 */
export const shadows = {
  none: Platform.select({
    ios: {
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
    },
    default: { elevation: 0 },
  }),
  sm: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.18,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    default: { elevation: 2 },
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    default: { elevation: 6 },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.32,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
    default: { elevation: 12 },
  }),
} as const;
