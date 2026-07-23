/** Short, unambiguous, uppercase invite code (no 0/O/1/I) — ports gen_invite_code. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function genInviteCode(len = 6): string {
  let code = "";
  for (let i = 0; i < len; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
