/**
 * Semantic design tokens for the Navixa mobile app.
 *
 * Navixa is a global, competitive naval strategy game — "Chess.com for
 * sea battles". The palette is a deep naval one: dark navy base, lighter
 * sea-blue surfaces, turquoise accents, a coral-orange primary action /
 * "hit" color, red reserved strictly for loss/destroyed states, and green
 * for ready/victory states.
 *
 * Dark is the DEFAULT theme; a light variant is provided for the "light"
 * user-interface-style preference. The token names mirror the web
 * convention (background/foreground/card/primary/etc.) so useColors()
 * keeps working unchanged.
 */

const colors = {
  // Dark theme is the default for Navixa.
  dark: {
    // Legacy aliases (kept for backward compatibility)
    text: '#E8F0F7',
    tint: '#2DD4BF',

    // Core surfaces — deep navy sea
    background: '#0A1628',
    foreground: '#E8F0F7',

    // Cards / elevated surfaces — lighter sea-blue
    card: '#132840',
    cardForeground: '#E8F0F7',

    // Primary action color (Play button, hit marker, active states) — coral-orange
    primary: '#FF6B4A',
    primaryForeground: '#0A1628',

    // Secondary / less-emphasis interactive surfaces — sea-blue
    secondary: '#1C3A5C',
    secondaryForeground: '#E8F0F7',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#1C3A5C',
    mutedForeground: '#8AA6C0',

    // Accent highlights (badges, selected items, focus rings) — turquoise
    accent: '#2DD4BF',
    accentForeground: '#0A1628',

    // Destructive / loss / destroyed states — red (loss only)
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    // Success / ready / victory states — green
    success: '#22C55E',
    successForeground: '#0A1628',

    // Warning / caution states — amber
    warning: '#FBBF24',
    warningForeground: '#0A1628',

    // Borders and input outlines
    border: '#20415F',
    input: '#20415F',
  },

  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#0A1628',
    tint: '#0E7C7B',

    // Core surfaces
    background: '#F2F7FB',
    foreground: '#0A1628',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#0A1628',

    // Primary action color (Play button, hit marker, active states)
    primary: '#F0562F',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E1EBF4',
    secondaryForeground: '#0A1628',

    // Muted / subdued elements
    muted: '#E1EBF4',
    mutedForeground: '#5A7186',

    // Accent highlights — turquoise
    accent: '#0E7C7B',
    accentForeground: '#FFFFFF',

    // Destructive / loss / destroyed states
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',

    // Success / ready / victory states
    success: '#16A34A',
    successForeground: '#FFFFFF',

    // Warning / caution states
    warning: '#D97706',
    warningForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#CEDBE8',
    input: '#CEDBE8',
  },

  // Border radius (in px). Applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;
