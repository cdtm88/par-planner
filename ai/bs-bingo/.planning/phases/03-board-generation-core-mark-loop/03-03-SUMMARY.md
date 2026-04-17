---
phase: 03-board-generation-core-mark-loop
plan: 03
subsystem: ui
tags: [svelte5, runes, websocket, valibot, tailwind, testing, boardcell, store]

requires:
  - phase: 03-board-generation-core-mark-loop/plan-01
    provides: BoardCell type, boardAssigned/wordMarked ServerMessage variants, markWord ClientMessage variant
  - phase: 02-lobby-gameplay-word-submission-start
    provides: createRoomStore factory pattern, $state/$derived runes patterns, MockPartySocket test harness

provides:
  - Extended createRoomStore with board (BoardCell[]|null), playerMarks (Record<string,number>), markedCellIds (Set<string>) reactive state
  - toggleMark(cellId) method — optimistic local flip + markWord WS send
  - boardAssigned handler — populates board and resets markedCellIds to empty Set
  - wordMarked handler — immutable playerMarks update via object spread
  - BoardCell.svelte — leaf component with three visual states (unmarked/marked/blank-inert)

affects:
  - 03-04 (Board.svelte composes BoardCell + consumes store.board/markedCellIds/toggleMark)
  - 03-05 (PlayerRow markCount badge reads store.playerMarks)

tech-stack:
  added: []
  patterns:
    - Svelte 5 $state<Set> reassignment pattern for toggleMark (Pitfall 3 — never .add/.delete on existing Set)
    - Svelte 5 $state<Record> spread-reassignment for playerMarks (same reactivity constraint)
    - aria-pressed="true"/"false" string literal workaround (Svelte 5 boolean aria-* removes attribute when false)
    - Svelte 5 mount()/unmount() in Vitest for component testing without @testing-library/svelte

key-files:
  created:
    - src/lib/components/BoardCell.svelte
    - tests/unit/BoardCell.test.ts
  modified:
    - src/lib/stores/room.svelte.ts
    - tests/unit/room-store.test.ts

key-decisions:
  - "aria-pressed rendered as string literal 'true'/'false' (not boolean) to ensure getAttribute returns the string — Svelte 5 drops boolean false aria-* attributes from DOM"
  - "BoardCell blank branch uses <div aria-hidden tabindex=-1> never <button> (Pitfall 6) — no click handler possible on blank cells"
  - "toggleMark reassigns markedCellIds = new Set(...) on every call — in-place .add()/.delete() on $state<Set> does not trigger reactivity in Svelte 5 runes"

patterns-established:
  - "Store getter pattern: expose $state via get board() { return board; } in return object — allows reactive reads from templates"
  - "Component test pattern: mount(Component, { target: container, props }) + afterEach unmount() — portable, no @testing-library dependency"
  - "Svelte 5 class array join: class={[...classTokens].join(' ')} — collapses conditional classes to single className string without clsx"

requirements-completed: [BOAR-04, BOAR-05]

duration: 3min
completed: 2026-04-17
---

# Phase 03 Plan 03: Room Store Board State + BoardCell Component Summary

**Reactive room store gains board/playerMarks/markedCellIds + toggleMark(); BoardCell.svelte covers unmarked/marked/blank-inert visual states with 44px tap targets and full aria semantics**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T21:27:00Z
- **Completed:** 2026-04-17T21:30:00Z
- **Tasks:** 4 (2 TDD pairs)
- **Files modified:** 4

## Accomplishments

- Room store extended with three new `$state` fields (`board`, `playerMarks`, `markedCellIds`), two new message handlers (`boardAssigned`, `wordMarked`), and `toggleMark()` — all using Svelte 5 reassignment idiom to avoid Pitfall 3
- `toggleMark(cellId)` does optimistic local flip via `new Set(markedCellIds)` + `ws.send(markWord)` — server confirms/corrects; no ack needed per UI-SPEC
- `BoardCell.svelte` renders three states: unmarked (surface bg, ink-primary text), marked (accent `#F5D547` bg, ink-inverse text), blank-inert (`<div aria-hidden tabindex=-1>`, dashed border, no text)
- 22 room-store tests + 16 BoardCell tests all passing; full 180-test suite green

## Task Commits

1. **Task 1: Extend room-store tests (RED)** - `6567aba` (test)
2. **Task 2: Extend room store implementation (GREEN)** - `c52281c` (feat)
3. **Task 3: Write failing BoardCell tests (RED)** - `13f6f60` (test)
4. **Task 4: Implement BoardCell.svelte (GREEN)** - `32a36b1` (feat)

## Files Created/Modified

- `src/lib/stores/room.svelte.ts` — Added `board`/`playerMarks`/`markedCellIds` `$state` fields, `boardAssigned`/`wordMarked` handlers, `toggleMark()` method, three new getters in return object
- `src/lib/components/BoardCell.svelte` — Single-cell leaf component; blank branch `<div aria-hidden>`, word branch `<button>` with `aria-pressed`/`aria-label`, D-12/D-13 color classes, `min-h-11 min-w-11 aspect-square`
- `tests/unit/room-store.test.ts` — 11 new tests appended: initial state checks, boardAssigned/wordMarked handlers, toggleMark optimistic flip + Set reference reassignment
- `tests/unit/BoardCell.test.ts` — 16 tests across two describe blocks: word cell (button, text, classes, aria, click) and blank cell (no button, aria-hidden, no text, dashed border, no click)

## Decisions Made

- `aria-pressed` uses string literal `"true"/"false"` (not boolean `{marked}`) — Svelte 5 removes `aria-pressed` from DOM when value is `false`, causing `getAttribute("aria-pressed")` to return `null` and the unmarked test to fail. String literal ensures the attribute is always present.
- No `@testing-library/svelte` — used Svelte 5 `mount()/unmount()` directly. More portable, avoids an extra dev dependency, and works identically in jsdom.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `aria-pressed={marked}` (boolean) caused Svelte 5 to omit the attribute when `false`, breaking the `getAttribute("aria-pressed") === "false"` test. Fixed by using `aria-pressed={marked ? "true" : "false"}` per the plan's noted caveat.
- Pre-existing `game-room.test.ts` failure (from Plan 02 RED tests) present in the worktree base — out of scope for this plan; documented and left for Plan 02's agent to resolve.
- `npx tsc --noEmit` reports errors only in `.svelte-kit/` generated build output — pre-existing framework-generated issues, same as noted in Plan 01 summary. Source files have no TypeScript errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 04 (`Board.svelte` grid) can import `BoardCell.svelte` and consume `store.board`, `store.markedCellIds`, `store.toggleMark` immediately
- Plan 05 (`PlayerRow` mark badge) can read `store.playerMarks[playerId]` directly
- Store API is stable: three new getters + `toggleMark()` are the full contract Plan 04 needs

## Known Stubs

None — all reactive state is wired to real WS message handlers. `board` starts `null` (intentional — no board until `boardAssigned` arrives); `playerMarks` starts `{}` (intentional — no marks yet). Both are real state transitions, not stubs.

---
*Phase: 03-board-generation-core-mark-loop*
*Completed: 2026-04-17*
