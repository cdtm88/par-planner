# Phase 4: Win Detection, Announcement & Play-Again - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 14 (new + modified)
**Analogs found:** 14 / 14 — every new file has a role+flow match in the Phase 1/2/3 codebase; every modified file is a self-extension.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/protocol/messages.ts` | model (schema) | — | `src/lib/protocol/messages.ts` (self) — `BoardCell` + `wordMarked` variant append (Phase 3) | exact (in-place extension) |
| `src/lib/util/winLine.ts` (NEW) | utility | transform (pure) | `src/lib/util/shuffle.ts` + `src/lib/util/gridTier.ts` | role-match (pure function, no DOM, unit-testable without DO harness) |
| `party/game-room.ts` | service (DO actor) | event-driven | `party/game-room.ts` (self) — `markWord` handler (lines 299–327) + `startGame` handler (lines 269–297) | exact (append win-check tail + new `startNewGame` case) |
| `src/lib/stores/room.svelte.ts` | store | event-driven | `src/lib/stores/room.svelte.ts` (self) — `boardAssigned` + `wordMarked` handlers (lines 94–102) | exact (in-place extension: add `winner`/`winningLine`/`winningCellIds` state + 2 handlers + 1 sender) |
| `src/lib/components/EndScreen.svelte` (NEW) | component (page section) | — | `src/lib/components/Board.svelte` + conditional branches in `src/routes/room/[code]/+page.svelte` | role-match (section-level component composing `BoardCell` + `Button` + derived `gridSize`) |
| `src/lib/components/WinLineIcon.svelte` (NEW) | component (leaf, presentational) | — | `src/lib/components/Board.svelte` (grid-cols literal pattern) + `src/lib/components/Badge.svelte` | role-match (tiny grid with literal `grid-cols-N` derivation, no events) |
| `src/lib/components/BoardCell.svelte` | component (leaf) | — | `src/lib/components/BoardCell.svelte` (self) | exact — **unchanged**; ring glow is driven by a wrapper `data-win-line="true"` div and a global `@keyframes` in `src/app.css` (Assumption A5) |
| `src/app.css` | styling (global) | — | `src/app.css` (self) — `@keyframes shake` + `.shake` + reduced-motion rule | exact (append `@keyframes winLinePulse` + `[data-win-line="true"]` selector + reduced-motion fallback) |
| `src/routes/room/[code]/+page.svelte` | component (page) | event-driven | `src/routes/room/[code]/+page.svelte` (self) — `{#if gameStarted}…{:else}…{/if}` block (lines 146–285) | exact (expand to `{#if phase==='playing'}…{:else if phase==='ended'}<EndScreen/>{:else}…`) |
| `tests/unit/winLine.test.ts` (NEW) | test (unit) | — | `tests/unit/shuffle.test.ts` + `tests/unit/gridTier.test.ts` | role-match (pure-function unit test; deterministic input/output) |
| `tests/unit/EndScreen.test.ts` (NEW) | test (unit, component) | — | `tests/unit/Board.test.ts` | role-match (svelte `mount`/`unmount` with prop matrix) |
| `tests/unit/WinLineIcon.test.ts` (NEW) | test (unit, component) | — | `tests/unit/Board.test.ts` | role-match (svelte `mount`/`unmount`, assert class/style on internal cells) |
| `tests/unit/game-room.test.ts` | test (unit) | — | `tests/unit/game-room.test.ts` (self) — Phase 2/3 describe blocks + `vi.mock("partyserver", …)` scaffold (lines 50–93) | exact (append "GameRoom — win & reset (Phase 4)" describe) |
| `tests/unit/protocol.test.ts` | test (unit) | — | `tests/unit/protocol.test.ts` (self) | exact (append `v.safeParse` tests for `startNewGame`, `winDeclared`, `gameReset`, `WinningLine`, expanded `RoomState.phase`) |
| `tests/unit/room-store.test.ts` | test (unit) | — | `tests/unit/room-store.test.ts` (self) — `MockPartySocket` scaffold + existing handler tests | exact (append `winDeclared` + `gameReset` handler tests + `startNewGame` sender) |
| `e2e/win-and-reset.spec.ts` (NEW) | test (e2e) | request-response | `e2e/board-mark.spec.ts` | role-match (two-browser Playwright flow reusing `createRoom`/`joinRoom`/`seedWords` helpers) |

---

## Pattern Assignments

### `src/lib/protocol/messages.ts` (model, in-place extension)

**Analog:** self — currently 87 lines; mirror the Phase 3 `BoardCell` append + the existing `ServerMessage` / `ClientMessage` `v.variant` expansion.

**Imports pattern (line 1, unchanged):**
```typescript
import * as v from "valibot";
```

**Object-schema append pattern — copy shape of existing `BoardCell` (lines 21–27):**
```typescript
// EXISTING — the structural template for WinningLine
export const BoardCell = v.object({
  cellId: v.string(),
  wordId: v.nullable(v.string()),
  text: v.nullable(v.string()),
  blank: v.boolean(),
});
export type BoardCell = v.InferOutput<typeof BoardCell>;
```

**New `WinningLine` schema — insert above `RoomState`:**
```typescript
export const WinningLine = v.object({
  type: v.picklist(["row", "col", "diagonal"]),
  index: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type WinningLine = v.InferOutput<typeof WinningLine>;
```

**`RoomState.phase` union expansion — current (line 31):**
```typescript
// EXISTING
phase: v.union([v.literal("lobby"), v.literal("playing")]),
// TARGET
phase: v.union([v.literal("lobby"), v.literal("playing"), v.literal("ended")]),
```

**`ClientMessage` variant append — mirror existing no-payload variant (line 58):**
```typescript
// EXISTING template — zero-payload variant
v.object({ type: v.literal("startGame") }),
// APPEND
v.object({ type: v.literal("startNewGame") }),
```

**`ServerMessage` variant append — mirror existing `wordMarked` payload shape (lines 76–80) for the payloaded `winDeclared`, and the `gameStarted` shape (line 74) for the zero-payload `gameReset`:**
```typescript
// APPEND (after the existing wordMarked variant)
v.object({
  type: v.literal("winDeclared"),
  winnerId: v.pipe(v.string(), v.minLength(1)),
  winnerName: v.pipe(v.string(), v.minLength(1)),
  winningLine: WinningLine,
  winningCellIds: v.array(v.string()),
}),
v.object({ type: v.literal("gameReset") }),
```

---

### `src/lib/util/winLine.ts` (utility, NEW — pure function)

**Analog:** `src/lib/util/shuffle.ts` and `src/lib/util/gridTier.ts` — both are pure, Workers-safe, no DOM, fully unit-testable.

**File header + named export pattern (from `gridTier.ts` lines 1–6):**
```typescript
// Pure functions — used by EndScreen / WinLineIcon / game-room.ts and unit tests (winLine.test.ts)

export type GridTier = "3x3" | "4x4" | "5x5";
```

**Export-type-then-helper pattern (from `gridTier.ts`):**
```typescript
export const TIER_THRESHOLDS: Record<GridTier, number> = { "3x3": 5, "4x4": 12, "5x5": 21 };

export function deriveGridTier(wordCount: number): GridTier { … }
```

**Required exports (per RESEARCH Pattern 1):**
- `WinningLine` (type re-export or local — prefer importing from `$lib/protocol/messages` so there is one source of truth)
- `WinResult` (type)
- `detectWin(cells: BoardCell[], marks: Set<string>): WinResult | null`
- `formatWinLine(line: WinningLine): string` (source of truth for `aria-label` + EndScreen sub-copy)
- `winLineCellIndices(line: WinningLine, gridSize: 3 | 4 | 5): number[]` (used by `WinLineIcon.svelte`)

**Import pattern (from `BoardCell` consumer — `party/game-room.ts` line 27):**
```typescript
import type { BoardCell } from "$lib/protocol/messages";
```

---

### `party/game-room.ts` (service / DO, in-place extension)

**Analog:** self — the `startGame` handler (lines 269–297) is the closest analog for "host-guarded mutation + persist + broadcast", and `markWord` (lines 299–327) is the handler we extend.

**Host-only guard pattern (copy verbatim from `startGame` line 271, `loadStarterPack` line 246):**
```typescript
const connState = conn.state as { playerId?: string } | null;
if (connState?.playerId !== this.#hostId) return;          // host-only, silent drop
```

**Phase check + persist pattern (from `startGame` lines 276–277):**
```typescript
this.#phase = "playing";
this.#persistPhase();
```

**Per-field clear + persist pattern — derived from `startGame` per-connection assignment and `onStart` hydration idiom (lines 93–96). There is no in-codebase "clear every field" analog, so use the following shape (matches Pitfall 2 hibernation-safety requirements):**
```typescript
// NEW case "startNewGame"
this.#boards.clear();
this.#marks.clear();
this.#phase = "lobby";
this.#persistBoards();
this.#persistMarks();
this.#persistPhase();
this.broadcast(JSON.stringify({ type: "gameReset" }));
return;
```

**Win-detection append to `markWord` — copy the existing toggle + persist + broadcast chain (lines 316–325), then APPEND the win tail below. Do NOT replace the `wordMarked` broadcast — per RESEARCH §Alternatives Considered (A1), `wordMarked` fires first so peer badges update before the announcement:**
```typescript
// EXISTING (lines 316–325) — keep as-is
if (myMarks.has(cellId)) myMarks.delete(cellId);
else myMarks.add(cellId);
this.#persistMarks();

this.broadcast(JSON.stringify({
  type: "wordMarked",
  playerId: connState.playerId,
  markCount: myMarks.size,
}));

// NEW (Phase 4) — append
const win = detectWin(myBoard, myMarks);
if (!win) return;

this.#phase = "ended";
this.#persistPhase();

const winnerPlayer = this.#players.get(connState.playerId);
const winnerName = winnerPlayer?.displayName ?? "Someone";

this.broadcast(JSON.stringify({
  type: "winDeclared",
  winnerId: connState.playerId,
  winnerName,
  winningLine: win.winningLine,
  winningCellIds: win.winningCellIds,
}));
return;
```

**New import (join the existing `../src/lib/util/` imports at lines 28–30):**
```typescript
import { detectWin } from "../src/lib/util/winLine.js";
```

**Phase-type widening (line 60) — match the storage key rehydration at line 83:**
```typescript
// EXISTING
#phase: "lobby" | "playing" = "lobby";
// TARGET
#phase: "lobby" | "playing" | "ended" = "lobby";

// In onStart — expand the storage type argument (line 83):
this.ctx.storage.get<"lobby" | "playing" | "ended">(K_PHASE),
```

---

### `src/lib/stores/room.svelte.ts` (store, in-place extension)

**Analog:** self — mirror the Phase 3 `board`/`markedCellIds` extension (lines 29–31, 94–98) and the existing reactive-Set reassignment pattern (lines 97 and 143–146).

**New `$state` declarations (copy pattern from lines 29–31):**
```typescript
// EXISTING (lines 29–31) — structural template
let board = $state<BoardCell[] | null>(null);
let playerMarks = $state<Record<string, number>>({});
let markedCellIds = $state<Set<string>>(new Set());

// APPEND
let winner = $state<{ playerId: string; displayName: string } | null>(null);
let winningLine = $state<WinningLine | null>(null);
let winningCellIds = $state<string[]>([]);
```

**Message handler append pattern — copy the `boardAssigned` case shape (lines 94–98):**
```typescript
// EXISTING — the template (lines 94–98)
case "boardAssigned":
  board = msg.cells;
  markedCellIds = new Set();
  break;

// NEW (Phase 4) — append to the switch
case "winDeclared": {
  winner = { playerId: msg.winnerId, displayName: msg.winnerName };
  winningLine = msg.winningLine;
  winningCellIds = msg.winningCellIds;
  if (state) state = { ...state, phase: "ended" };

  // Fire confetti ONLY on the winner's client, ONLY in a browser.
  if (typeof window !== "undefined" && msg.winnerId === player.playerId) {
    import("canvas-confetti").then(({ default: confetti }) => {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      confetti(
        reduce
          ? { particleCount: 60,  spread: 90, ticks: 100, origin: { y: 0.25 }, colors: ["#F5D547", "#F5F5F7", "#F87171"] }
          : { particleCount: 180, spread: 90, startVelocity: 45, ticks: 220, origin: { y: 0.25 }, colors: ["#F5D547", "#F5F5F7", "#F87171"] }
      );
    }).catch(() => { /* silent — EndScreen still renders */ });
  }
  break;
}
case "gameReset": {
  board = null;
  markedCellIds = new Set();
  playerMarks = {};
  winner = null;
  winningLine = null;
  winningCellIds = [];
  if (state) state = { ...state, phase: "lobby" };
  break;
}
```

**Getters + sender append (copy shape from lines 131–148):**
```typescript
// EXISTING template (lines 132–140)
get board() { return board; },
get playerMarks() { return playerMarks; },
get markedCellIds() { return markedCellIds; },

// APPEND to the returned object
get winner() { return winner; },
get winningLine() { return winningLine; },
get winningCellIds() { return winningCellIds; },
startNewGame() {
  ws.send(JSON.stringify({ type: "startNewGame" }));
},
```

**Reactive-Set reassignment rule (from line 97 and 143–146): NEVER mutate in place — always reassign (`markedCellIds = new Set()` etc). Applies to `gameReset` cleanup.**

---

### `src/lib/components/EndScreen.svelte` (component, NEW)

**Analog:** `src/lib/components/Board.svelte` (grid-cols literal derivation + keyed `{#each}`) + the `{#if gameStarted}` section of `+page.svelte` lines 147–169 (composition of PlayerRow + Board).

**Props + derivations pattern — copy from `Board.svelte` lines 5–23:**
```svelte
<!-- Board.svelte — structural template -->
<script lang="ts">
  import BoardCell from "./BoardCell.svelte";
  import type { BoardCell as Cell } from "$lib/protocol/messages";

  type BoardProps = {
    cells: Cell[] | null;
    markedCellIds: Set<string>;
    onToggle: (cellId: string) => void;
  };
  let { cells, markedCellIds, onToggle }: BoardProps = $props();

  const colsClass = $derived(
    cells?.length === 9 ? "grid-cols-3"
    : cells?.length === 16 ? "grid-cols-4"
    : cells?.length === 25 ? "grid-cols-5"
    : "grid-cols-3"
  );
</script>
```

**Apply the same literal-token derivation for EndScreen's winner board render (Pitfall 7 — Tailwind v4 scanner safety).**

**Frozen-board render pattern — wrap `BoardCell` in a non-interactive `<div data-win-line>` so `BoardCell.svelte` itself is unchanged:**
```svelte
{#if board}
  <div class={["grid w-full gap-2 pointer-events-none", colsClass].join(" ")}>
    {#each board as cell (cell.cellId)}
      <div data-win-line={winCellIdSet.has(cell.cellId) ? "true" : undefined}>
        <BoardCellComp
          {cell}
          marked={markedCellIds.has(cell.cellId)}
          onToggle={undefined}
        />
      </div>
    {/each}
  </div>
{/if}
```

**Button + primary-CTA pattern — copy from `+page.svelte` lines 267–277 (the Start Game button is the exact analog for the Start New Game button):**
```svelte
<!-- Analog: lines 267–277 of +page.svelte -->
{#if iAmHost}
  <div class="w-full sm:min-w-[180px]">
    <Button variant="primary" onclick={startGame} disabled={!canStart}>
      {#snippet children()}
        <Play size={16} />
        Start Game
      {/snippet}
    </Button>
  </div>
{/if}
```

**Heading + aria-live pattern — match existing status banner idiom (line 30–31 of `Board.svelte` uses `aria-live="polite"` on the dealing-message div). Apply the same to the "BINGO!" and `{Name} got Bingo!` headings.**

**Accent typography pattern — copy the `font-display` + `text-[var(--color-accent)]` wordmark from `+page.svelte` lines 176–180 (the room code header):**
```svelte
<p class="font-display text-[40px] sm:text-[56px] font-semibold tracking-[0.1em] text-[var(--color-accent)] leading-[1.1]">
  {data.code}
</p>
```

---

### `src/lib/components/WinLineIcon.svelte` (component, NEW)

**Analog:** `src/lib/components/Board.svelte` (literal `grid-cols-N` derivation + cell `{#each}`). Simplest possible presentational component.

**Literal-class derivation pattern (copy from `Board.svelte` lines 15–23):**
```typescript
const colsClass = $derived(
  gridSize === 3 ? "grid-cols-3"
  : gridSize === 4 ? "grid-cols-4"
  : "grid-cols-5"
);
```

**Highlighted-cell derivation — import `winLineCellIndices` from `$lib/util/winLine`:**
```typescript
const highlightedSet = $derived(new Set(winLineCellIndices(winningLine, gridSize)));
const totalCells = $derived(gridSize * gridSize);
```

**Surface/divider token pattern (copy from `Board.svelte` class composition):**
```svelte
<div
  class={["grid gap-[2px] w-16 h-16 p-1.5 bg-[var(--color-surface)] rounded border border-[var(--color-divider)]", colsClass].join(" ")}
  aria-label="Winning line indicator"
  role="img"
>
  {#each Array(totalCells) as _, i}
    <div class={highlightedSet.has(i)
      ? "bg-[var(--color-ink-primary)] rounded-[1px]"
      : "bg-[var(--color-divider)] rounded-[1px]"}
    ></div>
  {/each}
</div>
```

---

### `src/lib/components/BoardCell.svelte` (component, UNCHANGED)

**Analog:** self — per Assumption A5, no edits. The ring glow lives in `src/app.css` via a `[data-win-line="true"] > button` attribute selector, and is applied by a wrapper div in `EndScreen.svelte`.

---

### `src/app.css` (global styling, in-place extension)

**Analog:** self — mirror the existing `@keyframes shake` + `.shake` + reduced-motion rule (lines 17–29).

**Existing pattern (lines 17–29) — structural template:**
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-6px); }
  80%       { transform: translateX(6px); }
}

