---
phase: 04-win-detection-announcement-play-again
plan: 04
subsystem: ui
tags: [phase-4, sveltekit, svelte5, endscreen, playwright, e2e, route-integration]

dependency-graph:
  requires:
    - phase: 04-win-detection-announcement-play-again/01
      provides: WinningLine schema, formatWinLine util, winLinePulse CSS
    - phase: 04-win-detection-announcement-play-again/02
      provides: server-authoritative win detection + host-only startNewGame handler
    - phase: 04-win-detection-announcement-play-again/03
      provides: room store winner/winningLine/winningCellIds getters + startNewGame sender + EndScreen + WinLineIcon
  provides:
    - three-phase conditional render on /room/[code]/+page.svelte (playing / ended / lobby)
    - two-browser Playwright spec covering WIN-03/WIN-04/WIN-05 end-to-end
    - winningWords broadcast field (server → store → EndScreen) for winning-word chip rendering
  affects:
    - Phase 5 (resilience) — end-of-game state is now fully observable in e2e; reconnect/resume must preserve phase="ended" winner metadata

tech-stack:
  added: []
  patterns:
    - "phase conditional with {@const} derivations for per-branch props (gridTier → gridSize)"
    - "winner-only board passthrough (store.winner.playerId === myPlayerId ? store.board : null) preserves BOAR-03 through game end"
    - "Playwright win trigger: click every non-blank cell with short per-click timeout, break on BINGO! visibility to avoid racing Board unmount"
    - "Server derives winningWords from the winner's BoardCell[] at broadcast time so all clients (non-winners included) see the actual words completed"

key-files:
  created:
    - e2e/win-and-reset.spec.ts
    - .planning/phases/04-win-detection-announcement-play-again/04-04-SUMMARY.md
  modified:
    - src/routes/room/[code]/+page.svelte
    - src/lib/components/EndScreen.svelte
    - src/lib/protocol/messages.ts
    - src/lib/stores/room.svelte.ts
    - party/game-room.ts
    - tests/unit/EndScreen.test.ts
    - tests/unit/room-store.test.ts
    - tests/unit/protocol.test.ts

key-decisions:
  - "Dropped the full frozen board from EndScreen after human verification — the board→frozen-board size/layout transition was jarring. Replaced with a 64×64 WinLineIcon plus gold chips listing the actual winning words. Winner and non-winner now share the same visual vocabulary (icon + chips) differentiated only by the BINGO! wordmark, subline copy, and host CTA."
  - "Added winningWords to the winDeclared broadcast instead of deriving on each client — non-winners don't have the winner's board (BOAR-03), so the server must compute the words from the winner's BoardCell[] at broadcast time. Added as a v.array(v.string()) field on ServerMessage and a string[] in the store."
  - "Moved Start new game CTA above other EndScreen elements in an earlier fix; reverted to below-icon after the frozen board was removed (natural reading order: heading → icon → subline → words → CTA)."

patterns-established:
  - "Per-branch derived props via {@const}: compute gridTier/gridSize once at the {:else if} block boundary rather than threading as a store field."
  - "Click-until-BINGO Playwright idiom: iterate board buttons with per-click timeout + break on expected state, because the source component unmounts mid-iteration."
  - "Server-enriched broadcasts over client-derived state when a trust boundary (private board layouts) prevents clients from computing the value themselves."

requirements-completed: [WIN-03, WIN-04, WIN-05]

# Metrics
duration: ~45min
completed: 2026-04-18
---

# Phase 4 Plan 4: EndScreen Route Wiring + Win/Reset e2e Summary

**EndScreen mounted in the /room/[code] phase conditional, two-browser Playwright flow covering win + play-again, and a UX pivot that replaced the frozen board with a WinLineIcon + winning-word chips after human verification caught the board-size transition as jarring.**

## Performance

- **Duration:** ~45 minutes (including human-verify cycle with 4 visual fixes)
- **Started:** 2026-04-18T10:58:53+04:00 (Task 1 commit)
- **Completed:** 2026-04-18T11:38:54+04:00 (last fix commit)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 8 (+ 1 e2e spec created, + 1 summary)

## Accomplishments

