/**
 * Navixa — server→app shape normalisers.
 *
 * The api-server returns Drizzle rows in camelCase (e.g. `displayName`,
 * `avatarUrl`, `isBot`). Much of the app UI still consumes the historical
 * snake_case shapes (`display_name`, `avatar_url`, `is_bot`). Rather than churn
 * every consumer, we normalise server payloads back into those shapes at the
 * data-access boundary.
 */
import type { ProfileRow } from '@/features/social/api';

/** Raw profile as returned by the server (camelCase drizzle row). */
export interface ServerProfile {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  countryCode?: string | null;
  xp?: number | null;
  level?: number | null;
  lastSeenAt?: string | null;
  createdAt?: string;
  isBot?: boolean | null;
  isAdmin?: boolean | null;
}

/** Normalise a server profile into the app's snake_case ProfileRow. */
export function toProfileRow(p: ServerProfile | null | undefined): ProfileRow | null {
  if (!p) return null;
  return {
    id: p.id,
    username: p.username,
    display_name: p.displayName ?? null,
    avatar_url: p.avatarUrl ?? null,
    country_code: p.countryCode ?? null,
    xp: p.xp ?? 0,
    level: p.level ?? 1,
    last_seen_at: p.lastSeenAt ?? null,
    created_at: p.createdAt ?? new Date(0).toISOString(),
    is_bot: p.isBot ?? false,
  };
}
