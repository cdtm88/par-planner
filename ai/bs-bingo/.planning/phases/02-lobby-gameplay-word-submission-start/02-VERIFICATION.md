---
phase: 02-lobby-gameplay-word-submission-start
verified: 2026-04-17T17:35:00Z
status: passed
score: 5/5
overrides_applied: 0
deferred:
  - truth: "Post-start phase shows board (game on transition to board screen)"
    addressed_in: "Phase 3"
    evidence: "Phase 3 goal: Starting the game deals every player a private, server-generated board. Known stub: 'Board generation coming in the next phase.' in +page.svelte line 147."
human_verification:
  - test: "Open lobby in two browsers, submit words, verify real-time sync"
    expected: "Word chip appears in both browsers within ~1 second of submission"
    why_human: "Real-time WebSocket broadcast behavior cannot be verified without running the app"
  - test: "Submit a duplicate word (any case)"
    expected: "Input shakes, inline error shows the word that was rejected, error clears on next keystroke"
    why_human: "Shake animation and error UX timing require browser interaction to verify"
  - test: "Player A submits a word; Player B views it"
    expected: "Player B sees the chip but has no delete button on it; Player A's chip has delete"
    why_human: "Owner-only delete button visibility requires multi-client session to verify"
  - test: "Host loads 'Agile' starter pack"
    expected: "~20 word chips appear in both browsers; Agile pill greys out with checkmark; loading Agile again does nothing"
    why_human: "Pack load broadcast and pill state change require live browser verification"
  - test: "Non-host cannot see pack pills or Start Game button"
    expected: "Second browser (non-host) shows only 'Waiting for [HostName] to start the game…'"
    why_human: "Conditional rendering correctness with real session identity requires human to verify"
  - test: "Start Game with 5+ words"
    expected: "Both browsers transition to 'Game on!' screen; Start Game button is disabled below 5 words and enables at exactly 5"
    why_human: "Phase transition UX and button enable/disable threshold require interactive verification"
  - test: "Mobile usability check"
    expected: "All tap targets >= 44px, chips wrap, input + Add button stack vertically, no overflow"
    why_human: "Mobile layout and touch targets require device or emulator verification"
---

# Phase 2: Lobby Gameplay — Word Submission & Start Verification Report

**Phase Goal:** Players can populate the buzzword pool (with starter packs as a shortcut), the grid size auto-negotiates from the word count, and the host can start the game only once the pool is viable.
**Verified:** 2026-04-17T17:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Any player can submit a word and immediately see it appear in the shared word pool for everyone in the lobby | VERIFIED (code) / human_needed (runtime) | DO `submitWord` handler broadcasts `wordAdded`; store appends to reactive `words` array; `WordPool` renders chips from `store.words` |
| 2 | Attempting to submit a duplicate word (case-insensitive) is rejected with an inline message explaining why | VERIFIED (code) / human_needed (UX) | DO dedupes case-insensitively, sends `error code: "duplicate_word"`; `$effect` in page triggers `inputShake + wordError`; TextInput `shake` prop applies CSS shake class |
| 3 | A player can remove a word they personally submitted; they cannot remove words others submitted | VERIFIED (code) / human_needed (visual) | `WordPool` passes `canDelete={entry.submittedBy === playerId}`; DO `removeWord` checks `entry.submittedBy !== connState?.playerId` and returns `not_owner` |
| 4 | The host can one-click seed the pool from a starter pack (Corporate Classics, Agile, or Sales) and those words merge into the pool without breaking dedupe | VERIFIED (code) / human_needed (runtime) | `PackPills` shows 3 packs; `{#if iAmHost}` guards the section; DO `loadStarterPack` dedupes against existing pool, marks pack as used |
| 5 | Start Game control: visible to host, disabled with hint while minimum unmet, enabled at threshold; non-hosts see waiting state | VERIFIED (code) / human_needed (visual) | `canStart = $derived(wordCount >= 5)`; DO enforces `this.#words.size < 5` guard; non-host branch shows `Waiting for {hostName}...`; `GridProgress` renders hint copy |