- **Phase conditional expanded** from two branches (`playing`/`lobby`) to three (`playing`/`ended`/`lobby`) in `+page.svelte` with all nine EndScreen props correctly derived from the room store.
- **Winner-only board passthrough** — non-winners receive `board={null}`, preserving BOAR-03 (private layouts) through game end.
- **Two-browser e2e** in `win-and-reset.spec.ts`: test 1 asserts both players see EndScreen variants within 1.5s of row completion; test 2 asserts host `Start new game` returns both browsers to lobby with words retained.
- **EndScreen redesigned** during human-verify: dropped the full frozen board (jarring resize), added `WinLineIcon` + gold winning-word chips. Both variants now share the same visual vocabulary.
- **winningWords field** added to the `winDeclared` broadcast so non-winners — who never see the winner's board — still render the exact words that completed the line.

## Task Commits

Task 1 — Wire EndScreen into phase conditional:
1. `2870b9b` — `feat(04-04): wire EndScreen into room page phase conditional`

Task 2 — Two-browser Playwright spec:
2. `219d96b` — `test(04-04): add two-browser e2e for win + play-again flow`

Task 3 — Human verification (approved after 4 visual fixes):
3. `19a0cca` — `fix(04-04): move Start new game above board, constrain board grid to max-w-xs`
4. `060e195` — `fix(04-04): remove frozen board from EndScreen, add WinLineIcon to winner view`
5. `3689a4d` — `fix(04-04): restore frozen board at full width, derive cols from board.length`
6. `f79eed6` — `fix(04-04): WinLineIcon + winning word chips on EndScreen, drop full frozen board`

## Files Created/Modified

**Created:**
- `e2e/win-and-reset.spec.ts` — Two-browser Playwright spec; helpers copied verbatim from `board-mark.spec.ts`. Two tests: `both players see EndScreen within 1.5s of win` and `host starts new game, both players return to lobby with words retained`.

**Modified:**
- `src/routes/room/[code]/+page.svelte` — Added `EndScreen` + `deriveGridTier` imports, `WinningLine` type import, `phase` derivation, `{:else if phase === "ended"}` branch with `{@const}` gridTier/gridSize derivations and all 10 EndScreen props (including new `winningWords`). RoomStore TypeScript interface extended with `winner` / `winningLine` / `winningCellIds` / `startNewGame()`.
- `src/lib/components/EndScreen.svelte` — Removed full frozen board. Added `WinLineIcon` to the winner branch (it was previously non-winner only). Added `winningWords: string[]` prop and gold-chip rendering block (`bg-[var(--color-accent)] text-[var(--color-ink-inverse)]`). Subline copy adjusted: winner sees "You called it. {label}.", non-winner sees "{label} completed."
- `src/lib/protocol/messages.ts` — Added `winningWords: v.array(v.string())` to the `winDeclared` ServerMessage variant.
- `src/lib/stores/room.svelte.ts` — Added `winningWords` `$state<string[]>([])` + getter; populated in `winDeclared` handler, cleared in `gameReset` handler.
- `party/game-room.ts` — In the win-broadcast block, compute `winningWords` by mapping `winningCellIds` through the winner's `myBoard` and filtering out blanks/nulls, then include in the `winDeclared` payload.
- `tests/unit/EndScreen.test.ts` — Updated existing tests + added coverage for `winningWords` prop and the new shared WinLineIcon branch.
- `tests/unit/room-store.test.ts` — Updated winDeclared/gameReset tests to assert `winningWords` handling.
- `tests/unit/protocol.test.ts` — Updated winDeclared schema test to include `winningWords`.

## Decisions Made

1. **Frozen board removed from EndScreen.** Human verification showed the board→frozen-board transition was jarring (size/column count shifted mid-animation). Replaced with a small 64×64 `WinLineIcon` shown on BOTH winner and non-winner views. The winning words themselves are rendered as gold chips below the icon so players still see *what* was completed without needing the full grid.
2. **Server broadcasts `winningWords`.** Non-winners never receive the winner's board (BOAR-03), so they cannot derive the words client-side. Adding the field to the `winDeclared` payload is a small cost (≤5 strings) and keeps the two variants visually consistent.
3. **Winner-only board prop retained** in the EndScreen props signature even though the component no longer renders a frozen grid — this preserves flexibility for a future cosmetic (e.g., winner-only confetti intensity scaling from board density) and keeps the trust-boundary guard in place at the route level.

## Deviations from Plan

### [Rule 2 - Missing Critical] Added `winningWords` to winDeclared broadcast

