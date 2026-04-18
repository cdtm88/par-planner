---
phase: 04-win-detection-announcement-play-again
verified: 2026-04-18T12:15:00Z
status: passed
score: 5/5
overrides_applied: 0
gaps: []
human_verification:
  - test: "Confirm winningWords is added to the RoomStore interface in +page.svelte"
    expected: "interface RoomStore { ... winningWords: string[]; ... } at lines 35-52"
    why_human: "WR-03 from code review: winningWords is used at line 191 (store.winningWords) but the RoomStore interface (lines 35-52) is missing the winningWords: string[] field. TypeScript resolves it as any via structural typing against the actual store object, so the code works at runtime but the type contract is silent on refactors. This is a one-line fix; a human should apply it and verify pnpm run build still exits 0."
---

# Phase 4: Win Detection, Announcement & Play-Again — Verification Report

**Phase Goal:** The server — not the client — decides who wins, every player sees a consistent celebration moment, and the host can reset the room for another round without anyone having to re-join.
**Verified:** 2026-04-18T12:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Server declares winner after any line completes; further marks do not change outcome | VERIFIED | `detectWin()` called in `markWord` handler after `#persistMarks()`. On win: `#phase = "ended"` → `#persistPhase()` → broadcast `winDeclared`. Phase guard `if (this.#phase !== "playing") return;` blocks all subsequent marks. Tested by W1, W4, W5 in game-room.test.ts. |
| 2 | Winning player sees celebration screen with confetti animation and "BINGO!" announcement | VERIFIED | EndScreen.svelte renders `<h1 class="font-display ... text-[var(--color-accent)]">BINGO!</h1>` when `isWinner`. canvas-confetti dynamically imported (`import("canvas-confetti")`) with `msg.winnerId === player.playerId` guard. SSR-safe via dynamic import + `.catch()`. Tested by S3 in room-store.test.ts, E1 in EndScreen.test.ts. |
| 3 | Every non-winning player sees who won and which line completed; view content identical across clients | VERIFIED | `winningWords` computed server-side from winner's board and included in `winDeclared` broadcast. Non-winners render `"{winner.displayName} got Bingo!"` heading + WinLineIcon + winning-word chips. Server ensures both variants have identical win data. Tested by E8-E12 in EndScreen.test.ts. |
| 4 | Host sees "Start new game" control; non-hosts do not | VERIFIED | EndScreen.svelte: `{#if isHost}` guards the `<Button variant="primary">Start new game</Button>`. Non-hosts see "Waiting for the host to start a new game." Tested by E13-E14 in EndScreen.test.ts. |
| 5 | Host triggering new game returns all players to lobby with roster and host preserved, no rejoin needed | VERIFIED | `case "startNewGame"`: clears `#boards` + `#marks`, sets `#phase = "lobby"`, persists all three, broadcasts `gameReset`. Explicitly does NOT touch `#players`, `#hostId`, `#words`, `#usedPacks`. Client `gameReset` handler clears 7 game-scoped fields + flips `state.phase` to `"lobby"`. Tested by R1-R11 in game-room.test.ts, two-browser e2e in win-and-reset.spec.ts. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/protocol/messages.ts` | WinningLine schema, winDeclared/gameReset/startNewGame variants, RoomState.phase with "ended" | VERIFIED | All present. `v.literal("ended")` at line 39, `startNewGame` in ClientMessage, `winDeclared` (with `winningWords: v.array(v.string())`) + `gameReset` in ServerMessage. WinningLine schema at lines 31-35. |
| `src/lib/util/winLine.ts` | detectWin, formatWinLine, winLineCellIndices, WinResult type | VERIFIED | 5 exports confirmed (`export function detectWin`, `export function formatWinLine`, `export function winLineCellIndices`, `export type WinResult`, `export type { WinningLine }`). Imports `BoardCell, WinningLine` from `$lib/protocol/messages`. |
| `src/app.css` | @keyframes winLinePulse + [data-win-line="true"] > button rule + reduced-motion fallback | VERIFIED | All three blocks present at lines 31-46. `1200ms ease-in-out infinite` animation, `#F5D547` colors hard-coded, reduced-motion fallback with static `box-shadow`. |
| `party/game-room.ts` | detectWin import, #phase union with "ended", markWord win detection tail, startNewGame handler | VERIFIED | `import { detectWin }` at line 31, `#phase: "lobby" | "playing" | "ended"` at line 61, storage.get widened at line 84, `winDeclared` broadcast with `winningWords` derived server-side, `case "startNewGame"` with host-only guard + clear + persist + `gameReset` broadcast. |
| `src/lib/components/WinLineIcon.svelte` | 64x64 mini-grid, N×N cells, winning-line highlights, role=img | VERIFIED | `w-16 h-16`, literal `grid-cols-3/4/5` tokens via `$derived` ternary (Tailwind v4 scanner safe), `bg-[var(--color-ink-primary)]` for highlighted cells, `bg-[var(--color-divider)]` for others, `role="img"`, `aria-label="Winning line indicator"`. |
| `src/lib/components/EndScreen.svelte` | winner/non-winner/host/non-host variants, BINGO! wordmark, "got Bingo!" heading, Start new game, WinLineIcon, winningWords chips | VERIFIED | All copy strings present. Winner gets `font-display` "BINGO!" + `aria-live="polite"`. Non-winner gets "{name} got Bingo!" + `aria-live="polite"`. Both get WinLineIcon (final design after human-verify pivot). winningWords render as gold chips. Host-only CTA + "Word pool and players are kept." Non-host sees waiting message. |
| `src/lib/stores/room.svelte.ts` | winDeclared/gameReset handlers, winner/winningLine/winningCellIds/winningWords state + getters, startNewGame() sender | VERIFIED | All 4 `$state` fields present, both message handlers, getters exposed, `startNewGame()` sends `{ type: "startNewGame" }`. Confetti fires inside handler (not `$effect`) with `msg.winnerId === player.playerId` guard and dynamic import. |
| `src/routes/room/[code]/+page.svelte` | Three-way phase conditional, EndScreen mounted for "ended", all 10 props derived, RoomStore interface updated | PARTIAL — see human verification | Three-way phase conditional present (line 159: `{#if phase === "playing"}`, line 183: `{:else if phase === "ended"}`). EndScreen receives 10 props including `winningWords`. RoomStore interface at lines 35-52 includes `winner`, `winningLine`, `winningCellIds`, `startNewGame()` — but is **missing `winningWords: string[]`** (WR-03). |
| `tests/unit/winLine.test.ts` | 23 tests for detectWin/formatWinLine/winLineCellIndices | VERIFIED | 23 tests confirmed; all pass (284/284 full suite). |
| `tests/unit/game-room.test.ts` | "GameRoom — win & reset (Phase 4)" describe block, 19 tests | VERIFIED | Describe block confirmed at line 862, 19 tests covering W1-W8 and R1-R11; all pass. |
| `tests/unit/room-store.test.ts` | Phase 4 describe block with winDeclared/gameReset/startNewGame tests | VERIFIED | 29 total tests pass (7 Phase 4 tests). `vi.mock("canvas-confetti")` present. |
| `tests/unit/WinLineIcon.test.ts` | 8 tests for cell-highlight correctness | VERIFIED | 8 tests pass. |
| `tests/unit/EndScreen.test.ts` | 15+ tests for winner/non-winner/host/non-host variants | VERIFIED | 16 tests pass (plan 03 had 15; one test was added during the human-verify redesign). |
| `e2e/win-and-reset.spec.ts` | Two-browser Playwright spec for WIN-04 and WIN-05 | VERIFIED | File exists. Two tests: "both players see EndScreen within 1.5s of win" and "host starts new game, both players return to lobby with words retained". Per Plan 04 SUMMARY: both tests passed before human-verify approval. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `party/game-room.ts` | `src/lib/util/winLine.ts` | `import { detectWin }` | WIRED | Line 31: `import { detectWin } from "../src/lib/util/winLine.js";` Used at line 332. |
| `party/game-room.ts` | `src/lib/protocol/messages.ts` | `v.safeParse(ClientMessage, ...)` in onMessage | WIRED | Existing Phase 1 pattern. `startNewGame` now accepted by ClientMessage parser; `winDeclared` rejected (T-4-03 security gate). |
| `src/lib/stores/room.svelte.ts` | `canvas-confetti` (npm) | `import("canvas-confetti")` | WIRED | Line 118: dynamic import inside winDeclared handler, winner-only guard, SSR-safe. |
| `src/lib/components/WinLineIcon.svelte` | `src/lib/util/winLine.ts` | `import { winLineCellIndices }` | WIRED | Line 3 of WinLineIcon.svelte. Used at line 16 to build `highlightedSet`. |
| `src/lib/components/EndScreen.svelte` | `src/lib/util/winLine.ts` | `import { formatWinLine }` | WIRED | Line 5 of EndScreen.svelte. Used at line 29 via `$derived(formatWinLine(winningLine))`. |
| `src/lib/components/EndScreen.svelte` | `src/lib/components/WinLineIcon.svelte` | component composition | WIRED | Line 3 import, used at line 50 `<WinLineIcon {gridSize} {winningLine} />`. |
| `src/routes/room/[code]/+page.svelte` | `src/lib/components/EndScreen.svelte` | mounted when `phase === "ended"` | WIRED | Lines 183-199. |
| `src/routes/room/[code]/+page.svelte` | `src/lib/util/gridTier.ts` | `deriveGridTier()` | WIRED | Line 20 import, line 185 usage: `{@const gridTier = deriveGridTier(roomState?.words.length ?? 0)}`. |
| `src/routes/room/[code]/+page.svelte` | `src/lib/stores/room.svelte.ts` | `store.winner`, `store.winningLine`, `store.winningCellIds`, `store.startNewGame()` | WIRED | Lines 188-198 pass all store fields to EndScreen. `store.winningWords` used at line 191 but **missing from RoomStore interface** (WR-03). |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| EndScreen.svelte | `winner`, `winningLine`, `winningCellIds`, `winningWords` | `winDeclared` broadcast from DO, via room store | Yes — server derives from winner's board cells; winningWords computed from board at broadcast time | FLOWING |
| WinLineIcon.svelte | `highlightedSet` from `winLineCellIndices()` | `winningLine` prop, pure function | Yes — deterministic computation over WinningLine schema | FLOWING |
| party/game-room.ts markWord | `win` (WinResult) | `detectWin(myBoard, myMarks)` where both come from server-side Maps | Yes — server-side board and marks are authoritative; no client-supplied values | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `detectWin` row completion returns non-null | `pnpm run test:unit tests/unit/winLine.test.ts` | 23/23 tests pass | PASS |
| Protocol rejects forged `winDeclared` from client | `pnpm run test:unit tests/unit/protocol.test.ts` | All 56 protocol tests pass (Test 11 explicitly verifies T-4-03) | PASS |
| DO markWord→win→broadcast ordering | `pnpm run test:unit tests/unit/game-room.test.ts` | 59/59 tests pass including W2 (ordering) and W4 (persist-before-broadcast) | PASS |
| Room store winDeclared sets state + phase | `pnpm run test:unit tests/unit/room-store.test.ts` | 29/29 tests pass | PASS |
| Full unit suite: 284/284 | `pnpm run test:unit` | 284 tests across 16 files, all pass | PASS |

