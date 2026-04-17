---
phase: 02-lobby-gameplay-word-submission-start
plan: "01"
subsystem: protocol
tags: [protocol, types, utilities, tests]
dependency_graph:
  requires: []
  provides:
    - WordEntry schema (messages.ts)
    - expanded RoomState with words + usedPacks
    - 4 new ClientMessage variants
    - 3 new ServerMessage variants
    - starterPacks utility (3 packs × 20 words)
    - gridTier utility (deriveGridTier, wordsNeededToStart, wordsToNextTier)
    - CSS shake animation
  affects:
    - party/game-room.ts (RoomState shape change, #snapshot stub)
    - src/lib/stores/room.svelte.ts (Plan 02-02 extends)
    - src/routes/room/[code]/+page.svelte (Plan 02-03 extends)
tech_stack:
  added: []
  patterns:
    - Valibot v.union for phase field
    - Valibot v.picklist for pack name enum constraint
    - Pure utility module pattern (gridTier.ts, starterPacks.ts)
key_files:
  created:
    - src/lib/util/starterPacks.ts
    - src/lib/util/gridTier.ts
    - tests/unit/gridTier.test.ts
  modified:
    - src/lib/protocol/messages.ts
    - src/app.css
    - party/game-room.ts
    - tests/unit/protocol.test.ts
decisions:
  - Stubbed game-room.ts #snapshot() with empty words/usedPacks arrays to fix TS compilation; full implementation deferred to Plan 02-02
  - Updated existing roomState test fixture to include required words/usedPacks fields
metrics:
  duration: "~8 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 7
---

# Phase 02 Plan 01: Protocol Schemas + Utility Modules Summary

**One-liner:** Valibot schemas extended with WordEntry, phase union, 4 client + 3 server message variants; gridTier and starterPacks utilities created; 52 unit tests green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend protocol schemas + create utility modules | 62bf5d9 | messages.ts, starterPacks.ts, gridTier.ts, app.css, game-room.ts |
| 2 | Unit tests for protocol schemas and grid tier functions | aa3528f | protocol.test.ts, gridTier.test.ts |

## Verification

- `npm run test:unit -- --run protocol gridTier` — 52 tests, all passed
- `npx tsc --noEmit` — no source-file errors (pre-existing `.svelte-kit/` and `tests/unit/game-room.test.ts` errors unchanged)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] game-room.ts #snapshot() incompatible with expanded RoomState**
- **Found during:** Task 1 verification (tsc)
- **Issue:** `party/game-room.ts` line 186 returned `RoomState` without `words` or `usedPacks` after schema expansion
- **Fix:** Added stub `words: []` and `usedPacks: []` to `#snapshot()` return; full DO implementation is Plan 02-02's responsibility
- **Files modified:** `party/game-room.ts`
- **Commit:** 62bf5d9

**2. [Rule 1 - Bug] Existing roomState ServerMessage test missing required fields**
- **Found during:** Task 2 test run
- **Issue:** Pre-existing test `accepts a valid roomState message` passed a RoomState without `words`/`usedPacks`, now fails validation
- **Fix:** Added `words: []` and `usedPacks: []` to the test fixture
- **Files modified:** `tests/unit/protocol.test.ts`
- **Commit:** aa3528f

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `words: []` in `#snapshot()` | `party/game-room.ts` line 187 | Placeholder until Plan 02-02 adds `#words` Map to GameRoom |
| `usedPacks: []` in `#snapshot()` | `party/game-room.ts` line 188 | Placeholder until Plan 02-02 adds `#usedPacks` Set to GameRoom |

These stubs do not affect Plan 01's goal (type contracts + utilities). Plan 02-02 replaces them.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary changes introduced. `starterPacks.ts` contains only game content constants; no secrets.

## Self-Check: PASSED

- `src/lib/protocol/messages.ts` — exists, contains WordEntry, expanded RoomState, all new message variants
- `src/lib/util/starterPacks.ts` — exists, exports PACK_NAMES, STARTER_PACKS with 3 packs
- `src/lib/util/gridTier.ts` — exists, exports deriveGridTier, wordsNeededToStart, wordsToNextTier, TIER_THRESHOLDS
- `src/app.css` — contains @keyframes shake and prefers-reduced-motion guard
- `tests/unit/gridTier.test.ts` — exists, 21 tests
- `tests/unit/protocol.test.ts` — extended, 31 tests
- Commits 62bf5d9 and aa3528f confirmed in git log