.shake { animation: shake 300ms ease-in-out; }

@media (prefers-reduced-motion: reduce) {
  .shake { animation: none; }
}
```

**Append — win-line pulse + reduced-motion fallback (token colors hard-coded to `#F5D547` because CSS `@keyframes` does not resolve CSS vars in all browsers reliably for box-shadow — matches UI-SPEC):**
```css
@keyframes winLinePulse {
  0%, 100% { box-shadow: 0 0 0 2px #F5D547, 0 0 8px  #F5D547; }
  50%      { box-shadow: 0 0 0 2px #F5D547, 0 0 16px #F5D547; }
}

[data-win-line="true"] > button {
  animation: winLinePulse 1200ms ease-in-out infinite;
  border-radius: 0.5rem; /* match BoardCell's rounded-lg */
}

@media (prefers-reduced-motion: reduce) {
  [data-win-line="true"] > button {
    animation: none;
    box-shadow: 0 0 0 2px #F5D547, 0 0 12px #F5D547;
  }
}
```

---

### `src/routes/room/[code]/+page.svelte` (page, in-place extension)

**Analog:** self — the `{#if gameStarted}…{:else}…{/if}` block (lines 146–285) is the exact branching idiom to extend.

**Current `gameStarted` derivation (line 87):**
```typescript
const gameStarted = $derived(roomState?.phase === "playing");
```

