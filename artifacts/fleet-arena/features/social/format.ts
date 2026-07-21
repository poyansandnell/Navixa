/**
 * Small pure formatting helpers shared across the social + history screens.
 */

/** Convert an ISO 3166-1 alpha-2 country code to a flag emoji. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🏳️';
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '🏳️';
  const A = 0x1f1e6;
  const first = A + (upper.charCodeAt(0) - 65);
  const second = A + (upper.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}

export interface Division {
  key: string;
  min: number;
}

/** Rating → division bands. Keys map to i18n social.divisions.*. */
export const DIVISIONS: Division[] = [
  { key: 'grandmaster', min: 2400 },
  { key: 'master', min: 2100 },
  { key: 'diamond', min: 1800 },
  { key: 'platinum', min: 1600 },
  { key: 'gold', min: 1400 },
  { key: 'silver', min: 1200 },
  { key: 'bronze', min: 0 },
];

export function divisionForRating(rating: number): Division {
  for (const d of DIVISIONS) {
    if (rating >= d.min) return d;
  }
  return DIVISIONS[DIVISIONS.length - 1];
}

/** Percentage from a 0..1 ratio (or already-percent number), rounded. */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  const pct = ratio <= 1 ? ratio * 100 : ratio;
  return `${Math.round(pct)}%`;
}

/** ms → "12m 34s" / "1h 05m" compact duration. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0 || Number.isNaN(ms)) return '—';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** XP → level (100 XP per level, matching a simple linear curve). */
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

/** Signed rating delta, e.g. "+18" / "-12" / "0". */
export function formatDelta(delta: number | null | undefined): string {
  if (delta == null || Number.isNaN(delta)) return '—';
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

/** Localized short date from an ISO timestamp. */
export function formatDate(iso: string | null | undefined, locale = 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** "Member since Mar 2024" style month/year. */
export function formatMonthYear(iso: string | null | undefined, locale = 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short' });
  } catch {
    return d.toISOString().slice(0, 7);
  }
}
