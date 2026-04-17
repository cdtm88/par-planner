// Pure functions — used by GridProgress component and unit tests (gridTier.test.ts)

export type GridTier = "3x3" | "4x4" | "5x5";

/** Tier thresholds per CONTEXT.md D-10 and REQUIREMENTS.md LOBB-05. */
export const TIER_THRESHOLDS: Record<GridTier, number> = {
  "3x3": 5,
  "4x4": 12,
  "5x5": 21,
};

export function deriveGridTier(wordCount: number): GridTier {
  if (wordCount >= 21) return "5x5";
  if (wordCount >= 12) return "4x4";
  return "3x3"; // covers 0–11; minimum to start is 5
}

/** Words still needed before the host can start. 0 = start enabled. */
export function wordsNeededToStart(wordCount: number): number {
  return Math.max(0, 5 - wordCount);
}

/** Words needed to advance to the next tier (or 0 if already at 5x5). */
export function wordsToNextTier(wordCount: number): number {
  if (wordCount >= 21) return 0;
  if (wordCount >= 12) return 21 - wordCount;
  if (wordCount >= 5) return 12 - wordCount;
  return 5 - wordCount;
}