**Target — add a `phase` alias and swap to three-way branch:**
```typescript
const phase = $derived<"lobby" | "playing" | "ended">(roomState?.phase ?? "lobby");
```

**Existing conditional render (lines 146–170) — structural template:**
```svelte
{#if gameStarted}
  <section class="flex flex-col gap-6">
    …players + Board…
  </section>
{:else}
  …lobby…
{/if}
```

**Target — three-way phase switch (replace the outer `{#if gameStarted}` with):**
```svelte
{#if phase === "playing"}
  <!-- existing "playing" block lines 147–169 — unchanged -->
{:else if phase === "ended"}
  <EndScreen
    winner={store?.winner ?? null}
    winningLine={store?.winningLine ?? null}
    winningCellIds={store?.winningCellIds ?? []}
    board={store?.board ?? null}
    markedCellIds={store?.markedCellIds ?? new Set()}
    isHost={iAmHost}
    isWinner={store?.winner?.playerId === myPlayerId}
    onStartNewGame={() => store?.startNewGame()}
  />
{:else}
  <!-- existing lobby block lines 171–284 — unchanged -->
{/if}
```

**`RoomStore` TypeScript interface (lines 27–40) — APPEND three fields + one method:**
```typescript
// EXISTING fields (lines 36–39)
board: BoardCell[] | null;
playerMarks: Record<string, number>;
markedCellIds: Set<string>;
toggleMark(cellId: string): void;

// APPEND
winner: { playerId: string; displayName: string } | null;
winningLine: WinningLine | null;
winningCellIds: string[];
startNewGame(): void;
```

