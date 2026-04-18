---
phase: 04-win-detection-announcement-play-again
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - party/game-room.ts
  - src/lib/components/EndScreen.svelte
  - src/lib/components/WinLineIcon.svelte
  - src/lib/util/winLine.ts
  - src/lib/stores/room.svelte.ts
  - src/lib/protocol/messages.ts
  - src/routes/room/[code]/+page.svelte
  - src/app.css
  - e2e/win-and-reset.spec.ts
  - tests/unit/EndScreen.test.ts
  - tests/unit/WinLineIcon.test.ts
  - tests/unit/winLine.test.ts
  - tests/unit/room-store.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 4 is well-structured. Win detection is server-authoritative and correctly serialized by the Durable Object actor model — no true race conditions exist. The `detectWin` logic is correct for all line types (rows, cols, diagonals) including the blank-cell free-space rule. The protocol schema correctly separates `ClientMessage` and `ServerMessage` unions — `winDeclared` cannot be sent by a client. The confetti dynamic import is guarded correctly with a `.catch()`. No XSS or injection vectors found.

Three warnings follow: an all-blank-board edge case that triggers an immediate win before any mark, an `aria-live` placement that misses the non-winner heading, and a missing `winningWords` prop in the `+page.svelte` `RoomStore` interface that silently falls back to `[]`. Four info items cover minor style and defensive-coding opportunities.

## Warnings

### WR-01: All-blank board triggers instant win on game start

**File:** `src/lib/util/winLine.ts:24` (and `party/game-room.ts:332`)

**Issue:** `detectWin` treats every blank cell as pre-satisfied. If the board generator produces a row, column, or diagonal composed entirely of blank cells (theoretically possible on a 3×3 board with 5 words — which places 5 word cells and 4 blanks), `detectWin` will return a win result immediately when the first `markWord` call is processed, even if the marking player did not mark anything on that line. More precisely: for a 3×3 board the 4 blank cells are distributed uniformly at random across all 9 positions. The probability that all 3 cells in a line are blank is nonzero (e.g., all-blank diagonal: 4!/(9 choose 3) paths exist). When this happens, the first `markWord` from any player triggers an instant win announcement before they have consciously completed a line.

**Fix:** Add a guard in `detectWin` that requires at least one non-blank, marked cell on a winning line before declaring a win. An all-blank line winning with zero deliberate marks is nonsensical UX.

```typescript
// In detectWin, replace the return block for each line check:
const nonBlanks = indices.filter((i) => !cells[i].blank);
if (nonBlanks.length === 0) continue; // skip lines that are entirely blank
// ... existing every(isSatisfied) check remains unchanged
return {
  winningLine: ...,
  winningCellIds: nonBlanks.map((i) => cells[i].cellId),
};
```

---

### WR-02: `aria-live` omitted from non-winner heading — screen readers miss the win announcement

**File:** `src/lib/components/EndScreen.svelte:44-47`

**Issue:** The winner's `<h1>` has `aria-live="polite"` (line 36), but the non-winner's `<h1>` (`{winner.displayName} got Bingo!`) does not. When a non-winner receives the `winDeclared` broadcast and the EndScreen mounts, the non-winner heading is inserted into the DOM but there is no live region to announce it to screen reader users. They will hear nothing unless they manually navigate to the heading.

**Fix:**
```svelte
<h1
  class="text-[24px] font-semibold text-[var(--color-ink-primary)]"
  aria-live="polite"
>
  {winner.displayName} got Bingo!
</h1>
```

---

### WR-03: `winningWords` missing from `RoomStore` interface in `+page.svelte` — silently passes `[]` to EndScreen

**File:** `src/routes/room/[code]/+page.svelte:35-52`

**Issue:** The `RoomStore` interface declared on lines 35–52 does not include a `winningWords` property. The `EndScreen` component receives `winningWords={store.winningWords}` on line 191, but because the interface omits `winningWords`, TypeScript resolves `store.winningWords` as `any` (structural typing against the actual store object rather than the interface). This means any future refactor that renames or removes `winningWords` from the store will not be caught by the TypeScript compiler at the call site.

