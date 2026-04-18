import { describe, it, expect } from "vitest";
import type { BoardCell } from "../../src/lib/protocol/messages";
import {
  detectWin,
  formatWinLine,
  winLineCellIndices,
  type WinResult,
} from "../../src/lib/util/winLine";

/**
 * Build an N*N BoardCell array. `blanks` contains the 0-based row-major
 * indices that should be blank cells. All other cells are word cells with
 * cellId = `c{i}`.
 */
function makeCells(n: 3 | 4 | 5, blanks: number[] = [], wordPrefix = "w"): BoardCell[] {
  return Array.from({ length: n * n }, (_, i) => ({
    cellId: `c${i}`,
    wordId: blanks.includes(i) ? null : `${wordPrefix}${i}`,
    text: blanks.includes(i) ? null : `Word${i}`,
    blank: blanks.includes(i),
  }));
}

/** 0-based cellIds for a given row of an NxN board (row-major). */
function rowCellIds(n: number, r: number): string[] {
  return Array.from({ length: n }, (_, c) => `c${r * n + c}`);
}

/** 0-based cellIds for a given column of an NxN board (row-major). */
function colCellIds(n: number, c: number): string[] {
  return Array.from({ length: n }, (_, r) => `c${r * n + c}`);
}

describe("detectWin", () => {
  it("D1: returns first row when all cells on that row are marked (3x3, row 0)", () => {
    const cells = makeCells(3);
    const marks = new Set(rowCellIds(3, 0)); // c0, c1, c2
    const result = detectWin(cells, marks) as WinResult;
    expect(result).not.toBeNull();
    expect(result.winningLine).toEqual({ type: "row", index: 0 });
    expect(result.winningCellIds).toEqual(["c0", "c1", "c2"]);
  });

  it("D2: detects row completion on every row index for 3x3/4x4/5x5", () => {
    for (const n of [3, 4, 5] as const) {
      const cells = makeCells(n);
      for (let r = 0; r < n; r++) {
        const marks = new Set(rowCellIds(n, r));
        const result = detectWin(cells, marks);
        expect(result, `n=${n} r=${r}`).not.toBeNull();
        expect(result!.winningLine).toEqual({ type: "row", index: r });
        expect(result!.winningCellIds).toEqual(rowCellIds(n, r));
      }
    }
  });

  it("D3: detects column completion on every column index for 3x3/4x4/5x5", () => {
    for (const n of [3, 4, 5] as const) {
      // Use a column that is NOT row 0 to avoid row-wins preempting.
      // Specifically: mark only the column's cells, so no row ever completes
      // (rows won't have every cell marked unless marks include the full row).
      for (let c = 0; c < n; c++) {
        const cells = makeCells(n);
        const marks = new Set(colCellIds(n, c));
        const result = detectWin(cells, marks);
        expect(result, `n=${n} c=${c}`).not.toBeNull();
        expect(result!.winningLine).toEqual({ type: "col", index: c });
        expect(result!.winningCellIds).toEqual(colCellIds(n, c));
      }
    }
  });

  it("D4: main diagonal completion for every grid size (type=diagonal, index=0)", () => {
    for (const n of [3, 4, 5] as const) {
      const cells = makeCells(n);
      const diagCellIds = Array.from({ length: n }, (_, i) => `c${i * n + i}`);
      const marks = new Set(diagCellIds);
      const result = detectWin(cells, marks);
      expect(result, `n=${n}`).not.toBeNull();
      expect(result!.winningLine).toEqual({ type: "diagonal", index: 0 });
      expect(result!.winningCellIds).toEqual(diagCellIds);
    }
  });

  it("D5: anti-diagonal completion for every grid size (type=diagonal, index=1)", () => {
    for (const n of [3, 4, 5] as const) {
      const cells = makeCells(n);
      const antiCellIds = Array.from({ length: n }, (_, i) => `c${i * n + (n - 1 - i)}`);
      const marks = new Set(antiCellIds);
      const result = detectWin(cells, marks);
      expect(result, `n=${n}`).not.toBeNull();
      expect(result!.winningLine).toEqual({ type: "diagonal", index: 1 });
      expect(result!.winningCellIds).toEqual(antiCellIds);
    }
  });

  it("D6: blank cells are pre-satisfied — all-blank diagonal wins with empty marks", () => {
    // 3x3 board where the MAIN diagonal (c0, c4, c8) is all blank.
    // But we must guard against a row/col winning first — pick blanks such that
    // no row or col is entirely blank.
    const cells = makeCells(3, [0, 4, 8]);
    const result = detectWin(cells, new Set());
    expect(result).not.toBeNull();
    expect(result!.winningLine).toEqual({ type: "diagonal", index: 0 });
    // No word cellIds on the line (all 3 were blank) -> empty array.
    expect(result!.winningCellIds).toEqual([]);
  });

  it("D7: partial line (N-1 of N non-blank cells) returns null", () => {
    const cells = makeCells(3);
    // Mark 2 of 3 cells on row 0 only
    const marks = new Set(["c0", "c1"]);
    expect(detectWin(cells, marks)).toBeNull();
  });

  it("D8: no marks and no all-blank line returns null", () => {
    const cells = makeCells(3);
    expect(detectWin(cells, new Set())).toBeNull();
  });

  it("D9: order of enumeration — row is returned before col when both complete simultaneously", () => {
    // 3x3 where marking all cells except c6 leaves ONLY row 1 and col 1 completable,
    // but marking c0..c8 completes everything. We craft marks such that row 1 AND col 1
    // are BOTH complete, but row 0 is NOT complete, so the first match in (row->col)
    // order is row 1.
    const cells = makeCells(3);
    // Row 1 = c3,c4,c5 ; Col 1 = c1,c4,c7. Union = c1,c3,c4,c5,c7.
    const marks = new Set(["c1", "c3", "c4", "c5", "c7"]);
    const result = detectWin(cells, marks);
    expect(result).not.toBeNull();
    expect(result!.winningLine).toEqual({ type: "row", index: 1 });
    expect(result!.winningCellIds).toEqual(rowCellIds(3, 1));
  });

  it("D10: winningCellIds excludes blank cells on the completing line", () => {
    // 3x3 with c1 blank. Row 0 = c0, c1(blank), c2. Marks = c0, c2.
    const cells = makeCells(3, [1]);
    const marks = new Set(["c0", "c2"]);
    const result = detectWin(cells, marks);
    expect(result).not.toBeNull();
    expect(result!.winningLine).toEqual({ type: "row", index: 0 });
    expect(result!.winningCellIds).toEqual(["c0", "c2"]); // c1 omitted because blank
  });
});