**New imports — join the existing `$lib/components/*` cluster (lines 4–10):**
```typescript
import EndScreen from "$lib/components/EndScreen.svelte";
import type { WinningLine } from "$lib/protocol/messages";
```

---

### `tests/unit/winLine.test.ts` (unit, NEW)

**Analog:** `tests/unit/shuffle.test.ts` + `tests/unit/gridTier.test.ts` — pure-function tests, no mocks needed.

**File header + import pattern (from `shuffle.test.ts` lines 1–2):**
```typescript
import { describe, it, expect } from "vitest";
import { detectWin, formatWinLine, winLineCellIndices } from "../../src/lib/util/winLine";
```

**Describe-block pattern (from `shuffle.test.ts` line 4):**
```typescript
describe("detectWin", () => {
  it("returns null for empty marks on a board with no all-blank line", () => { … });
  it("detects row completion when every non-blank cell in the row is marked", () => { … });
  // one test per: row / col / main-diagonal / anti-diagonal, for 3×3 / 4×4 / 5×5
  it("treats blank cells as pre-satisfied (5-word 3×3 with diagonal of blanks)", () => { … });
});

describe("formatWinLine", () => {
  it("returns 'Row N' with 1-indexed numbering", () => { … });
});

describe("winLineCellIndices", () => {
  it("returns correct row indices for every (index, gridSize)", () => { … });
});
```

