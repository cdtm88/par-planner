import { describe, it, expect } from "vitest";
import { getPlayerColor } from "../../src/lib/util/playerColor";

const EXPECTED_PALETTE = [
  "#7DD3FC", "#FCA5A5", "#86EFAC", "#FDE68A",
  "#C4B5FD", "#F9A8D4", "#A5B4FC", "#FDBA74"
];

describe("getPlayerColor", () => {
  it("returns the same color for the same playerId (deterministic)", () => {
    const id = "player-abc-123";
    expect(getPlayerColor(id)).toBe(getPlayerColor(id));
  });

  it("returns a value from the 8-color palette", () => {
    const testIds = ["p1", "p2", "abc123", "xyz-999", "nanoid-21chars-here!!", "short"];
    for (const id of testIds) {
      const color = getPlayerColor(id);
      expect(EXPECTED_PALETTE).toContain(color);
    }
  });

  it("is deterministic across multiple calls", () => {
    const id = "consistent-player-id";
    const first = getPlayerColor(id);
    for (let i = 0; i < 10; i++) {
      expect(getPlayerColor(id)).toBe(first);
    }
  });

  it("produces varied colors across different IDs", () => {
    // Not all IDs should map to the same color
    const ids = Array.from({ length: 50 }, (_, i) => `player-${i}`);
    const colors = new Set(ids.map(getPlayerColor));
    // With 50 IDs and 8 colors, we expect more than 1 unique color
    expect(colors.size).toBeGreaterThan(1);
  });
});
