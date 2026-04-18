---
phase: 04-win-detection-announcement-play-again
plan: 03
subsystem: client-tier-win-and-reset
tags: [phase-4, svelte5, runes, client-store, end-screen, win-line-icon, confetti]
dependency-graph:
  requires:
    - src/lib/protocol/messages.ts (Phase 4 Plan 01 — WinningLine, winDeclared, gameReset, startNewGame)
    - src/lib/util/winLine.ts (Phase 4 Plan 01 — formatWinLine, winLineCellIndices)
    - src/lib/components/BoardCell.svelte (Phase 3 — accepts onToggle={undefined})
    - src/lib/components/Button.svelte (Phase 1 — primary variant + children snippet)
    - src/lib/stores/room.svelte.ts (Phase 3 — existing handler switch + Set-reassignment pattern)
  provides:
    - room store winDeclared + gameReset handlers
    - room store startNewGame() sender
    - room store getters: winner, winningLine, winningCellIds
    - src/lib/components/WinLineIcon.svelte (64x64 mini-grid icon)
    - src/lib/components/EndScreen.svelte (composition root for phase=="ended")
    - canvas-confetti dependency (dynamic import, SSR-safe)
  affects:
    - Plan 04 (route wiring) — +page.svelte imports EndScreen + calls store.startNewGame()
tech-stack:
  added:
    - canvas-confetti ^1.9.4 (dependency)
    - "@types/canvas-confetti" ^1.9.0 (devDependency)
  patterns:
    - Dynamic import("canvas-confetti") inside message handler for SSR safety
    - Winner-only confetti guard (msg.winnerId === player.playerId)
    - Reduced-motion config branch via window.matchMedia
    - Literal grid-cols-N tokens via $derived ternary (Tailwind v4 Oxide scanner safety)
    - data-win-line="true" wrapper attribute around BoardCell for ring-pulse animation
    - Frozen board via pointer-events-none grid + onToggle={undefined}
    - Explicit gridSize prop on EndScreen/WinLineIcon (derived by caller from gridTier)
    - vi.mock("canvas-confetti", () => ({ default: vi.fn() })) + await vi.waitFor for async import
key-files:
  created:
    - ai/bs-bingo/src/lib/components/WinLineIcon.svelte
    - ai/bs-bingo/src/lib/components/EndScreen.svelte
    - ai/bs-bingo/tests/unit/WinLineIcon.test.ts
    - ai/bs-bingo/tests/unit/EndScreen.test.ts
    - ai/bs-bingo/.planning/phases/04-win-detection-announcement-play-again/04-03-SUMMARY.md
  modified:
    - ai/bs-bingo/src/lib/stores/room.svelte.ts
    - ai/bs-bingo/tests/unit/room-store.test.ts
    - ai/bs-bingo/package.json
    - ai/bs-bingo/pnpm-lock.yaml
decisions:
  - EndScreen takes gridSize as explicit prop (3 | 4 | 5) — simpler than deriving from board, works in non-winner branch where board is null. Caller (Plan 04 +page.svelte) derives via existing gridTier utility from roomState.words.length.
  - Confetti fires inside the message handler (not $effect) — ensures it does NOT re-fire on reconnect-replay. This is Pitfall 8 compliance deferred from this plan into Phase 5 where replay is actually handled.
  - Dynamic import("canvas-confetti") with .catch() → silent failure — EndScreen still renders if the module fails to load.
  - All colors use CSS variables (--color-accent, --color-ink-primary, --color-ink-secondary, --color-divider, --color-surface). The only raw hex literals are the three confetti particle colors ["#F5D547","#F5F5F7","#F87171"] — canvas-confetti takes a string colors array, not CSS vars, so these mirror the token values at their source of truth.
metrics:
  duration: ~45 minutes
  completed: 2026-04-18T10:46:00Z
  tasks_completed: 3
  tests_added: 30 (7 room-store + 8 WinLineIcon + 15 EndScreen)
  tests_passing: 264/264 (full suite)
requirements: [WIN-03, WIN-04, WIN-05]
---