---

### `tests/unit/EndScreen.test.ts` (unit component, NEW)

**Analog:** `tests/unit/Board.test.ts` — uses `mount`/`unmount` from `svelte`, a `container` div, and a `renderBoard` helper.

**Render-helper + teardown pattern (copy from `Board.test.ts` lines 1–24):**
```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, unmount } from "svelte";
import EndScreen from "../../src/lib/components/EndScreen.svelte";

let instance: ReturnType<typeof mount> | null = null;
let container: HTMLElement | null = null;

function renderEndScreen(props: { … }) {
  container = document.createElement("div");
  document.body.appendChild(container);
  instance = mount(EndScreen, { target: container, props });
  return container;
}

afterEach(() => {
  if (instance) { unmount(instance); instance = null; }
  if (container) { container.remove(); container = null; }
});
```

**Prop-matrix test pattern (copy from `Board.test.ts` lines 43–74) — one test each for:**
- winner view (renders "BINGO!" wordmark, frozen board, ring glow on winning cells)
- non-winner view (renders `{name} got Bingo!`, renders `WinLineIcon`, NO board)
- host non-winner (renders "Start new game" CTA)
- non-host (renders "Waiting for host" placeholder, no CTA)

---

### `tests/unit/WinLineIcon.test.ts` (unit component, NEW)