describe("formatWinLine", () => {
  it("F1: row index 0 renders as 'Row 1'", () => {
    expect(formatWinLine({ type: "row", index: 0 })).toBe("Row 1");
  });
  it("F2: row index 4 renders as 'Row 5'", () => {
    expect(formatWinLine({ type: "row", index: 4 })).toBe("Row 5");
  });
  it("F3: col index 2 renders as 'Column 3'", () => {
    expect(formatWinLine({ type: "col", index: 2 })).toBe("Column 3");
  });
  it("F4: diagonal index 0 renders as 'Top-left diagonal'", () => {
    expect(formatWinLine({ type: "diagonal", index: 0 })).toBe("Top-left diagonal");
  });
  it("F5: diagonal index 1 renders as 'Top-right diagonal'", () => {
    expect(formatWinLine({ type: "diagonal", index: 1 })).toBe("Top-right diagonal");
  });
});

describe("winLineCellIndices", () => {
  it("I1: 3x3 row 0 → [0, 1, 2]", () => {
    expect(winLineCellIndices({ type: "row", index: 0 }, 3)).toEqual([0, 1, 2]);
  });
  it("I2: 3x3 row 2 → [6, 7, 8]", () => {
    expect(winLineCellIndices({ type: "row", index: 2 }, 3)).toEqual([6, 7, 8]);
  });
  it("I3: 3x3 col 0 → [0, 3, 6]", () => {
    expect(winLineCellIndices({ type: "col", index: 0 }, 3)).toEqual([0, 3, 6]);
  });
  it("I4: 4x4 col 1 → [1, 5, 9, 13]", () => {
    expect(winLineCellIndices({ type: "col", index: 1 }, 4)).toEqual([1, 5, 9, 13]);
  });
  it("I5: 3x3 main diagonal (index 0) → [0, 4, 8]", () => {
    expect(winLineCellIndices({ type: "diagonal", index: 0 }, 3)).toEqual([0, 4, 8]);
  });
  it("I6: 3x3 anti-diagonal (index 1) → [2, 4, 6]", () => {
    expect(winLineCellIndices({ type: "diagonal", index: 1 }, 3)).toEqual([2, 4, 6]);
  });
  it("I7: 5x5 main diagonal → [0, 6, 12, 18, 24]", () => {
    expect(winLineCellIndices({ type: "diagonal", index: 0 }, 5)).toEqual([0, 6, 12, 18, 24]);
  });
  it("I8: 5x5 anti-diagonal → [4, 8, 12, 16, 20]", () => {
    expect(winLineCellIndices({ type: "diagonal", index: 1 }, 5)).toEqual([4, 8, 12, 16, 20]);
  });
});
