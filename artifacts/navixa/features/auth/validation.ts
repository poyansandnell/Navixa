/** Shared client-side validators for the auth forms. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Usernames: 3–24 chars, letters / digits / underscore (mirrors the
// profiles_username_* DB constraints).
const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username.trim());
}