**Score:** 5/5 truths verified at code level. All 5 require human confirmation for runtime/visual behavior.

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Post-start board screen (full Phase 3 transition) | Phase 3 | Phase 3 goal: "Starting the game deals every player a private, server-generated board." Known stub at +page.svelte:147: "Board generation coming in the next phase." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/protocol/messages.ts` | WordEntry, expanded RoomState, 4 ClientMessage variants, 3 ServerMessage variants | VERIFIED | WordEntry at line 11; RoomState with phase union + words + usedPacks at line 18; all 4 client variants (submitWord, removeWord, loadStarterPack, startGame); all 3 server variants (wordAdded, wordRemoved, gameStarted) |
| `src/lib/util/starterPacks.ts` | PACK_NAMES, PackName, STARTER_PACKS with 3 packs × 20 words | VERIFIED | All 3 packs confirmed at 20 words each (4 lines × 5 words per pack) |
| `src/lib/util/gridTier.ts` | deriveGridTier, wordsNeededToStart, wordsToNextTier, TIER_THRESHOLDS, GridTier | VERIFIED | All 5 exports present; thresholds 5/12/21 correct |
| `src/app.css` | @keyframes shake + prefers-reduced-motion guard | VERIFIED | Lines 17 and 27 |
| `tests/unit/protocol.test.ts` | Schema validation tests for all new message types | VERIFIED | 31 tests; includes submitWord acceptance/rejection, loadStarterPack validation, wordAdded, roomState with phase=playing |
| `tests/unit/gridTier.test.ts` | Boundary value tests | VERIFIED | 21 tests; covers 0/4/5/11/12/20/21/50 word counts |
| `party/game-room.ts` | submitWord, removeWord, loadStarterPack, startGame handlers | VERIFIED | All 4 cases present with correct guards; `#phase`, `#words`, `#usedPacks` fields; `#snapshot()` uses live values |
| `src/lib/stores/room.svelte.ts` | words state, usedPacks state, send(), wordAdded/wordRemoved handlers, lastError/clearError | VERIFIED | All present; gameStarted case also handled |
| `tests/unit/game-room.test.ts` | DO word pool behavior tests | VERIFIED | 28 tests (14 new Phase 2 tests); covers all handlers, guards, and edge cases |
| `src/lib/components/WordChip.svelte` | Word chip with optional delete button | VERIFIED | WordChipProps, aria-label, min-h-11 min-w-11, fade transition 120ms |
| `src/lib/components/WordPool.svelte` | Chip container with count and empty state | VERIFIED | `Words ({words.length})`, entry.submittedBy ownership check, keyed iteration |
| `src/lib/components/PackPills.svelte` | Host-only pack pill row | VERIFIED | 3 packs, "Seed from a starter pack:", "Already loaded" + Check icon for used state |
| `src/lib/components/GridProgress.svelte` | Progress bar with tier markers and hint | VERIFIED | deriveGridTier, wordsNeededToStart, accent color fill, correct hint copy |
| `src/lib/components/TextInput.svelte` | shake prop | VERIFIED | `shake?: boolean` at line 14; applied via `+ (shake ? " shake" : "")` |
| `src/routes/room/[code]/+page.svelte` | Full lobby with all components wired | VERIFIED | All 4 components imported and used; submitWord/removeWord/loadPack/startGame handlers wired; duplicate_word $effect present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/protocol/messages.ts` | `party/game-room.ts` | `import { type WordEntry }` | WIRED | Line 19 of game-room.ts; WordEntry used in 3 places for typed entries |
| `src/lib/util/starterPacks.ts` | `party/game-room.ts` | `import { STARTER_PACKS }` | WIRED | Line 21 of game-room.ts; used at line 163 in loadStarterPack handler |
| `src/lib/util/gridTier.ts` | `src/lib/components/GridProgress.svelte` | `import { deriveGridTier }` | WIRED | Line 2 of GridProgress.svelte; `deriveGridTier` called in `$derived` at line 12 |
| `src/routes/room/[code]/+page.svelte` | `src/lib/stores/room.svelte.ts` | `store.send({ type: "submitWord" })` | WIRED | `store?.send()` called in submitWord (line 101), removeWord (107), loadPack (111), startGame (118) |
| `src/routes/room/[code]/+page.svelte` | `src/lib/components/WordPool.svelte` | `import WordPool` | WIRED | Imported at line 6; rendered at line 200-204 |
| `src/lib/stores/room.svelte.ts` | `src/lib/protocol/messages.ts` | `import { type WordEntry, type ClientMessage }` | WIRED | Lines 6-9; WordEntry used for `words` state; ClientMessage used for `send()` parameter type |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `WordPool.svelte` | `words` prop | `store.words` (room store reactive state) | Yes — store populated by `wordAdded` WS messages from DO | FLOWING |
| `PackPills.svelte` | `usedPacks` prop | `store.usedPacks` (Set, updated from roomState + wordAdded events) | Yes — populated by DO's `#usedPacks` Set via roomState snapshot | FLOWING |
| `GridProgress.svelte` | `wordCount` prop | `store.words.length` derived in +page.svelte | Yes — derived from live reactive words array | FLOWING |
| `+page.svelte` | `roomState` | `store.state` (set from roomState WS messages) | Yes — DO sends snapshot on connect and on startGame | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests all pass | `npm run test:unit -- --run` | 123 tests, 9 files, all passed | PASS |
| deriveGridTier boundary at 5 | gridTier.test.ts: `returns 3x3 for 5 words` | Test passes | PASS |
| deriveGridTier boundary at 12 | gridTier.test.ts: `returns 4x4 for 12 words` | Test passes | PASS |
| deriveGridTier boundary at 21 | gridTier.test.ts: `returns 5x5 for 21 words` | Test passes | PASS |
| startGame < 5 words blocked | game-room.test.ts: `startGame with < 5 words sends not_enough_words` | Test passes | PASS |
| startGame flips phase | game-room.test.ts: `startGame with 5 words flips phase to playing` | Test passes | PASS |
| Duplicate word rejected | game-room.test.ts: `submitWord duplicate (case-insensitive) sends error` | Test passes | PASS |
| Non-host ignored | game-room.test.ts: `loadStarterPack by non-host is silently ignored` + `startGame by non-host` | Both pass | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOBB-01 | 02-01, 02-02, 02-03 | Players can submit words they expect to hear | SATISFIED | submitWord handler in DO + store + WordPool + TextInput all wired |
| LOBB-02 | 02-01, 02-02, 02-03 | Duplicate words (case-insensitive) rejected with clear message | SATISFIED | Server-side case-insensitive dedupe + error code `duplicate_word` + shake UX |
| LOBB-03 | 02-01, 02-02, 02-03 | Players can remove words they personally submitted | SATISFIED | removeWord handler checks `submittedBy` ownership; `canDelete` prop gates delete button |
| LOBB-04 | 02-01, 02-02, 02-03 | Host can use starter packs to pre-seed pool | SATISFIED | loadStarterPack host-only handler; PackPills component; 3 packs × 20 words; deduped merge |
| LOBB-05 | 02-01, 02-03 | Grid size auto-derived from word count | SATISFIED | gridTier.ts with correct thresholds (3x3≥5, 4x4≥12, 5x5≥21); GridProgress displays tier markers |
| LOBB-06 | 02-01, 02-02, 02-03 | Host cannot start until minimum word count reached | SATISFIED | DO enforces `this.#words.size < 5`; `canStart = $derived(wordCount >= 5)` disables button |
| LOBB-07 | 02-01, 02-02, 02-03 | Host starts game; non-hosts see waiting state | SATISFIED | startGame host-only guard; `{#if iAmHost}` shows button vs waiting text |

