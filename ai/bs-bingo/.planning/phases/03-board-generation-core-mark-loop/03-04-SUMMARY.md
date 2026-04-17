---
phase: 03-board-generation-core-mark-loop
plan: 04
subsystem: ui
tags: [svelte5, runes, tailwind, playwright, testing, board, playerrow, websocket]

requires:
  - phase: 03-board-generation-core-mark-loop/plan-03
    provides: BoardCell.svelte leaf component, room store board/playerMarks/markedCellIds/$state, toggleMark() method
  - phase: 03-board-generation-core-mark-loop/plan-02
    provides: server-side startGame→boardAssigned→markWord→wordMarked flow in game-room.ts
  - phase: 03-board-generation-core-mark-loop/plan-01
    provides: BoardCell type, boardAssigned/wordMarked ServerMessage variants, markWord ClientMessage variant

provides:
  - Board.svelte CSS grid container — maps cells[] to BoardCell components, derives grid columns from board length (9→3, 16→4, 25→5), shows "Dealing your board…" when cells is null
  - PlayerRow.svelte extended with optional markCount prop and accent pill badge (data-testid="mark-badge")
  - Room page gameStarted branch: replaces "Game on!" stub with live Board + PlayerRow markCount wiring
  - e2e two-browser mark round-trip: both players see board, host marks, peer badge updates within 1s (BOAR-06)

affects:
  - Phase 4 (win detection) — can read mark state via markedCellIds and observe board layout
  - Phase 5 (resilience) — Board and PlayerRow are the primary UI surfaces for reconnect testing

tech-stack:
  added: []
  patterns:
    - Board column derivation via literal Tailwind tokens in ternary — grid-cols-3/4/5 appear as string literals so Tailwind v4 scanner includes them (not template literals)
    - Svelte 5 class array join for Board grid container — class={["grid w-full gap-2", colsClass].join(" ")}
    - PlayerRow markCount default via $props() destructuring default — let { player, markCount = 0 } eliminates undefined checks in template
    - data-testid="mark-badge" on accent pill span — stable Playwright selector independent of CSS class tokens
    - HTMLElement.prototype.animate stub in beforeAll() — required for jsdom to mount components with Svelte fade transitions
    - Wrangler dev build cache invalidation — running npm run build before e2e tests when source changes aren't reflected in .svelte-kit/cloudflare

key-files:
  created:
    - src/lib/components/Board.svelte
    - tests/unit/Board.test.ts
    - tests/unit/PlayerRow.test.ts
    - e2e/board-mark.spec.ts
  modified:
    - src/lib/components/PlayerRow.svelte
    - src/routes/room/[code]/+page.svelte

key-decisions:
  - "Board.svelte uses onToggle (not onToggleMark) prop name — matches plan task action code; PATTERNS.md used onToggleMark but the task's explicit code block took precedence"
  - "HTMLElement.prototype.animate stubbed in beforeAll() in PlayerRow.test.ts — Svelte fade transition calls element.animate which jsdom lacks; BoardCell tests passed because BoardCell has no transitions"
  - "Build required before e2e — wrangler dev reuseExistingServer served stale .svelte-kit/cloudflare output; npm run build rebuilt assets before tests could pass"
  - "grid-cols-3/4/5 as literal string tokens in ternary (not template literals) — ensures Tailwind v4 scanner picks up all three column classes"

patterns-established:
  - "PlayerRow test pattern: beforeAll() HTMLElement.prototype.animate stub for components using Svelte transitions in jsdom"
  - "Board column derivation: colsClass ternary with literal string tokens — ensures Tailwind scanner visibility"
  - "E2e data-testid selectors over CSS class selectors — more resilient to visual design changes"

requirements-completed: [BOAR-04, BOAR-05, BOAR-06, BOAR-07]

duration: 20min
completed: 2026-04-17
---

# Phase 03 Plan 04: Board.svelte Grid + PlayerRow Marks + Room Page Wiring Summary

**CSS grid Board component composing BoardCell, PlayerRow extended with accent mark-count pill, and room page gameStarted branch wired end-to-end — BOAR-06 peer badge update confirmed at 974ms in e2e**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-17T21:33:00Z
- **Completed:** 2026-04-17T21:45:00Z
- **Tasks:** 4 (2 TDD pairs + 2 feature tasks)
- **Files modified:** 6

## Accomplishments

- `Board.svelte` renders a 3×3/4×4/5×5 CSS grid derived from `cells.length` (9/16/25), shows "Dealing your board…" empty state when `cells === null`, delegates each cell to `BoardCell` with `marked` and `onToggle` props
- `PlayerRow.svelte` extended with optional `markCount` prop (default 0) — accent `#F5D547` pill badge with `data-testid="mark-badge"` and `aria-label` for screen readers; host badge + mark badge coexist; Phase 2 lobby path unchanged
- Room page `{#if gameStarted}` branch replaces the "Game on!" stub with players strip (PlayerRow with markCount) + Board grid; Phase 2 lobby `{:else}` branch untouched
- 4 e2e Playwright tests prove the full BOAR-05/06 loop: both players see board, host marks, peer badge updates in **974ms** (within 1500ms budget); mark toggle (unmark) confirmed

