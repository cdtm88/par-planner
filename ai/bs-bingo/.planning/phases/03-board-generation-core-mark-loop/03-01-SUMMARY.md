---
phase: 03-board-generation-core-mark-loop
plan: 01
subsystem: api
tags: [valibot, typescript, shuffle, crypto, websocket, protocol]

requires:
  - phase: 02-lobby-gameplay-word-submission-start
    provides: ClientMessage/ServerMessage discriminated union pattern; Valibot v.variant extension idiom

provides:
  - BoardCell Valibot schema and TypeScript type (cellId, wordId|null, text|null, blank:boolean)
  - ClientMessage.markWord variant (cellId: non-empty string)
  - ServerMessage.boardAssigned variant (cells: BoardCell[])
  - ServerMessage.wordMarked variant (playerId: non-empty string, markCount: non-negative integer)
  - shuffle<T>() utility using crypto.getRandomValues with Fisher-Yates + rejection sampling (BOAR-02)

affects:
  - 03-02 (server board generation imports shuffle + BoardCell + markWord/boardAssigned/wordMarked)
  - 03-03 (client store imports BoardCell + boardAssigned/wordMarked handlers)
  - 03-04 (Board/BoardCell components import BoardCell type)

tech-stack:
  added: []
  patterns:
    - Valibot v.variant append pattern for discriminated union extension
    - crypto.getRandomValues + Uint32 rejection sampling for unbiased Fisher-Yates
    - TDD RED/GREEN cycle for pure utility functions

key-files:
  created:
    - src/lib/util/shuffle.ts
    - tests/unit/shuffle.test.ts
  modified:
    - src/lib/protocol/messages.ts
    - tests/unit/protocol.test.ts

key-decisions:
  - "BoardCell travels only in boardAssigned per-connection sends — RoomState intentionally has no board field (BOAR-03 privacy)"
  - "shuffle uses crypto.getRandomValues with rejection sampling to eliminate modulo bias (BOAR-02, T-3-01)"
  - "markWord cellId validated with v.minLength(1); wordMarked markCount validated with v.integer() + v.minValue(0)"

patterns-established:
  - "Pure utility test pattern: describe + it + expect, no mocks, statistical assertions for randomness"
  - "Valibot schema extension: append new variant objects inside existing v.variant array, never recreate"

requirements-completed: [BOAR-02]

duration: 8min
completed: 2026-04-17
---

# Phase 03 Plan 01: Type Contracts + Shuffle Utility Summary

**BoardCell schema, 3 new WS message variants (markWord/boardAssigned/wordMarked), and crypto-unbiased Fisher-Yates shuffle — contracts-first foundation for Phase 3 board generation**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-17T21:23:00Z
- **Completed:** 2026-04-17T21:31:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `shuffle<T>()` implemented using `crypto.getRandomValues` + Uint32 rejection sampling eliminating modulo bias (BOAR-02); verified with statistical test (1000 runs, 5x5 frequency matrix, all cells 120–280)
- `BoardCell` Valibot schema exported from `messages.ts` with nullable `wordId`/`text` + required `blank` flag; `RoomState` unchanged (boards never broadcast)
- 3 new message variants appended to existing discriminated unions: `markWord` (client), `boardAssigned` and `wordMarked` (server) — all with input validation guards per threat model T-3-01/T-3-02/T-3-03
- 14 new protocol tests + 5 shuffle tests all green; full 142-test suite passing

## Task Commits

1. **Task 1: Write failing tests for shuffle utility** - `2fd41fb` (test)
2. **Task 2: Implement shuffle.ts to pass shuffle tests** - `4448683` (feat)
3. **Task 3: Extend messages.ts schemas + add parse tests** - `ff4223f` (feat)

## Files Created/Modified

- `src/lib/util/shuffle.ts` - Cryptographically unbiased Fisher-Yates shuffle; exports `shuffle<T>(arr: T[]): T[]`
- `tests/unit/shuffle.test.ts` - 5 tests: empty/single identity, multiset preservation, statistical uniformity, crypto.getRandomValues spy
- `src/lib/protocol/messages.ts` - Added `BoardCell` schema+type, `markWord` ClientMessage variant, `boardAssigned`+`wordMarked` ServerMessage variants
- `tests/unit/protocol.test.ts` - 14 new tests: markWord (3), boardAssigned (2), wordMarked (5), BoardCell schema (4)

## Decisions Made

- `RoomState` has no `board` field — boards are per-player private payloads sent via `conn.send`, never broadcast (T-3-04 threat accepted by design)
- Rejection sampling threshold: `max = Math.floor(0xffffffff / n) * n` — worst-case rejection probability < 50%; practically < 1% for small n
- `wordMarked` carries only `playerId` and `markCount` — no `cellId` or board layout in broadcast (BOAR-06)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

`npx tsc --noEmit` reports errors in `.svelte-kit/` generated build output — pre-existing framework-generated errors unrelated to this plan's files. Source files `src/lib/protocol/messages.ts` and `src/lib/util/shuffle.ts` have zero TypeScript errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02 (server board generation) can import `shuffle`, `BoardCell`, `markWord`, `boardAssigned`, `wordMarked` without blocking
- Plan 03 (client store) can import `BoardCell`, `boardAssigned`, `wordMarked` without blocking
- Plan 04 (Board/BoardCell components) can import `BoardCell` type

---
*Phase: 03-board-generation-core-mark-loop*
*Completed: 2026-04-17*
