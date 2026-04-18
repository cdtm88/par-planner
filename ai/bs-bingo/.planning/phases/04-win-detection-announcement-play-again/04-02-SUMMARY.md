---
phase: 04
plan: 02
subsystem: party-server
tags: [durable-object, win-detection, play-again, hibernation-safe, server-authoritative]
type: tdd
requires:
  - 04-01  # WinningLine / winDeclared / gameReset schemas; detectWin pure function
provides:
  - server-authoritative-win
  - play-again-reset
  - phase-ended-persistence
affects:
  - party/game-room.ts
  - tests/unit/game-room.test.ts
key-files:
  modified:
    - party/game-room.ts
    - tests/unit/game-room.test.ts
decisions:
  - "markWord appends win detection AFTER wordMarked broadcast and #persistMarks() so peers see the final badge count before the announcement and a mid-flow hibernation cannot desync storage from memory."
  - "winnerName resolves from server-side #players roster; falls back to 'Someone' when the player row was removed (race condition with onClose)."
  - "startNewGame is host-only (matches startGame authorization); pre-hello and non-host senders are silently dropped — no error broadcast (D-13)."
  - "On reset, only #boards / #marks / #phase are cleared and persisted. #players, #hostId, #words, #usedPacks are explicitly retained — verified by asserting zero storage.put calls for those keys (R9, R10)."
  - "Persist-then-broadcast ordering applied consistently: #persistBoards / #persistMarks / #persistPhase all fire before the gameReset broadcast (Pitfall 1/2)."
metrics:
  duration: "~45 min"
  completed: "2026-04-18"
  tests-added: 19
  tests-passing: 253
---

# Phase 4 Plan 2: Server-authoritative win detection + play-again reset — Summary

Extended the `GameRoom` Durable Object with server-authoritative win detection in the `markWord` handler and a host-only `startNewGame` reset case — both with full hibernation-safe persistence.

## What was built

### Task 1: Win detection in markWord handler

**`party/game-room.ts`**

- **Line 31** — Added `import { detectWin } from "../src/lib/util/winLine.js";`
- **Line 42** — `K_PHASE` comment widened to `"lobby" | "playing" | "ended"`.
- **Field declaration (class body)** — `#phase: "lobby" | "playing" | "ended" = "lobby";` (union widened from `"lobby" | "playing"`).
- **`onStart` rehydration** — `this.ctx.storage.get<"lobby" | "playing" | "ended">(K_PHASE)` (generic widened to match the field).
- **`markWord` handler (lines ~328–348)** — After the `wordMarked` broadcast and `#persistMarks()`, the handler now calls `detectWin(myBoard, myMarks)`. On a win:
  1. Sets `this.#phase = "ended"`
  2. Calls `this.#persistPhase()`
  3. Resolves `winnerName` from `this.#players.get(connState.playerId)?.displayName ?? "Someone"`
  4. Broadcasts `winDeclared` with `winnerId`, `winnerName`, `winningLine`, `winningCellIds`

Ordering preserved exactly as specified: **wordMarked first, winDeclared second** (Pitfall 1/2).

### Task 2: startNewGame handler

**`party/game-room.ts`** — New `case "startNewGame":` appended to the `onMessage` switch (after `markWord`, before the closing `}`):

```ts
case "startNewGame": {
  const connState = conn.state as { playerId?: string } | null;
  if (!connState?.playerId) return;                // pre-hello → drop
  if (connState.playerId !== this.#hostId) return; // non-host → drop
  this.#boards.clear();
  this.#marks.clear();
  this.#phase = "lobby";
  this.#persistBoards();
  this.#persistMarks();
  this.#persistPhase();
  this.broadcast(JSON.stringify({ type: "gameReset" }));
  return;
}
```

## Explicitly retained on reset (downstream review confirmation)

The `startNewGame` handler **does not touch** any of these fields, so the next round reuses the same roster and word pool:

| Field | Why retained |
|-------|--------------|
| `#players` | Roster stays — D-09: "same players keep playing". No `storage.put("players", …)` call fires (verified by R9). |
| `#hostId` | Host identity persists across rounds. No `storage.put("hostId", …)` call fires (verified by R9). |
| `#words` | Word pool is reused — R8 verifies a post-reset `startGame` yields a `boardAssigned`. No `storage.put("words", …)` call fires (verified by R10). |
| `#usedPacks` | Loaded starter packs stay loaded (no re-selection UI after reset). No `storage.put("usedPacks", …)` call fires (verified by R10). |

## Tests

**File:** `tests/unit/game-room.test.ts` — new describe block `GameRoom — win & reset (Phase 4)` (19 tests).