## Task Commits

1. **Task 1: PlayerRow tests (RED)** - `d1a8d0a` (test)
2. **Task 1: PlayerRow implementation (GREEN)** - `82474c9` (feat)
3. **Task 2: Board tests (RED)** - `f49aa52` (test)
4. **Task 2: Board implementation (GREEN)** - `d9831cd` (feat)
5. **Task 3: Room page wiring** - `018ded2` (feat)
6. **Task 4: e2e board-mark spec** - `8a5b04f` (test)

## Files Created/Modified

- `src/lib/components/Board.svelte` — CSS grid container; colsClass ternary with literal grid-cols-3/4/5 tokens; empty state; BoardCell each loop keyed by cellId
- `src/lib/components/PlayerRow.svelte` — Added markCount prop with default 0; accent pill span with data-testid and aria-label; placed after host badge block
- `src/routes/room/[code]/+page.svelte` — Added Board import, BoardCell type import, four RoomStore interface fields (board/playerMarks/markedCellIds/toggleMark); replaced gameStarted stub with section containing players list + Board component
- `tests/unit/PlayerRow.test.ts` — 8 tests: no-badge when undefined/0, pill when 1/12, text-color class, aria-label singular/plural, host+markCount coexistence; beforeAll animate stub
- `tests/unit/Board.test.ts` — 11 tests: null empty state, 3×3/4×4/5×5 column derivation, gap-2, w-full, cell count, blank→aria-hidden, marked styling, click→onToggle, blank click no-op
- `e2e/board-mark.spec.ts` — 4 tests: both see board, acting player badge within 1s, peer badge within 1s (BOAR-06), mark toggle removes badge

## Decisions Made

- `onToggle` used as Board prop name instead of `onToggleMark` from PATTERNS.md — the plan's task action code explicitly used `onToggle` and that's what the test file imports
- `HTMLElement.prototype.animate = () => {...}` in `beforeAll()` — jsdom lacks Web Animations API; Svelte's `fade` transition calls it; solution is a no-op stub per-test-file
- Built `.svelte-kit/cloudflare` before e2e — `reuseExistingServer: !process.env.CI` caused stale assets to be served; `npm run build` regenerated the output with new Board/PlayerRow code
- `data-testid="mark-badge"` added as part of Task 1 implementation (not Task 4) — the plan explicitly prescribed adding it for e2e selector stability, and it was included in the feat commit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stubbed HTMLElement.prototype.animate for Svelte fade transitions in jsdom**
- **Found during:** Task 1 (PlayerRow unit tests)
- **Issue:** PlayerRow uses `in:fade`/`out:fade` which calls `element.animate()` — not implemented in jsdom; caused `TypeError: element.animate is not a function` crashing all 8 tests
- **Fix:** Added `beforeAll(() => { HTMLElement.prototype.animate = () => ({...}) })` in `PlayerRow.test.ts`
- **Files modified:** `tests/unit/PlayerRow.test.ts`
- **Verification:** All 8 PlayerRow tests pass; no impact on BoardCell tests (no transitions there)
- **Committed in:** `d1a8d0a` (part of test commit)

**2. [Rule 3 - Blocking] Rebuilt SvelteKit assets before e2e tests**
- **Found during:** Task 4 (e2e board-mark tests)
- **Issue:** All 4 e2e tests failed — page showed old "Game on!" stub. Root cause: wrangler dev's `reuseExistingServer: true` served stale `.svelte-kit/cloudflare` from before Task 3's page changes
- **Fix:** Ran `npm run build` to regenerate `.svelte-kit/cloudflare` with updated page; killed stale wrangler process before re-running tests
- **Files modified:** `.svelte-kit/cloudflare/` (build artifacts, not committed)
- **Verification:** `grep "Game on" .svelte-kit/cloudflare/**/*.js` → 0 matches; all 4 e2e tests pass
- **Committed in:** No commit needed (build artifacts are gitignored)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes unblocked testing. No scope changes, no API changes, no feature additions.

## Issues Encountered

- The plan's PATTERNS.md used `onToggleMark` as Board prop but the task's explicit code block used `onToggle`. Used `onToggle` to match the action code since it was the more specific specification.
- `npx tsc --noEmit` reports errors only in `.svelte-kit/` generated build output — same pre-existing framework-generated issue noted in all prior Plan summaries; source files have no TypeScript errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- BOAR-04/05/06/07 all gated by automated tests (unit + e2e)
- Phase 4 (win detection) can import Board.svelte and read `store.markedCellIds` and `store.board` directly
- PlayerRow mark badge is ready for bingo win styling in Phase 4
- The `data-testid="mark-badge"` selector is stable for Phase 4/5 e2e tests

## Known Stubs

None — Board renders real server-delivered cells; PlayerRow badge reflects real `playerMarks` from WS broadcast; all data flows are live.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what Plan 02's threat model already covered. Client renders `cell.text` via `{cell.text}` in BoardCell (auto-escaped by Svelte, no XSS vector, per T-3-21 in plan's threat model).

## Self-Check: PASSED

All 7 files verified present. All 6 task commits verified in git log.

---
*Phase: 03-board-generation-core-mark-loop*
*Completed: 2026-04-17*
