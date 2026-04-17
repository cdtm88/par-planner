---
phase: 02-lobby-gameplay-word-submission-start
plan: "03"
subsystem: ui-components
status: checkpoint_pending
tags: [ui, components, svelte, lobby, word-pool, real-time]
dependency_graph:
  requires:
    - 02-01 (WordEntry schema, gridTier utility, RoomState with words/usedPacks)
    - 02-02 (DO word pool handlers, room store with words/usedPacks/send)
  provides:
    - WordChip component (word chip with optional delete)
    - WordPool component (chip container with empty state)
    - PackPills component (host-only starter pack row)
    - GridProgress component (progress bar with tier markers)
    - TextInput shake prop
    - Lobby page fully wired with all Phase 2 components
    - lastError/clearError on room store for duplicate_word UX
  affects:
    - src/routes/room/[code]/+page.svelte (complete rewrite of lobby content)
    - src/lib/stores/room.svelte.ts (lastError state + gameStarted handler)
tech_stack:
  added: []
  patterns:
    - Svelte 5 $props() + $derived for all new components
    - Fade transition (120ms) on chip enter/exit
    - $effect for reactive error response (duplicate_word → shake + inline error)
    - Host-only conditional rendering via iAmHost derived
    - Phase guard (gameStarted) for post-start transition placeholder
key_files:
  created:
    - src/lib/components/WordChip.svelte
    - src/lib/components/WordPool.svelte
    - src/lib/components/PackPills.svelte
    - src/lib/components/GridProgress.svelte
  modified:
    - src/lib/components/TextInput.svelte
    - src/routes/room/[code]/+page.svelte
    - src/lib/stores/room.svelte.ts
decisions:
  - Used $effect to watch store.lastError for duplicate_word; clearError() immediately after reading to avoid re-triggering
  - gameStarted handler added to store (sets phase to "playing") alongside lastError — both are Rule 2 additions required for correct UI behavior
  - Start Game button wrapped in div for responsive width (full-width mobile, min-width sm+) since Button has no fullWidth prop
metrics:
  duration: "~15 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 7
---

# Phase 02 Plan 03: UI Components + Lobby Wiring Summary

**One-liner:** Four new Svelte components (WordChip, WordPool, PackPills, GridProgress) built to spec and wired into the lobby page; host/non-host conditional rendering, duplicate-rejection shake, and start-game flow all implemented; 123 unit tests still green.

**Status:** CHECKPOINT PENDING — awaiting human verification (Task 3)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create UI components (WordChip, WordPool, PackPills, GridProgress, TextInput shake) | f93284b | WordChip.svelte, WordPool.svelte, PackPills.svelte, GridProgress.svelte, TextInput.svelte |
| 2 | Wire components into lobby page | 6694339 | +page.svelte, room.svelte.ts |

## Verification

- `npx svelte-check` — 0 errors in source files (pre-existing .svelte-kit/output and src/worker.ts errors unchanged from prior plans)
- `npm run test:unit -- --run` — 123 tests, 9 test files, all passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added lastError/clearError to store**
- **Found during:** Task 2
- **Issue:** Plan step 6 called for lastError/clearError on the store but these were not yet present in room.svelte.ts (Plan 02-02 left error handling as console.warn)
- **Fix:** Added `let lastError = $state<{code: string; message?: string} | null>(null)`, updated `case "error":` to set lastError, added `get lastError()` and `clearError()` to return object
- **Files modified:** `src/lib/stores/room.svelte.ts`
- **Commit:** 6694339

**2. [Rule 2 - Missing Critical Functionality] Added gameStarted handler to store**
- **Found during:** Task 2
- **Issue:** Store had no handler for `gameStarted` ServerMessage; without it, the lobby page's `gameStarted` derived would never become true
- **Fix:** Added `case "gameStarted": if (state) state = { ...state, phase: "playing" }; break;` to message handler switch
- **Files modified:** `src/lib/stores/room.svelte.ts`
- **Commit:** 6694339

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| "Board generation coming in the next phase." | `+page.svelte` | Phase transition placeholder; Phase 3 replaces with board UI |

## Threat Surface Scan

- T-02-03-01 (Spoofing): `{#if iAmHost}` guards PackPills and Start Game button — UI-only guard as specified (server-side guards in DO are the real boundary, implemented in Plan 02-02)
- T-02-03-02 (Information Disclosure): WordPool visible to all players by design — no private data
- T-02-03-03 (Tampering): TextInput has `maxlength={30}` — client-side cap in place; Valibot maxLength(30) on server enforces it server-side (implemented in Plan 02-01)

No new threat surface beyond plan specification.

## Self-Check: PASSED

- `src/lib/components/WordChip.svelte` — exists, contains WordChipProps, aria-label, min-h-11 min-w-11, in:fade={{ duration: 120 }}
- `src/lib/components/WordPool.svelte` — exists, contains Words ({words.length}), No words yet, entry.submittedBy === playerId, {#each words as entry (entry.wordId)}
- `src/lib/components/PackPills.svelte` — exists, contains Seed from a starter pack:, Corporate Classics, Already loaded, Check size={14}
- `src/lib/components/GridProgress.svelte` — exists, contains deriveGridTier, wordsNeededToStart, bg-[var(--color-accent)], Ready — start when you are.
- `src/lib/components/TextInput.svelte` — contains shake?: boolean, shake ? " shake" : ""
- `src/routes/room/[code]/+page.svelte` — contains all required imports, interfaces, handler functions, component usage, host/non-host conditional rendering
- `src/lib/stores/room.svelte.ts` — contains lastError state, clearError(), gameStarted case handler
- Commits f93284b and 6694339 confirmed in git log