- **Found during:** Task 3 (human-verify review cycle)
- **Issue:** The plan's EndScreen design relied on a frozen board to show the winning words to the winner; non-winners saw only a mini-grid icon with no word context. Human verification revealed the winner's full frozen board caused a jarring layout transition. Removing the board eliminated the winner's word context; adding words to the non-winner view required them on the wire.
- **Fix:** Added `winningWords: string[]` to the `winDeclared` ServerMessage variant. Server derives from the winner's `BoardCell[]` at broadcast time (filtering blanks/nulls). Store exposes via getter. EndScreen renders as gold chips below the WinLineIcon on both variants.
- **Files modified:** `party/game-room.ts`, `src/lib/protocol/messages.ts`, `src/lib/stores/room.svelte.ts`, `src/lib/components/EndScreen.svelte`, `src/routes/room/[code]/+page.svelte`, unit tests
- **Verification:** Unit tests pass (284/284); human verified the gold chips render on both host and peer views.
- **Committed in:** `f79eed6`

### [Rule 1 - UX Bug] EndScreen frozen board → WinLineIcon + chips

- **Found during:** Task 3 (human-verify step 8)
- **Issue:** The plan called for the winner's frozen board to render below the BINGO! heading. In practice this caused a visible resize between the live game board (tight grid, variable width) and the frozen board (full-width, different spacing). Confetti fired *before* the resize settled, making the celebration feel disjointed.
- **Fix:** Iterated through four fixes (`19a0cca` → `060e195` → `3689a4d` → `f79eed6`). Final design: drop the full frozen board entirely; keep a 64×64 `WinLineIcon` (already built for the non-winner view) on both variants; render the winning words as gold chips. Both variants now share the same visual vocabulary, differentiated only by the BINGO! wordmark (winner) vs "{name} got Bingo!" heading (non-winner) and the host-only CTA.
- **Files modified:** `src/lib/components/EndScreen.svelte`, `tests/unit/EndScreen.test.ts`, `src/routes/room/[code]/+page.svelte` (prop wiring)
- **Verification:** Human approved after fix `f79eed6`.
- **Committed in:** `19a0cca`, `060e195`, `3689a4d`, `f79eed6`

---

**Total deviations:** 2 auto-fixed (1 missing-critical broadcast field, 1 UX bug fixed across 4 iteration commits).
**Impact on plan:** All auto-fixes strengthened the visible user experience at the plan's core human-verify checkpoint. No scope creep; the final surface area matches the plan's intent (phase conditional + e2e + verification) with a better EndScreen visual.

## Issues Encountered

- **Playwright race with Board unmount.** First attempt at the e2e spec used `await cell.click()` without a per-click timeout. The Board component unmounts the moment the server broadcasts `winDeclared`, so iterating *after* the winning click always hit "element detached from DOM". Resolved by wrapping each click in a 1s timeout try/catch and breaking out of the loop the instant `BINGO!` is visible. See the comment in `win-and-reset.spec.ts` for the pattern.

## User Setup Required

None — no external service configuration.

## Verification

- `pnpm run test:unit` — 284 / 284 passing (16 files).
- `pnpm run build` — clean (svelte-check no errors).
- `pnpm run test:e2e -- e2e/win-and-reset.spec.ts` — both tests green (passed before human-verify checkpoint approval).
- Human verification — **approved** after 4 visual iteration commits.

## Next Phase Readiness

- **Phase 4 complete.** All five success criteria met: server declares winner, winner sees BINGO! + confetti, all clients see consistent celebration, host-only CTA, play-again returns everyone to lobby with words retained.
- **Phase 5 (resilience) prerequisite:** the `phase === "ended"` state is now observable from both sides of the wire; the Phase 5 reconnect/resume protocol must include `winner`/`winningLine`/`winningCellIds`/`winningWords` in the hydration payload so a late-joiner or reconnecting client lands on the EndScreen instead of an empty board.

## Self-Check: PASSED

Verified on disk and in git log:

- FOUND: `e2e/win-and-reset.spec.ts`
- FOUND: `.planning/phases/04-win-detection-announcement-play-again/04-04-SUMMARY.md`
- FOUND commit: `2870b9b` (Task 1 — EndScreen wired)
- FOUND commit: `219d96b` (Task 2 — e2e spec)
- FOUND commit: `19a0cca` (fix 1/4)
- FOUND commit: `060e195` (fix 2/4)
- FOUND commit: `3689a4d` (fix 3/4)
- FOUND commit: `f79eed6` (fix 4/4 — final approved)

---
*Phase: 04-win-detection-announcement-play-again*
*Completed: 2026-04-18*
