import { describe, expect, it } from "vitest";
import {
  normalizeUsername,
  usernameKey,
  usernameProblem,
} from "./username";

describe("normalizeUsername", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeUsername("  Åsa   Lind  ")).toBe("Åsa Lind");
    expect(normalizeUsername("Poyan\tSandnell")).toBe("Poyan Sandnell");
  });

  it("NFC-normalises Unicode (NFD Å == NFC Å)", () => {
    const nfd = "A\u030asa Lind"; // "Åsa Lind" with combining ring
    const nfc = "\u00c5sa Lind";
    expect(normalizeUsername(nfd)).toBe(normalizeUsername(nfc));
  });
});

describe("usernameKey (uniqueness)", () => {
  it("is case-insensitive", () => {
    expect(usernameKey("Poyan Sandnell")).toBe(usernameKey("poyan sandnell"));
    expect(usernameKey("Åsa Lind")).toBe(usernameKey("åsa lind"));
  });

  it("treats NFD/NFC and extra-space variants as the same name", () => {
    expect(usernameKey("A\u030asa  Lind")).toBe(usernameKey("Åsa Lind"));
  });
});

describe("usernameProblem (validation)", () => {
  const ok = (s: string) => usernameProblem(normalizeUsername(s));

  it("accepts spaces, Swedish and international letters", () => {
    for (const name of [
      "Poyan Sandnell",
      "Åsa Lind",
      "Björn Öberg",
      "Måns",
      "José García",
      "user_42",
    ]) {
      expect(ok(name)).toBeNull();
    }
  });

  it("rejects bad lengths and characters", () => {
    expect(ok("ab")).not.toBeNull(); // too short
    expect(ok("a".repeat(25))).not.toBeNull(); // too long
    expect(ok("nisse!")).not.toBeNull(); // punctuation
    expect(ok("emoji😀name")).not.toBeNull(); // emoji
    expect(usernameProblem(" leading")).not.toBeNull(); // un-normalised input
  });
});