**Analog:** `tests/unit/Board.test.ts` — same `mount` harness. Assert which cell divs have the highlight class for every `(type, index, gridSize)` triple.

**Class-assertion pattern (from `Board.test.ts` lines 43–62):**
```typescript
it("uses grid-cols-N for gridSize N", () => {
  const el = renderIcon({ gridSize: 4, winningLine: { type: "row", index: 0 } });
  const grid = el.querySelector("[role='img']") ?? el.firstElementChild!;
  expect(grid.className).toContain("grid-cols-4");
});
```

---

### `tests/unit/game-room.test.ts` (unit, in-place extension)

**Analog:** self — the Phase 2/3 describe blocks + `vi.mock("partyserver", …)` scaffold (lines 50–93) + `makeConn` helper (lines 15–43) are the exact harness to reuse.

**Mock-scaffold (lines 50–93) — DO NOT duplicate; just add tests below the existing describe.**

**`makeConn` helper (lines 15–43) — reuse as-is.**

**Phase 2 describe-block pattern (from line ~105) — structural template for "GameRoom — win & reset (Phase 4)" describe:**
```typescript
describe("GameRoom — win & reset (Phase 4)", () => {
  let room: InstanceType<typeof GameRoom>;
  beforeEach(() => {
    room = new GameRoom({} as never, {} as never);
    vi.clearAllMocks();
  });

  it("detectWin on completing mark broadcasts winDeclared with correct payload", () => { … });
  it("non-completing mark does NOT broadcast winDeclared", () => { … });
  it("startNewGame host-only — non-host request silently dropped", () => { … });
  it("startNewGame clears #boards, #marks, resets #phase to 'lobby'", () => { … });
  it("startNewGame retains #words, #usedPacks, #players, #hostId", () => { … });
  it("startNewGame calls #persistBoards, #persistMarks, #persistPhase (hibernation safety)", () => { … });
  it("after winDeclared, subsequent markWord is silently dropped (phase guard)", () => { … });
});
```

**Broadcast-assertion pattern — exact shape from line 139–144:**
```typescript
expect((room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast).toHaveBeenCalled();
const call = JSON.parse(
  (room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast.mock.calls[0][0] as string
);
expect(call.type).toBe("winDeclared");
```

**Order-assertion pattern (Pitfall 1) — check call order on `broadcast.mock.calls`:**
```typescript
// wordMarked FIRST, winDeclared SECOND
expect(JSON.parse(broadcast.mock.calls[0][0]).type).toBe("wordMarked");
expect(JSON.parse(broadcast.mock.calls[1][0]).type).toBe("winDeclared");
```

---

### `tests/unit/protocol.test.ts` (unit, in-place extension)

**Analog:** self — the existing `v.safeParse(ClientMessage, …)` / `v.safeParse(ServerMessage, …)` describe blocks (lines 5–80+) are the exact pattern. Just append.

**Pattern (lines 5–18) — one accept + one reject per variant:**
```typescript
// EXISTING template
it("accepts a valid hello message", () => {
  const result = v.safeParse(ClientMessage, { type: "hello", playerId: "p1", displayName: "Alice" });
  expect(result.success).toBe(true);
});
it("rejects hello with empty displayName", () => { … });
```

**APPEND — cover new schemas:**
```typescript
// ClientMessage
it("accepts startNewGame message", () => { … });

// ServerMessage
it("accepts winDeclared with valid payload", () => { … });
it("rejects winDeclared with empty winnerId", () => { … });
it("rejects winDeclared with winningLine.index negative", () => { … });
it("accepts gameReset message", () => { … });

// RoomState
it("accepts RoomState with phase = 'ended'", () => { … });
it("rejects RoomState with phase = 'playing_over'", () => { … });

// WinningLine
it("accepts WinningLine with type = 'diagonal', index = 1", () => { … });
it("rejects WinningLine with type = 'anti'", () => { … });
```

---

### `tests/unit/room-store.test.ts` (unit, in-place extension)

**Analog:** self — the `MockPartySocket` scaffold (lines 4–44) + existing handler-test pattern (lines 101–120) are reused verbatim.

**`MockPartySocket.emit()` pattern (from line 117):**
```typescript
ws.emit("message", { data: JSON.stringify({ type: "winDeclared", winnerId: "p1", winnerName: "Alice", winningLine: { type: "row", index: 0 }, winningCellIds: ["c1","c2","c3"] }) });
expect(store.winner).toEqual({ playerId: "p1", displayName: "Alice" });
expect(store.winningLine).toEqual({ type: "row", index: 0 });
expect(store.state?.phase).toBe("ended");
```