**Fix:** Add `winningWords: string[];` to the `RoomStore` interface:

```typescript
interface RoomStore {
  // ... existing fields ...
  winningCellIds: string[];
  winningWords: string[];   // add this line
  startNewGame(): void;
}
```

---

## Info

### IN-01: `detectWin` grid size inference silently treats any non-25/non-16 board as 3×3

**File:** `src/lib/util/winLine.ts:25`

**Issue:** `const n = cells.length === 25 ? 5 : cells.length === 16 ? 4 : 3;` — a malformed board (e.g., 8 cells due to a serialization bug) is silently treated as a 3×3 grid and will access out-of-bounds indices. The function does not validate that `cells.length` is 9, 16, or 25. In production this is unlikely because board construction is controlled, but a defensive early return would make failures explicit.

**Fix:** Add an assertion at the top of `detectWin`:
```typescript
if (cells.length !== 9 && cells.length !== 16 && cells.length !== 25) {
  return null; // malformed board — do not attempt win detection
}
```

---

### IN-02: `WinningLine` schema has no `maxValue` on `index` — allows out-of-range indices

**File:** `src/lib/protocol/messages.ts:32-35`

**Issue:** `index: v.pipe(v.number(), v.integer(), v.minValue(0))` accepts any non-negative integer. A client-supplied `winDeclared` message is server-generated, so this is not an attack surface, but `winLineCellIndices` called with a row index of 99 on a 3×3 grid will produce indices beyond the grid. If the client ever renders a `WinningLine` that arrived over an untrusted channel, the lack of an upper bound is a silent logic hazard.

**Fix:** Add `v.maxValue(4)` to cap the index at the maximum valid 5×5 index:
```typescript
index: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4)),
```

---

### IN-03: `gameReset` on the server does not reset `#words` — but does not reset `words` on the client store either; `winningWords` client state is reset but commented copy in code omits it

**File:** `party/game-room.ts:363-377`

**Issue:** The comment on line 364 says "Retain #players, #hostId, #words, #usedPacks" which is correct per spec. However, the server does NOT broadcast the retained word pool in the `gameReset` message. Late-joining players who reconnect after `gameReset` (before a new `startGame`) will receive a fresh `roomState` snapshot via `hello` which correctly includes the word pool. Players who were already connected receive only the `gameReset` event and rely on their already-populated `store.words` local state — this is correct. No bug, but worth a comment that word retention is implicit (client-side state survives the reset message).

**Fix:** Add a clarifying comment in the `gameReset` handler in `room.svelte.ts`:
```typescript
case "gameReset": {
  board = null;
  markedCellIds = new Set();
  playerMarks = {};
  winner = null;
  winningLine = null;
  winningCellIds = [];
  winningWords = [];
  // words, usedPacks, state.players, state.hostId intentionally NOT reset —
  // server retains them; connected clients already have them in local state.
  if (state) state = { ...state, phase: "lobby" };
  break;
}
```

---

### IN-04: E2E test assumes host's board always contains a winning row before timeout — fragile on slow CI

**File:** `e2e/win-and-reset.spec.ts:55-64`

**Issue:** The test clicks all `button` cells on the host's board in order, breaking when BINGO! appears. On a 3×3 board this requires completing a line among the 5 non-blank cells. The test relies on row 0 completing before any other line (or any line completing before the 1-second per-click timeout). On a randomly shuffled board and slow CI, the first row may have only 1–2 word cells (the rest blank), meaning no explicit row-0 strategy is guaranteed. The test can pass for the wrong reason (all-blank diagonal fires immediately per WR-01) or time out if the first non-blank cells happen to be spread across lines. This is also a flake risk once WR-01 is fixed.

**Fix:** Seed exactly 9 words (to fill a 3×3 board with no blanks), guaranteeing row 0 completes after 3 clicks. Alternatively, mark the first 3 non-blank cells and assert BINGO! within a generous timeout without relying on random layout.

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
