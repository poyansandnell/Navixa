/**
 * Built-in preset avatars for Navixa.
 *
 * No image uploads: an avatar is a colored tile with a naval icon. The set of
 * ~12 presets is stable and referenced by id. A profile stores the chosen id
 * in `profiles.avatar_url` (we reuse that column with a `preset:<id>` scheme so
 * no schema change is needed). Rendering happens in <Avatar />.
 */
import type { Feather } from '@expo/vector-icons';

export interface AvatarPreset {
  id: string;
  /** Feather icon glyph name. */
  icon: keyof typeof Feather.glyphMap;
  /** Background color (hex). */
  bg: string;
  /** Foreground/icon color (hex). */
  fg: string;
}

/** 12 built-in presets — naval / martial iconography over saturated tiles. */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'anchor', icon: 'anchor', bg: '#1E4C8A', fg: '#DCEBFF' },
  { id: 'compass', icon: 'compass', bg: '#0E7C6B', fg: '#DFFcF4' },
  { id: 'crosshair', icon: 'crosshair', bg: '#B23A48', fg: '#FFE3E6' },
  { id: 'target', icon: 'target', bg: '#C05621', fg: '#FFEAD8' },
  { id: 'flag', icon: 'flag', bg: '#6B21A8', fg: '#F1E4FF' },
  { id: 'shield', icon: 'shield', bg: '#374151', fg: '#E5E7EB' },
  { id: 'zap', icon: 'zap', bg: '#B8860B', fg: '#FFF6D6' },
  { id: 'star', icon: 'star', bg: '#0D9488', fg: '#DFFcF4' },
  { id: 'award', icon: 'award', bg: '#9D174D', fg: '#FFE0EC' },
  { id: 'navigation', icon: 'navigation', bg: '#1D4ED8', fg: '#DCEBFF' },
  { id: 'wind', icon: 'wind', bg: '#0F766E', fg: '#DFFcF4' },
  { id: 'aperture', icon: 'aperture', bg: '#7C3AED', fg: '#F1E4FF' },
];

export const AVATAR_PREFIX = 'preset:';

/** Encode a preset id into the value stored in profiles.avatar_url. */
export function encodeAvatar(id: string): string {
  return `${AVATAR_PREFIX}${id}`;
}

/**
 * Resolve a stored avatar value / username into a concrete preset. Falls back
 * to a deterministic pick from the username so every player has a stable look
 * even before they pick one.
 */
export function resolveAvatar(
  avatarUrl: string | null | undefined,
  seed: string | null | undefined,
): AvatarPreset {
  if (avatarUrl && avatarUrl.startsWith(AVATAR_PREFIX)) {
    const id = avatarUrl.slice(AVATAR_PREFIX.length);
    const found = AVATAR_PRESETS.find((p) => p.id === id);
    if (found) return found;
  }
  return presetForSeed(seed ?? avatarUrl ?? '');
}

/** Deterministic preset from an arbitrary seed string. */
export function presetForSeed(seed: string): AvatarPreset {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PRESETS[hash % AVATAR_PRESETS.length];
}

/** First character used as an initial fallback (upper-cased). */
export function initialFor(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}
