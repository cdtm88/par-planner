import { describe, it, expect, vi } from "vitest";
import { shuffle } from "../../src/lib/util/shuffle";

describe("shuffle", () => {
  it("returns empty array for empty input", () => {
    expect(shuffle([])).toEqual([]);
  });

  it("returns single-element array unchanged", () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it("preserves multiset (all original elements retained)", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle([...input]);
    expect(out.slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("is statistically uniform over 1000 runs (each element hits each index ~200 times ±80)", () => {
    const N = 5;
    const RUNS = 1000;
    const counts: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let r = 0; r < RUNS; r++) {
      const arr = shuffle([0, 1, 2, 3, 4]);
      arr.forEach((v, idx) => { counts[v][idx]++; });
    }
    for (let v = 0; v < N; v++) {
      for (let idx = 0; idx < N; idx++) {
        expect(counts[v][idx]).toBeGreaterThan(120);
        expect(counts[v][idx]).toBeLessThan(280);
      }
    }
  });

  it("uses crypto.getRandomValues (not Math.random) — BOAR-02", () => {
    const spy = vi.spyOn(crypto, "getRandomValues");
    shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Fisher-Yates on N elements does N-1 random-index draws; rejection sampling may call more
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(9);
    spy.mockRestore();
  });
});
