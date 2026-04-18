// src/lib/util/winLine.ts
// Pure-function win detection + label formatting + row-major cell indexing.
// Imported by party/game-room.ts (server win detection) and src/lib/components/
// EndScreen.svelte + WinLineIcon.svelte (client UI). Unit-testable without a
// Durable Object harness — Phase 4 RESEARCH.md Pattern 1.

import type { BoardCell, WinningLine } from "$lib/protocol/messages";

export type { WinningLine };

export type WinResult = {
  winningLine: WinningLine;
  winningCellIds: string[];
};

/**
 * Detect whether the given board + marks complete a line.
 * Returns the first completed line (rows → columns → diagonals, ascending
 * index) or null. A line is complete when every cell on it is either
 * `blank === true` OR has its `cellId` present in `marks`.
 *
 * Grid size is inferred from `cells.length`: 25 → 5, 16 → 4, otherwise 3.
 */
export function detectWin(cells: BoardCell[], marks: Set<string>): WinResult | null {
  const n = cells.length === 25 ? 5 : cells.length === 16 ? 4 : 3;

  const isSatisfied = (idx: number): boolean => {
    const cell = cells[idx];
    return cell.blank || marks.has(cell.cellId);
  };

  // Rows
  for (let r = 0; r < n; r++) {
    const indices = Array.from({ length: n }, (_, c) => r * n + c);
    if (indices.every(isSatisfied)) {
      return {
        winningLine: { type: "row", index: r },
        winningCellIds: indices.filter((i) => !cells[i].blank).map((i) => cells[i].cellId),
      };
    }
  }

  // Columns
  for (let c = 0; c < n; c++) {
    const indices = Array.from({ length: n }, (_, r) => r * n + c);
    if (indices.every(isSatisfied)) {
      return {
        winningLine: { type: "col", index: c },
        winningCellIds: indices.filter((i) => !cells[i].blank).map((i) => cells[i].cellId),
      };
    }
  }

  // Main diagonal (top-left → bottom-right)
  {
    const indices = Array.from({ length: n }, (_, i) => i * n + i);
    if (indices.every(isSatisfied)) {
      return {
        winningLine: { type: "diagonal", index: 0 },
        winningCellIds: indices.filter((i) => !cells[i].blank).map((i) => cells[i].cellId),
      };
    }
  }

  // Anti-diagonal (top-right → bottom-left)
  {
    const indices = Array.from({ length: n }, (_, i) => i * n + (n - 1 - i));
    if (indices.every(isSatisfied)) {
      return {
        winningLine: { type: "diagonal", index: 1 },
        winningCellIds: indices.filter((i) => !cells[i].blank).map((i) => cells[i].cellId),
      };
    }
  }

  return null;
}

/**
 * Human-readable win-line label. Rows and columns are 1-indexed in UI copy.
 * Diagonals render descriptively (top-left vs top-right), per CONTEXT D-05/D-06.
 */
export function formatWinLine(line: WinningLine): string {
  if (line.type === "row") return `Row ${line.index + 1}`;
  if (line.type === "col") return `Column ${line.index + 1}`;
  return line.index === 0 ? "Top-left diagonal" : "Top-right diagonal";
}

/**
 * Return the 0-based row-major cell indices for the cells on the given
 * winning line in a grid of `gridSize × gridSize`. Used by WinLineIcon to
 * decide which cells to highlight.
 */
export function winLineCellIndices(
  line: WinningLine,
  gridSize: 3 | 4 | 5
): number[] {
  const n = gridSize;
  if (line.type === "row") return Array.from({ length: n }, (_, c) => line.index * n + c);
  if (line.type === "col") return Array.from({ length: n }, (_, r) => r * n + line.index);
  if (line.index === 0) return Array.from({ length: n }, (_, i) => i * n + i);
  return Array.from({ length: n }, (_, i) => i * n + (n - 1 - i));
}
