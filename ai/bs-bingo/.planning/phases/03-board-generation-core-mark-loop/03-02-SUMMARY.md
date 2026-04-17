---
phase: 03-board-generation-core-mark-loop
plan: 02
subsystem: api
tags: [durable-objects, websocket, board-generation, mark-loop, tdd, security]

requires:
  - phase: 03-board-generation-core-mark-loop
    plan: 01
    provides: BoardCell type, shuffle utility, markWord/boardAssigned/wordMarked message variants

provides:
  - startGame handler: broadcasts gameStarted + per-conn boardAssigned (never broadcast)
  - markWord handler: toggle with owner auth, blank rejection, phase guard, pre-hello guard
  - "#boards Map: playerId → BoardCell[] (per-player private)"
  - "#marks Map: playerId → Set<string> (per-player mark state)"
  - "#buildBoardForPlayer: Fisher-Yates shuffle, blank filler, cellCount from deriveGridTier"

affects:
  - 03-03 (client store receives boardAssigned → sets board state; receives wordMarked → updates playerMarks)
  - 03-04 (Board/BoardCell components consume BoardCell[] from store.board)

tech-stack:
  added: []
  patterns:
    - Per-connection send loop: for (const c of this.getConnections()) with pre-hello skip guard
    - Private Map state: #boards + #marks keyed by playerId (ephemeral, room-lifetime)
    - broadcast-first ordering (gameStarted before boardAssigned) per FIFO WS guarantee
    - Owner authorization: cellId.find on player's own board before any state mutation

key-files:
  created: []
  modified:
    - party/game-room.ts
    - tests/unit/game-room.test.ts

key-decisions:
  - "boardAssigned delivered exclusively via conn.send inside getConnections loop — never broadcast (BOAR-03 / T-3-05)"
  - "gameStarted broadcast precedes all boardAssigned sends — WS FIFO ensures clients mount <Board/> first (BOAR pattern Pitfall 8)"
  - "wordMarked payload is exactly {type, playerId, markCount} — no cellId/text/wordId (BOAR-06 / T-3-03)"
  - "getConnections stub added to FakeServer default (returns []) so Phase 2 tests survive new startGame semantics"
  - "Two Phase 2 startGame tests updated: assert gameStarted broadcast instead of old roomState broadcast"

patterns-established:
  - "FakeServer.getConnections default stub pattern: returns [] in base, overridden per-instance in Phase 3 beforeEach"
  - "extractBoardFromConn helper: find boardAssigned in conn._sent, assert defined, parse and return"

requirements-completed: [BOAR-01, BOAR-02, BOAR-03, BOAR-04, BOAR-06]

duration: 8min
completed: 2026-04-17
---

# Phase 03 Plan 02: Server Board Generation + markWord Handler Summary

**Per-player board generation on startGame (Fisher-Yates, blank fillers, private per-conn delivery) and markWord toggle handler with owner authorization and privacy-safe broadcast payload**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-17T21:27:00Z
- **Completed:** 2026-04-17T21:35:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `party/game-room.ts` extended with `#boards`/`#marks` private Maps, `#buildBoardForPlayer` helper, replaced `startGame` case, new `markWord` case
- `startGame` now: (1) broadcasts `gameStarted`, (2) loops `getConnections()` and `conn.send(boardAssigned)` per connected player — never broadcasts boards
- `markWord` enforces: pre-hello guard, phase guard, owner authorization (cellId on own board), blank rejection, toggle semantics, privacy-safe broadcast
- 39 unit tests pass (30 existing Phase 1/2 + 9 new Phase 3); full 164-test suite green
- Two Phase 2 `startGame` tests updated to assert `gameStarted` instead of old `roomState` semantics

## Task Commits

1. **Task 1: Write failing Phase 3 tests (RED)** - `fc21332` (test)
2. **Task 2: Implement board generation + markWord handler (GREEN)** - `052dd05` (feat)

## Files Created/Modified

- `party/game-room.ts` — Added imports (BoardCell, shuffle, deriveGridTier); #boards + #marks fields; replaced startGame case; new markWord case; #buildBoardForPlayer helper
- `tests/unit/game-room.test.ts` — Added Phase 3 describe block (9 tests); updated 2 Phase 2 startGame tests; added getConnections stub to FakeServer

## Key Interfaces for Downstream Plans

### Triggering boardAssigned delivery

```
Client sends: { type: "startGame" }  (host only, ≥5 words in pool)
Server broadcasts: { type: "gameStarted" }  (all connections)
Server sends per-conn: { type: "boardAssigned", cells: BoardCell[] }
```

### wordMarked payload shape (plan 03 client store needs this)

```typescript
{ type: "wordMarked", playerId: string, markCount: number }
// NO cellId, NO text, NO wordId — strict 3-key payload
```

### BoardCell shape (from plan 01, used here)

```typescript
{ cellId: string, wordId: string | null, text: string | null, blank: boolean }
// blank cells: wordId=null, text=null, blank=true
// word cells: wordId=nanoid(), text=string, blank=false
```

### Board sizing

| Word count | Tier | Cells | Blanks (5 words example) |
|-----------|------|-------|--------------------------|
| 5–11      | 3x3  | 9     | 4 (with 5 words)         |
| 12–20     | 4x4  | 16    | 0–4                      |
| 21+       | 5x5  | 25    | 0–4                      |

## Decisions Made

- `getConnections()` stub defaults to `[]` in `FakeServer` — avoids breaking Phase 2 tests when startGame now iterates connections; Phase 3 tests override it with their own `conns` array
- `#buildBoardForPlayer` copies the word pool per call (`[...wordPool]`) to prevent shuffle mutation sharing across players (Pitfall 5)
- Blank cells receive `nanoid()` cellIds so they appear in the board array — client can check `blank: true` to render non-interactive; server silently drops `markWord` on blank cellIds as defense-in-depth

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FakeServer missing getConnections caused Phase 2 test failure**
- **Found during:** Task 2 GREEN verification
- **Issue:** `FakeServer` mock had no `getConnections` method. After replacing `startGame` to iterate `this.getConnections()`, the Phase 2 startGame test (which uses no conn stub) threw `TypeError: this.getConnections is not a function`
- **Fix:** Added `getConnections(): Iterable<unknown> { return []; }` to `FakeServer` in the `vi.mock("partyserver")` block. Phase 3 tests override this per-instance in `beforeEach`. Phase 2 tests use the default empty iterable (board loop runs 0 iterations, which is correct — no connections registered in those tests)
- **Files modified:** `tests/unit/game-room.test.ts`
- **Commit:** `052dd05`

## Known Stubs

None — all board generation is fully implemented and wired. No placeholder data.

## Threat Surface Scan

No new network endpoints introduced. The `markWord` handler is part of the existing `onMessage` switch — already behind the Valibot `ClientMessage` parse gate established in Phase 1. All T-3-02, T-3-03, T-3-05, T-3-06 threat mitigations from the plan's threat model are implemented and unit-tested.

## Self-Check

- [x] `party/game-room.ts` exists and contains `#buildBoardForPlayer`, `#boards`, `#marks`, `case "markWord"`, `for (const c of this.getConnections())`
- [x] `tests/unit/game-room.test.ts` contains `describe("GameRoom — board & marks (Phase 3)"`
- [x] Commit `fc21332` exists (test RED)
- [x] Commit `052dd05` exists (feat GREEN)
- [x] 164 unit tests pass; 0 regressions

## Self-Check: PASSED