**APPEND tests:**
```typescript
describe("createRoomStore — Phase 4 (win + reset)", () => {
  it("winDeclared sets winner/winningLine/winningCellIds and flips phase to 'ended'", () => { … });
  it("winDeclared fires confetti when winnerId === self playerId", () => {
    // Mock dynamic import of canvas-confetti and assert it was called
  });
  it("winDeclared does NOT fire confetti when winnerId !== self playerId", () => { … });
  it("gameReset clears board, markedCellIds, playerMarks, winner, winningLine, winningCellIds and flips phase to 'lobby'", () => { … });
  it("startNewGame sends the correct ClientMessage over the socket", () => {
    store.startNewGame();
    const sent = JSON.parse(ws.lastSent!);
    expect(sent).toEqual({ type: "startNewGame" });
  });
});
```

**Mock confetti via `vi.mock('canvas-confetti', …)` — add to the top of the file alongside the existing `vi.mock("partysocket", …)` at line 42.**

---

### `e2e/win-and-reset.spec.ts` (e2e, NEW)

**Analog:** `e2e/board-mark.spec.ts` — two-browser-context Playwright flow with `createRoom` / `joinRoom` / `seedWords` helpers.

**Helper pattern (copy verbatim from `board-mark.spec.ts` lines 3–25):**
```typescript
async function createRoom(page, name) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a game" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Create game/ }).click();
  await page.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  return page.url().split("/").pop()!;
}
async function joinRoom(page, code, name) { … }
async function seedWords(page, words) { … }
```

**Two-browser test pattern (copy from `board-mark.spec.ts` lines 27–46):**
```typescript
test("Phase 4: both players see EndScreen within 1s of win", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  const code = await createRoom(a, "Host");
  await joinRoom(b, code, "Player2");
  await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

  await seedWords(a, ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]);
  await a.getByRole("button", { name: /Start Game/i }).click();

  await expect(a.locator('[data-testid="board-grid"] button').first()).toBeVisible({ timeout: 3000 });

  // Host marks cells along a row/column/diagonal until a line completes (3×3 board, 5 words → 4 blanks).
  // Strategy: mark every non-blank cell — any 3×3 board completes via a row/col/diag given blank-satisfaction.
  const cells = await a.locator('[data-testid="board-grid"] button').all();
  for (const cell of cells) await cell.click();

  // Winner sees BINGO!
  await expect(a.getByText(/BINGO!/)).toBeVisible({ timeout: 1500 });
  // Non-winner sees "Host got Bingo!"
  await expect(b.getByText(/Host got Bingo/i)).toBeVisible({ timeout: 1500 });

  // Host clicks Start new game
  await a.getByRole("button", { name: /Start new game/i }).click();

  // Both return to lobby (word pool retained)
  await expect(a.getByRole("button", { name: /Start Game/i })).toBeVisible({ timeout: 1500 });
  await expect(b.getByText(/Alpha/)).toBeVisible(); // word from previous round
  await ctxA.close();
  await ctxB.close();
});
```

---

## Shared Patterns

### Host-only guard
**Source:** `party/game-room.ts` lines 246 (`loadStarterPack`) and 271 (`startGame`).
**Apply to:** `startNewGame` handler.
```typescript
const connState = conn.state as { playerId?: string } | null;
if (connState?.playerId !== this.#hostId) return;  // silent drop
```

### Mutate-then-persist (hibernation safety)
**Source:** `party/game-room.ts` lines 108–130 (all `#persistX` helpers) + Pitfall 2 of Phase 3 research.
**Apply to:** every `#phase` assignment, every `#boards` / `#marks` mutation in the new `startNewGame` handler, and the `#phase = 'ended'` flip in the `markWord` win-tail.
```typescript
this.#phase = "ended";
this.#persistPhase();   // MANDATORY on the very next line
```

### Reactive `$state<Set>` reassignment
**Source:** `src/lib/stores/room.svelte.ts` line 97 (`markedCellIds = new Set()`) and lines 143–146 (`const next = new Set(markedCellIds); … markedCellIds = next;`).
**Apply to:** `gameReset` handler (clear `markedCellIds` + `playerMarks`).
```typescript
markedCellIds = new Set();
playerMarks = {};
```

### Valibot variant append
**Source:** `src/lib/protocol/messages.ts` lines 39–63 (`ClientMessage`) + 66–81 (`ServerMessage`) + Phase 3 analog: the `BoardCell` append (lines 21–27).
**Apply to:** all three new message schemas + `WinningLine` object + `RoomState.phase` literal.

