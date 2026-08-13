/** Shared client-side validators for the auth forms. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Usernames: 3–24 chars after normalisation; Unicode letters (å/ä/ö, é, …),
// digits, underscore and single internal spaces. Mirrors the server rules in
// artifacts/api-server/src/lib/username.ts.
const USERNAME_RE = /^[\p{L}\p{M}\p{N}_]+(?: [\p{L}\p{M}\p{N}_]+)*$/u;

/** NFC-normalise, trim, and collapse whitespace — same as the server. */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function isValidUsername(username: string): boolean {
  const normalized = normalizeUsername(username);
  return (
    normalized.length >= 3 &&
    normalized.length <= 24 &&
    USERNAME_RE.test(normalized)
  );
}