| ID | Behavior |
|----|----------|
| W1 | Winning mark triggers `winDeclared` with correct payload shape |
| W2 | `wordMarked` broadcast precedes `winDeclared` on winning mark |
| W3 | Non-completing mark emits only `wordMarked` (edge-case-aware) |
| W4 | `storage.put("phase", "ended")` fires on win |
| W5 | Post-win `markWord` is silently dropped |
| W6 | `winnerName` comes from server-side roster, not client input |
| W7 | `winnerName` falls back to `"Someone"` when player row missing |
| W8 | `onStart` rehydration of `phase="ended"` loads cleanly |
| R1 | Host `startNewGame` broadcasts `gameReset` (single-key payload) |
| R2 | Non-host `startNewGame` is silently dropped |
| R3 | Pre-hello `startNewGame` is silently dropped |
| R4 | `storage.put("phase", "lobby")` fires on reset |
| R5 | `storage.put("boards", [])` fires on reset |
| R6 | `storage.put("marks", [])` fires on reset |
| R7 | Post-reset `markWord` is silently dropped |
| R8 | Post-reset `startGame` yields a new `boardAssigned` (words retained) |
| R9 | No `storage.put("hostId"/"players"/…)` fires on reset; host can immediately re-start |
| R10 | No `storage.put("words"/"usedPacks"/…)` fires on reset |
| R11 | `startNewGame` also works from `phase="playing"` (mid-game host reset) |

**Full suite:** 253 tests pass across 14 files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Upgraded three Phase 3 tests from 5-word pools to 9-word pools**

- **Found during:** Task 1 GREEN (win detection implementation)
- **Issue:** Three pre-existing Phase 3 tests used 5 submitted words on a 3x3 board. A 5-word 3x3 board has 4 blank cells; after Phase 4's win-detection was added, a single mark on a word cell that happened to sit on a line of two blanks + itself would trigger an immediate `winDeclared`, causing those tests' `toHaveBeenCalledOnce()` assertions to fail (2 broadcasts: `wordMarked` + `winDeclared`). This is Pitfall 5 from Plan 04-02 RESEARCH.
- **Fix:** Extended those three tests to submit 9 words → full 3x3 with 0 blanks, so no single mark can complete a line (minimum 3 marks needed for any line).
- **Files modified:** `tests/unit/game-room.test.ts` (3 test bodies)
- **Commit:** `d68d9cd` (folded into Task 1 GREEN)

**2. [Rule 1 - Bug] Rewrote the W4 test to avoid broken double-loop logic**

- **Found during:** Task 1 GREEN
- **Issue:** Initial W4 draft used two nested loops where the second loop's iteration from `0` would unmark previously marked cells (toggle semantics), breaking the win state.
- **Fix:** Replaced with the shared `markUntilWin` helper and `.find()` assertions on `storage.put` + `broadcast` mock calls.
- **Files modified:** `tests/unit/game-room.test.ts` (W4 body)
- **Commit:** `d68d9cd` (folded into Task 1 GREEN)

No other deviations. Plan executed per spec.

## Commits (plan 04-02)

| Commit | Message |
|--------|---------|
| `06e0484` | test(04-02): add failing tests for win detection in markWord handler |
| `d68d9cd` | feat(04-02): implement server-authoritative win detection in markWord handler |
| `f80ab1f` | test(04-02): add failing tests for startNewGame host-only reset |
| `5c9bd55` | feat(04-02): implement host-only startNewGame handler in onMessage switch |

## TDD Gate Compliance

Both tasks followed RED → GREEN strictly:

- Task 1: `test(04-02): add failing tests for win detection…` (RED, 8 new failing tests) → `feat(04-02): implement server-authoritative win detection…` (GREEN, suite passes).
- Task 2: `test(04-02): add failing tests for startNewGame…` (RED, 5 new failing tests — R2/R3/R7 passed trivially via pre-existing silent-drop paths but are still valid regression guards) → `feat(04-02): implement host-only startNewGame handler…` (GREEN, suite passes).

No REFACTOR commits needed — both implementations were minimal on first write.

## Self-Check: PASSED

- `party/game-room.ts` exists and contains both `detectWin` win-detection block (markWord) and `case "startNewGame":` handler. Verified.
- `tests/unit/game-room.test.ts` contains `GameRoom — win & reset (Phase 4)` describe block with W1-W8 and R1-R11 tests. Verified.
- All 4 plan commits present in `git log`: `06e0484`, `d68d9cd`, `f80ab1f`, `5c9bd55`. Verified.
- Full unit test suite: 253/253 passing. Verified.