### Tailwind v4 literal-class derivation (scanner safety)
**Source:** `src/lib/components/Board.svelte` lines 15–23.
**Apply to:** `WinLineIcon.svelte` and the frozen-board render inside `EndScreen.svelte`. **Never** use template literals for `grid-cols-${n}` — always enumerate literals via `$derived` ternary.

### Color/token pattern
**Source:** `src/app.css` lines 3–15 (theme) + `src/lib/components/Board.svelte` / `BoardCell.svelte` class compositions.
**Apply to:** EndScreen surfaces (`bg-[var(--color-bg)]`, `bg-[var(--color-surface)]`), winner wordmark (`text-[var(--color-accent)]`), dividers (`border-[var(--color-divider)]`). Win-line ring glow uses raw `#F5D547` (matches Phase 3 D-16 + UI-SPEC).

### Phase-conditional render at page level
**Source:** `src/routes/room/[code]/+page.svelte` lines 146 (`{#if gameStarted}`), 170 (`{:else}`).
**Apply to:** expand to `{#if phase==='playing'} … {:else if phase==='ended'} <EndScreen /> {:else} … {/if}`.

### Svelte component test harness
**Source:** `tests/unit/Board.test.ts` lines 1–24 (`mount` + teardown with `unmount`).
**Apply to:** `EndScreen.test.ts` and `WinLineIcon.test.ts`.

### PartyServer DO test mock scaffold
**Source:** `tests/unit/game-room.test.ts` lines 10–93 (`makeConn`, `FakeConn`, `vi.mock("partyserver", …)`).
**Apply to:** reuse in the new "GameRoom — win & reset (Phase 4)" describe block — DO NOT re-declare.

### PartySocket client-store mock scaffold
**Source:** `tests/unit/room-store.test.ts` lines 4–51 (`MockPartySocket` + `vi.hoisted` + `vi.mock("partysocket", …)` + `vi.mock("../../src/lib/session", …)`).
**Apply to:** reuse in the Phase 4 describe block appended at the bottom.

### Playwright two-context flow
**Source:** `e2e/board-mark.spec.ts` lines 3–46 (`createRoom`, `joinRoom`, `seedWords`, dual browser contexts).
**Apply to:** `e2e/win-and-reset.spec.ts` — copy helpers verbatim.

### Dynamic browser-only import
**Source:** No direct in-repo analog (this is the one genuinely new primitive in Phase 4). Closest is the `typeof window !== "undefined"` guards at `room.svelte.ts` line 37 and `+page.svelte` line 18. Reference is Pattern 3 of `04-RESEARCH.md`.
**Apply to:** confetti invocation only.
```typescript
if (typeof window !== "undefined" && msg.winnerId === player.playerId) {
  import("canvas-confetti").then(({ default: confetti }) => { confetti({…}); }).catch(() => {});
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason | Planner fallback |
|------|------|-----------|--------|------------------|
| `canvas-confetti` dynamic import site inside `room.svelte.ts` | runtime (third-party animation) | side-effect | No prior dynamic `import()` of a browser-only module exists in the codebase | Use the exact snippet in `04-RESEARCH.md` Pattern 3 (lines 528–605). Guard on `typeof window !== "undefined"` + `msg.winnerId === player.playerId`. Never place at module top-level. |

Everything else has an in-repo analog. The confetti call is the only net-new primitive.

---

## Metadata

**Analog search scope:**
- `src/lib/protocol/**` (1 file)
- `src/lib/stores/**` (1 file)
- `src/lib/components/**` (13 files)
- `src/lib/util/**` (6 files)
- `src/routes/**` (route tree)
- `party/**` (1 file)
- `src/app.css` (1 file)
- `tests/unit/**` (13 files)
- `e2e/**` (7 files)

**Files scanned:** 42

**Key patterns identified:**
- Every DO handler follows host-guard → validate → mutate → `#persistX()` → broadcast. The Phase 4 `startNewGame` handler and `markWord` win-tail slot into this template exactly.
- All `v.variant` message extensions are single-file appends in `src/lib/protocol/messages.ts` — no type helpers, no indirection.
- Reactive state in `room.svelte.ts` always uses `$state<T>` + getter + Set/object reassignment (never in-place mutation).
- Tailwind v4 scanner requires literal `grid-cols-N` tokens — use `$derived` ternary, never template literals.
- All component tests use the `svelte` `mount`/`unmount` harness with a `container` div.
- All DO unit tests share one `vi.mock("partyserver", …)` scaffold at the top of `tests/unit/game-room.test.ts`.
- `src/app.css` holds all global `@keyframes` + reduced-motion rules — EndScreen's win-line glow belongs there, not in a component `<style>` block.

**Pattern extraction date:** 2026-04-18