# Phase 4 Plan 3: Client Store + WinLineIcon + EndScreen Summary

Delivered the client tier of Phase 4: winDeclared/gameReset message handlers with winner-only confetti, the WinLineIcon mini-grid component, and the EndScreen composition root — all covered by 30 new unit tests, 264/264 suite green, and SSR build clean.

## What Was Built

### 1. canvas-confetti dependency (`package.json`)

- `canvas-confetti`: `^1.9.4` (dependencies)
- `@types/canvas-confetti`: `^1.9.0` (devDependencies)

Loaded via dynamic `import("canvas-confetti")` inside the winDeclared handler — never bundled into SSR output. Confirmed via `pnpm run build` exit 0.

### 2. Room store additions (`src/lib/stores/room.svelte.ts`)

New imports:
```ts
import { type WinningLine } from "$lib/protocol/messages";
```

New reactive `$state`:
```ts
let winner = $state<{ playerId: string; displayName: string } | null>(null);
let winningLine = $state<WinningLine | null>(null);
let winningCellIds = $state<string[]>([]);
```

New switch cases inside the existing `ws.addEventListener("message", ...)`:

- **`winDeclared`** — Sets all three new fields, flips `state.phase` to `"ended"`, and (only on the winner's client, only in a browser) dynamically imports canvas-confetti and fires a reduced-motion-aware burst with colors `["#F5D547", "#F5F5F7", "#F87171"]`. Non-reduced config: 180 particles, spread 90, startVelocity 45, ticks 220, origin y=0.25. Reduced-motion config: 60 particles, spread 90, ticks 100.
- **`gameReset`** — Clears all 7 game-scoped fields: `board=null`, `markedCellIds=new Set()`, `playerMarks={}`, `winner=null`, `winningLine=null`, `winningCellIds=[]`, and flips `state.phase` to `"lobby"`. Preserves `state.words`, `state.players`, `state.hostId`, `state.usedPacks`.

New public API:
```ts
get winner(): { playerId: string; displayName: string } | null
get winningLine(): WinningLine | null
get winningCellIds(): string[]
startNewGame(): void   // emits JSON.stringify({ type: "startNewGame" }) over the WS
```

### 3. `src/lib/components/WinLineIcon.svelte` (new)

Props:
```ts
{
  gridSize: 3 | 4 | 5;
  winningLine: WinningLine;
}
```

Renders a 64x64 (`w-16 h-16`) dark-surface card with N×N cells; cells at indices from `winLineCellIndices(winningLine, gridSize)` use `bg-[var(--color-ink-primary)]` (white #F5F5F7), others use `bg-[var(--color-divider)]` (#2A2A36). Root has `role="img"` + `aria-label="Winning line indicator"`.

Literal `grid-cols-3 | grid-cols-4 | grid-cols-5` picked via `$derived` ternary — required for Tailwind v4 Oxide scanner to emit the classes.

### 4. `src/lib/components/EndScreen.svelte` (new)

Props (exported type signature):
```ts
{
  winner: { playerId: string; displayName: string };
  winningLine: WinningLine;
  winningCellIds: string[];
  board: BoardCell[] | null;
  markedCellIds: Set<string>;
  isHost: boolean;
  isWinner: boolean;
  gridSize: 3 | 4 | 5;          // caller derives via gridTier(words.length)
  onStartNewGame: () => void;
}
```

Render paths:

- **Winner branch (`isWinner=true`)** — Display wordmark `"BINGO!"` in `font-display text-[40px] sm:text-[56px] text-[var(--color-accent)]` with `aria-live="polite"`; winner display name; `"You called it. {winLineLabel}."` subline; frozen board grid with `pointer-events-none` and one wrapper div per cell. Wrappers whose `cellId ∈ winningCellIds` get `data-win-line="true"` (matches the CSS selector appended in Plan 01's app.css for the ring-pulse). Inner BoardCell receives `onToggle={undefined}` — non-interactive.
- **Non-winner branch (`isWinner=false`)** — `"{winner.displayName} got Bingo!"` heading with `aria-live="polite"`; WinLineIcon; `"{winLineLabel} completed."` subline; `"Nice try. One more round?"` closing. Never renders the board — preserves BOAR-03 (private layouts).
- **Host CTA (`isHost=true`)** — primary `Button` with children `"Start new game"` wired to `onStartNewGame`; helper `"Word pool and players are kept. You can tweak the pool before starting."`
- **Non-host footer (`isHost=false`)** — `"Waiting for the host to start a new game."` helper, no button.

### 5. Test additions

- `tests/unit/room-store.test.ts` — new `describe("createRoomStore — Phase 4 (win + reset)")` with 7 tests (S1-S7). Module-level `vi.mock("canvas-confetti", () => ({ default: confettiMock }))` + `await vi.waitFor(...)` for the async dynamic import.
- `tests/unit/WinLineIcon.test.ts` — 8 tests (I1-I8) covering gridSize×type×index combinations via the `mount`/`unmount` harness.
- `tests/unit/EndScreen.test.ts` — 15 tests (E1-E15) covering winner/non-winner/host/non-host variants, aria-live, `data-win-line`, copy strings, and host button callback.

## CSS Tokens Used (no raw hex outside the confetti array)

| Token | Value | Used for |
|-------|-------|----------|
| `--color-accent` | `#F5D547` | `BINGO!` wordmark |
| `--color-ink-primary` | `#F5F5F7` | Winner name, heading, WinLineIcon highlighted cells |
| `--color-ink-secondary` | `#A0A0B0` | Sublines, helper text |
| `--color-divider` | `#2A2A36` | WinLineIcon dim cells, border |
| `--color-surface` | `#1A1A23` | WinLineIcon container bg |

The only raw hex literals in the new code are the three confetti colors `["#F5D547", "#F5F5F7", "#F87171"]` — canvas-confetti's `colors` option takes literal strings, not CSS variables, so these mirror the token values at their source-of-truth.

## Deviations from Plan

### [Rule 3 - Tooling] Package manager

- **Plan said:** `npm install canvas-confetti`
- **Actual:** `pnpm add canvas-confetti` / `pnpm add -D @types/canvas-confetti`
- **Reason:** Repo uses pnpm (pnpm-lock.yaml present, no package-lock.json). Matched existing tooling.
- **Impact:** `pnpm-lock.yaml` changed instead of `package-lock.json`. All `npm run ...` commands in the plan map cleanly to `pnpm run ...` with the same scripts.

No other deviations. Behavior, prop signatures, tests, and acceptance criteria match the plan.

## Verification

- `pnpm run test:unit -- tests/unit/room-store.test.ts` — 29 tests pass (was 22 before Task 1, +7 new).
- `pnpm run test:unit -- tests/unit/WinLineIcon.test.ts` — 8 tests pass (file created in Task 2).
- `pnpm run test:unit -- tests/unit/EndScreen.test.ts` — 15 tests pass (file created in Task 3).
- `pnpm run test:unit` full suite — **264 / 264 passing** (16 files).
- `pnpm run build` — exits 0; canvas-confetti stays out of SSR output.

## Commits

- `53bbd5e` — `feat(04-03): add winDeclared/gameReset handlers + startNewGame sender`
- `daaf440` — `feat(04-03): add WinLineIcon component + unit tests`
- `84cb649` — `feat(04-03): add EndScreen composition component + unit tests`

## Self-Check: PASSED

All created files exist on disk; all recorded commit hashes exist in the worktree branch.

- FOUND: src/lib/components/WinLineIcon.svelte
- FOUND: src/lib/components/EndScreen.svelte
- FOUND: tests/unit/WinLineIcon.test.ts
- FOUND: tests/unit/EndScreen.test.ts
- FOUND: .planning/phases/04-win-detection-announcement-play-again/04-03-SUMMARY.md
- FOUND commit: 53bbd5e (Task 1)
- FOUND commit: daaf440 (Task 2)
- FOUND commit: 84cb649 (Task 3)
