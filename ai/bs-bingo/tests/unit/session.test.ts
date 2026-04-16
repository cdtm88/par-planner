import { describe, it, expect, beforeEach } from "vitest";
import { getOrCreatePlayer, setDisplayName } from "../../src/lib/session";

describe("getOrCreatePlayer", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns a non-empty playerId and empty displayName on first call", () => {
    const player = getOrCreatePlayer("ABC234");
    expect(player.playerId).toBeTruthy();
    expect(player.playerId.length).toBeGreaterThan(0);
    expect(player.displayName).toBe("");
  });

  it("returns the same playerId on a second call with the same code", () => {
    const first = getOrCreatePlayer("ABC234");
    const second = getOrCreatePlayer("ABC234");
    expect(second.playerId).toBe(first.playerId);
  });

  it("produces independent entries for different codes", () => {
    const p1 = getOrCreatePlayer("ABC234");
    const p2 = getOrCreatePlayer("OTHER1");
    expect(p1.playerId).not.toBe(p2.playerId);
  });
});

describe("setDisplayName", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("updates displayName while preserving playerId", () => {
    const original = getOrCreatePlayer("ABC234");
    setDisplayName("ABC234", "Alice");
    const updated = getOrCreatePlayer("ABC234");
    expect(updated.displayName).toBe("Alice");
    expect(updated.playerId).toBe(original.playerId);
  });

  it("does not affect other room entries", () => {
    getOrCreatePlayer("ABC234");
    getOrCreatePlayer("OTHER1");
    setDisplayName("ABC234", "Alice");
    const other = getOrCreatePlayer("OTHER1");
    expect(other.displayName).toBe("");
  });
});