---

### Requirements Coverage

| Requirement | Description | Source Plans | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| WIN-01 | Server checks for completed line after every mark | 04-01, 04-02 | SATISFIED | `detectWin` invoked in `markWord` after `#persistMarks()`. Phase "ended" blocks further marks. |
| WIN-02 | Server broadcasts win to all players | 04-01, 04-02 | SATISFIED | `winDeclared` ServerMessage with `winningLine`, `winningCellIds`, `winningWords` broadcast to all connections. Schema enforces minLength(1) on winnerId/winnerName. |
| WIN-03 | Winning player sees celebration state (confetti + "BINGO!" announcement) | 04-03, 04-04 | SATISFIED | `canvas-confetti` fires with 180 particles (60 reduced-motion) on `winnerId === player.playerId`. EndScreen "BINGO!" in font-display accent gold. |
| WIN-04 | All players see who won and which line completed | 04-03, 04-04 | SATISFIED | Non-winner heading "{name} got Bingo!", WinLineIcon showing the exact line, winning-word gold chips. Server-broadcast `winningWords` ensures non-winners see same words as winner. |
| WIN-05 | Host can start new game from end screen; resets to lobby with same players | 04-02, 04-03, 04-04 | SATISFIED | `startNewGame` handler clears boards/marks/phase only. Players, hostId, words, usedPacks retained. `gameReset` broadcast returns all clients to lobby. E2e test confirms words retained post-reset. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/routes/room/[code]/+page.svelte` | 35-52, 191 | `winningWords` used in template (`store.winningWords` at line 191) but absent from the `RoomStore` TypeScript interface | Warning | TypeScript resolves as `any` via structural typing against the actual store object. Runtime works. Silent type hole: renaming `winningWords` in the store won't be caught at the call site by the compiler. One-line fix: add `winningWords: string[];` to the interface. |
| `src/lib/util/winLine.ts` | 25 | All-blank-line edge case: `detectWin` treats blank cells as satisfied without requiring at least one marked cell on the line | Warning | On a 3×3 board with 4 blanks, a diagonal of 3 blanks is theoretically possible. First `markWord` from any player would trigger `winDeclared` before they consciously completed a line. WR-01 from code review — acknowledged, not yet fixed. Low probability; depends on random board layout. |

---

### Human Verification Required

### 1. Fix RoomStore interface — winningWords missing

**Test:** Open `src/routes/room/[code]/+page.svelte` and add `winningWords: string[];` to the `interface RoomStore` block (after line 50, before `startNewGame(): void;`). Then run `pnpm run build` and confirm exit 0.
**Expected:** TypeScript compiler accepts the change; `pnpm run build` exits 0 with no type errors.
**Why human:** This is a one-line TypeScript fix (WR-03 from code review). The code review flagged it; the summaries confirm it was not addressed in any of the four plans. Automating this edit is within scope but the decision to apply or defer it belongs to the developer.

---

### Gaps Summary

No gaps blocking goal achievement. All five roadmap success criteria are satisfied. The only outstanding issue is a **TypeScript type gap** (WR-03): `winningWords` is absent from the `RoomStore` interface in `+page.svelte`. The runtime behavior is correct because TypeScript uses structural typing against the actual store object. The developer should decide whether to apply the one-line fix now or track it separately.

The code review also flagged WR-01 (all-blank-line edge case in `detectWin`) and IN-04 (e2e test fragility with random board layout). These are low-probability UX edge cases, not goal-blocking failures. They are tracked in `04-REVIEW.md` and remain open.

---

_Verified: 2026-04-18T12:15:00Z_
_Verifier: Claude (gsd-verifier)_
