/**
 * Shared helpers for returning profile rows to clients without leaking
 * server-private fields (currently `emailHash`, used only for contact-based
 * friend discovery). Prefer `publicProfileColumns` in `.select(...)` so the
 * private column never leaves the database; use `sanitizeProfile` for rows
 * fetched with `select()` (full row) or built elsewhere.
 */
import { profilesTable } from "@workspace/db";

/**
 * Column map for `db.select(publicProfileColumns).from(profilesTable)` — every
 * public profile column, excluding `emailHash`. Keep in sync with the schema.
 */
export const publicProfileColumns = {
  id: profilesTable.id,
  username: profilesTable.username,
  displayName: profilesTable.displayName,
  bio: profilesTable.bio,
  avatarUrl: profilesTable.avatarUrl,
  countryCode: profilesTable.countryCode,
  locale: profilesTable.locale,
  isAdmin: profilesTable.isAdmin,
  isBot: profilesTable.isBot,
  isVerified: profilesTable.isVerified,
  xp: profilesTable.xp,
  level: profilesTable.level,
  lastSeenAt: profilesTable.lastSeenAt,
  createdAt: profilesTable.createdAt,
  updatedAt: profilesTable.updatedAt,
  deletedAt: profilesTable.deletedAt,
} as const;

/** Strip server-private fields (email hash) from a profile before returning. */
export function sanitizeProfile<T extends { emailHash?: string | null }>(
  profile: T,
): Omit<T, "emailHash"> {
  const { emailHash: _omit, ...rest } = profile;
  void _omit;
  return rest;
}
