/**
 * Username normalisation + validation shared by bootstrap and availability.
 *
 * Rules (mirrored client-side in artifacts/navixa/features/auth/validation.ts):
 * - Unicode letters (incl. å/ä/ö, é, marks), digits, underscore and single
 *   internal spaces are allowed. No leading/trailing spaces.
 * - NFC-normalised, whitespace-collapsed. Original casing/spelling is stored
 *   for display; uniqueness is checked case-insensitively (lower()).
 * - 3–24 characters after normalisation.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

// One "word" of letters/marks/digits/underscore, optionally more words
// separated by single spaces. Anchored — no leading/trailing space possible.
const USERNAME_RE =
  /^[\p{L}\p{M}\p{N}_]+(?: [\p{L}\p{M}\p{N}_]+)*$/u;

/** NFC-normalise, trim, and collapse runs of whitespace to single spaces. */
export function normalizeUsername(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Canonical uniqueness key: normalised + lowercased. */
export function usernameKey(raw: string): string {
  return normalizeUsername(raw).toLowerCase();
}

/** Validate an already-normalised username. Returns null when OK. */
export function usernameProblem(normalized: string): string | null {
  if (normalized.length < USERNAME_MIN || normalized.length > USERNAME_MAX) {
    return `${USERNAME_MIN}-${USERNAME_MAX} characters`;
  }
  if (!USERNAME_RE.test(normalized)) {
    return "Letters, digits, underscore and single spaces only";
  }
  return null;
}
