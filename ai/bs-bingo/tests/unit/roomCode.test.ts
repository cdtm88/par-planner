import { describe, it, expect } from "vitest";
import { makeRoomCode, normalizeCode, ROOM_CODE_ALPHABET } from "../../src/lib/util/roomCode";

describe("ROOM_CODE_ALPHABET", () => {
  it("is exactly ABCDEFGHJKMNPQRSTUVWXYZ23456789", () => {
    expect(ROOM_CODE_ALPHABET).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23456789");
  });

  it("does not contain ambiguous characters 0, O, 1, I, L", () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
});

describe("makeRoomCode", () => {
  it("returns a 6-character string", () => {
    for (let i = 0; i < 20; i++) {
      expect(makeRoomCode()).toHaveLength(6);
    }
  });

  it("only uses characters from ROOM_CODE_ALPHABET (1000 samples)", () => {
    const alphabetSet = new Set(ROOM_CODE_ALPHABET.split(""));
    const ambiguous = new Set(["0", "O", "1", "I", "L"]);
    for (let i = 0; i < 1000; i++) {
      const code = makeRoomCode();
      expect(code).toHaveLength(6);
      for (const char of code) {
        expect(alphabetSet.has(char), `Char '${char}' not in alphabet`).toBe(true);
        expect(ambiguous.has(char), `Ambiguous char '${char}' found`).toBe(false);
      }
    }
  });
});

describe("normalizeCode", () => {
  it("strips ambiguous chars and non-alphabet chars, uppercases — implementation per PATTERNS.md", () => {
    // "ab c-0o1-iL-23" → toUpperCase → "AB C-0O1-IL-23"
    // strip non-alphabet: space, -, 0, O, 1, I, L → remaining: A, B, C (wait C not present), 2, 3
    // Actually: "AB C-0O1-IL-23" → strip [ -0O1IL-] → "AB" + "23" = "AB23"
    // (C comes from 'c' which uppercases to 'C', but 'c' is not in the input — 'ab c' has a,b,space,c)
    // 'c' → 'C' which IS in the alphabet → kept
    // Result: "ABC23"
    expect(normalizeCode("ab c-0o1-iL-23")).toBe("ABC23");
  });

  it("passes through valid 6-char code uppercase", () => {
    // All 6 chars are in the alphabet
    expect(normalizeCode("abcdef")).toBe("ABCDEF");
  });

  it("removes all ambiguous characters (0, O, 1, I, L)", () => {
    expect(normalizeCode("0O1IL")).toBe("");
  });

  it("handles mixed valid/invalid chars", () => {
    expect(normalizeCode("A2B3C4")).toBe("A2B3C4");
    expect(normalizeCode("a2b3c4")).toBe("A2B3C4");
  });

  it("strips hyphens and spaces", () => {
    expect(normalizeCode("AB-CD EF")).toBe("ABCDEF");
  });
});
