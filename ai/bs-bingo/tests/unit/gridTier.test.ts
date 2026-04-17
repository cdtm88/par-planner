import { describe, it, expect } from "vitest";
import { deriveGridTier, wordsNeededToStart, wordsToNextTier, TIER_THRESHOLDS } from "../../src/lib/util/gridTier";

describe("deriveGridTier", () => {
  it("returns 3x3 for 0 words", () => expect(deriveGridTier(0)).toBe("3x3"));
  it("returns 3x3 for 4 words", () => expect(deriveGridTier(4)).toBe("3x3"));
  it("returns 3x3 for 5 words", () => expect(deriveGridTier(5)).toBe("3x3"));
  it("returns 3x3 for 11 words", () => expect(deriveGridTier(11)).toBe("3x3"));
  it("returns 4x4 for 12 words", () => expect(deriveGridTier(12)).toBe("4x4"));
  it("returns 4x4 for 20 words", () => expect(deriveGridTier(20)).toBe("4x4"));
  it("returns 5x5 for 21 words", () => expect(deriveGridTier(21)).toBe("5x5"));
  it("returns 5x5 for 50 words", () => expect(deriveGridTier(50)).toBe("5x5"));
});

describe("wordsNeededToStart", () => {
  it("returns 5 for 0 words", () => expect(wordsNeededToStart(0)).toBe(5));
  it("returns 1 for 4 words", () => expect(wordsNeededToStart(4)).toBe(1));
  it("returns 0 for 5 words", () => expect(wordsNeededToStart(5)).toBe(0));
  it("returns 0 for 20 words", () => expect(wordsNeededToStart(20)).toBe(0));
});

describe("wordsToNextTier", () => {
  it("returns 5 for 0 words (need 5 for 3x3)", () => expect(wordsToNextTier(0)).toBe(5));
  it("returns 7 for 5 words (need 12 for 4x4)", () => expect(wordsToNextTier(5)).toBe(7));
  it("returns 1 for 11 words (need 12 for 4x4)", () => expect(wordsToNextTier(11)).toBe(1));
  it("returns 9 for 12 words (need 21 for 5x5)", () => expect(wordsToNextTier(12)).toBe(9));
  it("returns 0 for 21 words (at max tier)", () => expect(wordsToNextTier(21)).toBe(0));
  it("returns 0 for 50 words", () => expect(wordsToNextTier(50)).toBe(0));
});

describe("TIER_THRESHOLDS", () => {
  it("3x3 threshold is 5", () => expect(TIER_THRESHOLDS["3x3"]).toBe(5));
  it("4x4 threshold is 12", () => expect(TIER_THRESHOLDS["4x4"]).toBe(12));
  it("5x5 threshold is 21", () => expect(TIER_THRESHOLDS["5x5"]).toBe(21));
});
