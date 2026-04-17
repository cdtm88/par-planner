---
phase: 02-lobby-gameplay-word-submission-start
plan: "02"
subsystem: server-state
tags: [durable-object, word-pool, store, tests, real-time]
dependency_graph:
  requires:
    - 02-01 (WordEntry schema, RoomState with words/usedPacks, ClientMessage variants, STARTER_PACKS utility)
  provides:
    - GameRoom DO word pool handlers (submitWord, removeWord, loadStarterPack, startGame)
    - room.svelte.ts extended with words state, usedPacks state, send() method
    - 14 DO unit tests covering all word pool behaviors
  affects:
    - src/routes/room/[code]/+page.svelte (Plan 02-03 extends store.send() and store.words)
tech_stack:
  added: []
  patterns:
    - synchronous dedupe (no await between check and insert — Pitfall 4)
    - host-only guard via conn.state.playerId === #hostId
    - owner guard via entry.submittedBy === conn.state.playerId
    - once-per-session pack guard via #usedPacks Set
key_files:
  created: []
  modified:
    - party/game-room.ts
    - src/lib/stores/room.svelte.ts
    - tests/unit/game-room.test.ts
decisions:
  - Pack words are attributed to host's playerId (not "pack" sentinel) so host can delete them via removeWord
  - #phase field added to DO; #snapshot() now uses this.#phase instead of hardcoded "lobby"
  - Store's wordAdded handler guards against duplicate wordId before appending (idempotency for reconnect)
metrics:
  duration: "~12 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 3
---

# Phase 02 Plan 02: DO Word Pool Handlers + Store Extension Summary

**One-liner:** GameRoom DO extended with submitWord/removeWord/loadStarterPack/startGame handlers with full validation guards; room store wired with reactive words/usedPacks state and send() method; 14 new DO unit tests all green (123 total).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend GameRoom DO with word pool handlers | 21f8141 | party/game-room.ts |
| 2 | Extend room store + DO unit tests | 14c91e4 | src/lib/stores/room.svelte.ts, tests/unit/game-room.test.ts |

## Verification

- `npm run test:unit -- --run` — 123 tests, 9 test files, all passed
- `npx tsc --noEmit` — no errors in party/ or src/lib/ (pre-existing .svelte-kit/ and src/worker.ts noise unchanged)
- DO handles all 4 new message types with proper host/owner guards
- Store correctly updates words and usedPacks from server messages
- Store exposes send() method for components to use

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the plan 02-01 stubs (`words: []` and `usedPacks: []` in `#snapshot()`) have been replaced with live values from `#words` and `#usedPacks`.

## Threat Surface Scan

All four threat mitigations from the plan's threat model are implemented:
- T-02-02-01: `connState?.playerId !== this.#hostId` guard on loadStarterPack
- T-02-02-02: Same host ID check on startGame
- T-02-02-03: `entry.submittedBy !== connState?.playerId` check on removeWord
- T-02-02-04: Valibot maxLength(30) enforced on submitWord text; server-side case-insensitive dedupe prevents pool pollution

No new network endpoints or trust boundary changes beyond what the plan specified.

## Self-Check: PASSED

- `party/game-room.ts` — contains `import { STARTER_PACKS }`, `import { nanoid }`, `#words = new Map`, `#phase`, `#usedPacks`, `case "submitWord"`, `case "removeWord"`, `case "loadStarterPack"`, `case "startGame"`, `code: "duplicate_word"`, `code: "not_owner"`, `code: "not_enough_words"`, `phase: this.#phase`, `words: [...this.#words.values()]`, `usedPacks: [...this.#usedPacks]`
- `src/lib/stores/room.svelte.ts` — contains `let words = $state<WordEntry[]>([])`, `let usedPacks = $state<Set<string>>`, `case "wordAdded":`, `case "wordRemoved":`, `send(msg: ClientMessage)`, `get words()`, `get usedPacks()`, `words = msg.state.words ?? []`
- `tests/unit/game-room.test.ts` — contains all 14 described test cases
- Commits 21f8141 and 14c91e4 confirmed in git log
