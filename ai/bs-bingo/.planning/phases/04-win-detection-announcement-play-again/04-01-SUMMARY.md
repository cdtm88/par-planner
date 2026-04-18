---
phase: 04-win-detection-announcement-play-again
plan: 01
subsystem: protocol-and-winline-foundation
tags: [phase-4, protocol, win-detection, pure-functions, css, foundation]
dependency-graph:
  requires:
    - src/lib/protocol/messages.ts (Phase 3 schemas — BoardCell, RoomState, ClientMessage, ServerMessage)
    - src/app.css (Phase 1 design tokens — #F5D547 accent)
  provides:
    - WinningLine object schema + type
    - RoomState.phase now accepts "ended"
    - ClientMessage.startNewGame variant
    - ServerMessage.winDeclared + gameReset variants
    - src/lib/util/winLine.ts (detectWin, formatWinLine, winLineCellIndices, WinResult)
    - CSS [data-win-line="true"] > button ring-pulse animation + reduced-motion fallback
  affects:
    - Downstream Phase 4 plans (DO handler, client store, EndScreen, WinLineIcon) import from these two files
tech-stack:
  added: []
  patterns:
    - Valibot v.variant append pattern for new message types
    - Pure-function utility module in src/lib/util/ (analog to shuffle.ts, gridTier.ts)
    - CSS global attribute selector for opt-in animation (no per-component style changes)
key-files:
  created:
    - ai/bs-bingo/src/lib/util/winLine.ts
    - ai/bs-bingo/tests/unit/winLine.test.ts
    - ai/bs-bingo/.planning/phases/04-win-detection-announcement-play-again/04-01-SUMMARY.md
  modified:
    - ai/bs-bingo/src/lib/protocol/messages.ts
    - ai/bs-bingo/src/app.css
    - ai/bs-bingo/tests/unit/protocol.test.ts
decisions:
  - Hard-coded #F5D547 in winLinePulse keyframes (A5) — CSS var resolution inside keyframes box-shadow is not universal
  - detectWin treats blank cells as pre-satisfied (D-06, A3 acknowledged edge case)
  - Enumeration order rows → cols → diag0 → diag1 ensures deterministic first-match return
  - winningCellIds excludes blank cellIds (blank has no visible cell to ring-glow)
metrics:
  duration: ~10 minutes
  completed: 2026-04-18T06:37:11Z
  tasks_completed: 3
  tests_added: 34 (11 protocol + 23 winLine)
  tests_passing: 234/234 (full suite)
requirements: [WIN-01, WIN-02, WIN-04, WIN-05]
---

# Phase 4 Plan 1: Protocol + Pure-Function Foundation Summary

Added Phase 4 protocol contracts (WinningLine, startNewGame, winDeclared, gameReset, RoomState.phase="ended"), created `src/lib/util/winLine.ts` with pure win-detection helpers, and appended a global `[data-win-line]` ring-pulse animation to `src/app.css` — giving downstream Wave 2 plans zero-ambiguity imports.

## What Was Built

### 1. Protocol extensions (`src/lib/protocol/messages.ts`)

**New exports:**

- `WinningLine` object schema + type:
  ```ts
  export const WinningLine = v.object({
    type: v.picklist(["row", "col", "diagonal"]),
    index: v.pipe(v.number(), v.integer(), v.minValue(0)),
  });
  ```
- `RoomState.phase` union now includes `v.literal("ended")` alongside `"lobby"` and `"playing"`.
- `ClientMessage` appended variant: `v.object({ type: v.literal("startNewGame") })` (zero payload; host-only guard enforced server-side in later plans).
- `ServerMessage` appended variants:
  - `winDeclared { winnerId, winnerName, winningLine: WinningLine, winningCellIds: string[] }` — winnerId/winnerName use `v.minLength(1)`.
  - `gameReset` (zero payload).

**Security (T-4-03):** `winDeclared` lives exclusively in the `ServerMessage` variant list. A client attempting to send `{ type: "winDeclared", ... }` is rejected by `v.safeParse(ClientMessage, ...)`. Test 11 in `tests/unit/protocol.test.ts` asserts this explicitly.

### 2. `src/lib/util/winLine.ts` — pure-function API

```ts
import type { BoardCell, WinningLine } from "$lib/protocol/messages";
export type { WinningLine };

export type WinResult = {
  winningLine: WinningLine;
  winningCellIds: string[];
};

export function detectWin(cells: BoardCell[], marks: Set<string>): WinResult | null;
export function formatWinLine(line: WinningLine): string;
export function winLineCellIndices(line: WinningLine, gridSize: 3 | 4 | 5): number[];
```

- **`detectWin`** iterates `N` rows → `N` cols → main diagonal (index 0) → anti-diagonal (index 1) and returns the first completed line. A line is complete when every cell is either `blank === true` OR has its `cellId` in `marks`. Grid size is inferred from `cells.length` (25→5, 16→4, otherwise 3). `winningCellIds` excludes blank cells from the result (they have no visible cell to highlight).
- **`formatWinLine`** renders 1-indexed `Row N` / `Column N` labels and `Top-left diagonal` / `Top-right diagonal` for diagonals.
- **`winLineCellIndices`** returns row-major 0-based cell indices for a given `(type, index, gridSize)` — consumed by `WinLineIcon.svelte` in later plans.

### 3. CSS ring-pulse animation (`src/app.css`)

Appended (no existing rules modified):

```css
@keyframes winLinePulse {
  0%, 100% { box-shadow: 0 0 0 2px #F5D547, 0 0 8px  #F5D547; }
  50%      { box-shadow: 0 0 0 2px #F5D547, 0 0 16px #F5D547; }
}

[data-win-line="true"] > button {
  animation: winLinePulse 1200ms ease-in-out infinite;
  border-radius: 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  [data-win-line="true"] > button {
    animation: none;
    box-shadow: 0 0 0 2px #F5D547, 0 0 12px #F5D547;
  }
}
```

**Downstream usage (for later plans):** Wrap `<BoardCell>` children with `<div data-win-line="true">` for cells whose `cellId ∈ winningCellIds`. No modifications to `BoardCell.svelte` are required. `#F5D547` is hard-coded (A5 — CSS var resolution inside keyframes box-shadow is not universally reliable).

## Tasks Completed

| # | Task                                                                   | TDD    | Commits                                |
|---|------------------------------------------------------------------------|--------|----------------------------------------|
| 1 | Extend protocol schemas (WinningLine + 3 variants + phase='ended')     | yes    | `c99811c` (RED) → `8e901ae` (GREEN)    |
| 2 | Create `src/lib/util/winLine.ts` with detectWin/formatWinLine/indices  | yes    | `a285f8a` (RED) → `97201a7` (GREEN)    |
| 3 | Append `@keyframes winLinePulse` + attribute rules to `src/app.css`    | no     | `bcfb279`                              |

## Verification

- `npm run test:unit -- tests/unit/protocol.test.ts` — 56/56 passing (11 new + 45 existing).
- `npm run test:unit -- tests/unit/winLine.test.ts` — 23/23 passing (D1–D10, F1–F5, I1–I8).
- Full unit suite: **234/234 passing** (no regressions across 14 test files).
- `npm run build` — exits 0; Tailwind Oxide accepts the new CSS rules.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria for each task met on first run.

## TDD Gate Compliance

Plan tasks 1 and 2 followed RED → GREEN cycles per `tdd="true"` flags:

- Task 1 RED commit: `c99811c` (`test(04-01): add failing tests for WinningLine ...`)
- Task 1 GREEN commit: `8e901ae` (`feat(04-01): add WinningLine, Phase 4 message variants ...`)
- Task 2 RED commit: `a285f8a` (`test(04-01): add failing tests for winLine pure functions ...`)
- Task 2 GREEN commit: `97201a7` (`feat(04-01): add winLine pure-function module ...`)

Task 3 was non-TDD (`tdd="true"` not set); the CSS addition is validated by `npm run build`.

No REFACTOR commits needed — initial GREEN implementations matched the reference implementation in 04-RESEARCH.md Pattern 1 verbatim; no cleanup required.

## Self-Check: PASSED

- `ai/bs-bingo/src/lib/protocol/messages.ts` — FOUND (modified, exports `WinningLine`, `v.literal("ended")`, `v.literal("startNewGame")`, `v.literal("winDeclared")`, `v.literal("gameReset")`)
- `ai/bs-bingo/src/lib/util/winLine.ts` — FOUND (new, exports `detectWin`, `formatWinLine`, `winLineCellIndices`, `WinResult`, and re-exports `WinningLine`)
- `ai/bs-bingo/src/app.css` — FOUND (modified, contains `@keyframes winLinePulse`, `[data-win-line="true"]` rules, reduced-motion fallback)
- `ai/bs-bingo/tests/unit/protocol.test.ts` — FOUND (modified, 56 tests passing)
- `ai/bs-bingo/tests/unit/winLine.test.ts` — FOUND (new, 23 tests passing)
- Commit `c99811c` — FOUND in git log
- Commit `8e901ae` — FOUND in git log
- Commit `a285f8a` — FOUND in git log
- Commit `97201a7` — FOUND in git log
- Commit `bcfb279` — FOUND in git log