No orphaned requirements — all 7 LOBB requirements are claimed and satisfied by the plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/routes/room/[code]/+page.svelte` | 147 | "Board generation coming in the next phase." | Info | Intentional Phase 3 placeholder — deferred, not blocking |

No blockers or warnings found. The only stub is the Phase 3 transition placeholder, which is explicitly intentional and tracked in the deferred section.

### Human Verification Required

#### 1. Real-time word sync

**Test:** Open the lobby in two browsers. In Browser A, type "Synergy" and submit.
**Expected:** Word chip appears in both browsers within ~1 second.
**Why human:** WebSocket broadcast and store update latency cannot be verified without a running server.

#### 2. Duplicate rejection UX

**Test:** Submit "Synergy" from Browser A, then submit "synergy" from Browser A again.
**Expected:** Input shakes visually; inline error reads `"synergy" is already in the pool`; error clears on next keystroke.
**Why human:** CSS animation playback and timing require a real browser.

#### 3. Ownership-gated delete button

**Test:** Player A submits a word. Check both browsers.
**Expected:** Player A's view shows delete (x) on their chip. Player B's view shows no x on that chip.
**Why human:** Conditional rendering based on session identity requires multi-client verification.

#### 4. Starter pack load behavior

**Test:** Host (Browser A) clicks "Agile" pill.
**Expected:** ~20 chips appear in both browsers; Agile pill becomes greyed with checkmark; clicking it again does nothing.
**Why human:** Visual pack state change and broadcast behavior require runtime verification.

#### 5. Non-host cannot see host-only controls

**Test:** Open lobby as non-host (Browser B).
**Expected:** No "Seed from a starter pack:" section. No "Start Game" button. Only: "Waiting for [HostName] to start the game…"
**Why human:** Session-based conditional rendering requires real session identity from sessionStorage.

#### 6. Start Game threshold and transition

**Test:** With < 5 words, verify Start Game is disabled. Add words to reach 5. Tap Start Game.
**Expected:** Button enables exactly at 5 words; both browsers show "Game on!" after tap.
**Why human:** Button state transitions and cross-client phase change require interactive verification.

#### 7. Mobile usability

**Test:** Open lobby on a phone or mobile emulator. Test all interactions.
**Expected:** All tap targets ≥ 44px; input + Add button stack vertically on small screen; chips wrap; no horizontal overflow.
**Why human:** Layout and touch target size require visual/device verification.

### Gaps Summary

No blocking code gaps found. All artifacts are substantive, wired, and data-flowing. All 123 unit tests pass. The only open items are 7 human verification steps for runtime, visual, and multi-client behavior — these are expected for a UI phase with a blocking human-gate checkpoint (Plan 03 Task 3).

The SUMMARY claims human verification was "approved," but this verification cannot confirm browser/runtime behavior programmatically. The human steps above should be confirmed or re-confirmed before closing Phase 2.

---

_Verified: 2026-04-17T17:35:00Z_
_Verifier: Claude (gsd-verifier)_
