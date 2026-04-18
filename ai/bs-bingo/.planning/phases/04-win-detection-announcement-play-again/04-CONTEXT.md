# Phase 4: Win Detection, Announcement & Play-Again - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers: (1) server-side win detection after every mark — first player to complete any row, column, or diagonal (blanks pre-satisfied) wins; (2) a consistent celebration screen seen by all players — winner gets confetti + "BINGO!", everyone gets a mini grid icon showing which line completed and who won; (3) a host-controlled play-again flow that returns the room to the lobby without re-joining, with the word pool retained for editing. Nothing about reconnection resilience or host-transfer is in scope — that's Phase 5.

</domain>

<decisions>
## Implementation Decisions

### End-Screen Presentation

- **D-01:** Win state uses a **phase swap**: `phase === 'ended'` renders a new `EndScreen.svelte` component, replacing the `Board` view — mirrors the existing `lobby → playing` pattern (`{#if phase === 'playing'}<Board />{:else if phase === 'ended'}<EndScreen />{:else}<Lobby />{/if}`). No overlay; the EndScreen owns its full layout.
- **D-02:** `EndScreen.svelte` renders full-bleed confetti (canvas-confetti, fires once for the winner only), a "BINGO!" heading, winner name, the mini win-line grid icon, and — host-only — a "Start New Game" CTA. No z-index stacking risk.
- **D-03:** Win-line glow on the winning player's frozen board cells uses CSS `box-shadow` ring (`0 0 0 2px #F5D547, 0 0 12px #F5D547`) NOT a `#F5D547` fill — satisfies Phase 3 D-16 differentiation requirement. The EndScreen freezes the board snapshot received via `boardAssigned`; it is not re-rendered live.
- **D-04:** Confetti library: **canvas-confetti** (~10KB gzipped). Fires once on `winDeclared` received by the winner's client only. Non-winners do not get confetti.

### Win Line Reveal to Non-Winners

- **D-05:** WIN-04 ("all players see which line completed") is satisfied by a **mini grid icon** — a small CSS/SVG grid (matching the current board size: 3×3, 4×4, or 5×5) with the winning row/column/diagonal cells highlighted in white against a dark surface. Non-winners see the icon + winner's display name. No full board is exposed.
- **D-06:** The `winDeclared` ServerMessage carries `{ winnerId, winnerName, winningLine: { type: 'row' | 'col' | 'diagonal', index: number }, winningCellIds: string[] }`. `winningLine` drives the mini grid icon for all players. `winningCellIds` is used by the winning player's client to highlight those cells in the frozen board snapshot.
- **D-07:** Mini grid icon is a new lightweight component (`WinLineIcon.svelte` or equivalent). Derives which cells to highlight from `winningLine.type + winningLine.index` and the current grid size. ~30 lines, no additional dependencies.

### Post-Win Board State

- **D-08:** After `winDeclared` is received, the board transitions to `EndScreen.svelte` — the live `Board.svelte` unmounts. No further marks are accepted (DO enforces `phase !== 'playing'` guard already in `markWord` handler). Boards are frozen in the EndScreen snapshot.

### Play-Again Flow

- **D-09:** Host clicks "Start New Game" → client sends `startNewGame` ClientMessage → DO resets state and broadcasts `gameReset` ServerMessage.
- **D-10:** On `gameReset`, the DO resets: `#phase → 'lobby'`, `#boards → empty Map`, `#marks → empty Map`. It retains: `#words` (full word pool unchanged), `#usedPacks` (pack buttons remain marked used — words are already in pool, no double-load needed), `#players` (roster unchanged), `hostId` (host role unchanged).
- **D-11:** Lobby experience after play-again is **identical to a fresh game**: players can add/remove words normally (including words from previous round), grid progress bar is live, host hits "Start Game" manually when ready. No auto-start, no countdown.
- **D-12:** `RoomState.phase` union expands to `"lobby" | "playing" | "ended"`. The `ended` phase is the signal for all clients to render `EndScreen.svelte`.

### Protocol Changes

- **D-13:** New `ClientMessage`: `startNewGame` (host-only guard enforced in DO — non-host requests are silently dropped).
- **D-14:** New `ServerMessage` variants:
  - `winDeclared { winnerId: string, winnerName: string, winningLine: { type: 'row' | 'col' | 'diagonal', index: number }, winningCellIds: string[] }` — broadcast to all players
  - `gameReset` — broadcast; clients clear board + marks, flip phase to lobby, keep word pool

### Claude's Discretion

- Exact confetti particle config (colors, duration, particle count — keep it exuberant but not jarring)
- Exact EndScreen layout (how confetti canvas, "BINGO!" heading, winner name, mini grid icon, and Play-Again CTA are composed)
- Animation/transition for the Board → EndScreen phase swap (instant or brief fade)
- Non-winner EndScreen copy (e.g., "[Name] called Bingo!", "Better luck next time!")
- Exact WinLineIcon cell sizes and highlight style within the dark theme

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` §Win — WIN-01 through WIN-05 are the acceptance criteria for this phase
- `.planning/PROJECT.md` — project context, constraints, Key Decisions table

### Phase 1–3 Foundations
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-CONTEXT.md` — design system decisions (dark theme, session model, lobby layout)
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-UI-SPEC.md` — color tokens (`#0F0F14`, `#1A1A23`, `#2A2A36`, `#F5D547`), spacing, typography, component inventory
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-PATTERNS.md` — Svelte 5 runes patterns, PartyServer room class, Valibot message schema extension
- `.planning/phases/02-lobby-gameplay-word-submission-start/02-CONTEXT.md` — word pool decisions, starter pack flow, grid tier logic
- `.planning/phases/02-lobby-gameplay-word-submission-start/02-PATTERNS.md` — Phase 2 implementation patterns
- `.planning/phases/03-board-generation-core-mark-loop/03-CONTEXT.md` — board delivery, mark loop, blank cell behavior (D-10, D-16 critical for Phase 4)

### Codebase Entry Points (read before implementing)
- `src/lib/protocol/messages.ts` — current Valibot schemas; Phase 4 adds `winDeclared`, `gameReset` ServerMessage variants + `startNewGame` ClientMessage; `RoomState.phase` union expands to include `"ended"`
- `src/lib/stores/room.svelte.ts` — `createRoomStore` factory; Phase 4 adds `winner`, `winningLine`, `winningCellIds` reactive state + `gameReset` handler
- `party/game-room.ts` — GameRoom DO; Phase 4 adds win detection in `markWord` handler + `startNewGame` handler + `gameReset` broadcast
- `src/routes/room/[code]/+page.svelte` — add `{:else if phase === 'ended'}<EndScreen />{/if}` branch
- `src/lib/components/Board.svelte` — frozen board snapshot passed to EndScreen for winner's view

No external spec files beyond the above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Modal.svelte` — not used for the end screen (phase swap chosen), but available for any confirmation dialogs
- `Button.svelte` — "Start New Game" CTA on EndScreen; covers host-only affordance
- `PlayerRow.svelte` — player roster on EndScreen if shown (carries mark count badge from Phase 3)
- `BoardCell.svelte` — win-line glow variant needed (CSS ring, not fill) for the frozen winner board snapshot in EndScreen
- `room.svelte.ts` `createRoomStore` — extension point for `winner`, `winningLine`, `winningCellIds` state fields

### Established Patterns
- Svelte 5 `$state` + `$derived` for reactive store state
- Valibot `v.variant("type", [...])` for all WS message types — new types appended
- Server-authoritative: DO enforces all guards (phase check, host-only check); clients update from server messages only
- `conn.getState()` for per-connection identity — used to identify winner from connection state in `markWord` handler
- Phase conditional render at `+page.svelte` level — add `'ended'` branch to existing `if/else if` chain

### Integration Points
- `markWord` handler in `game-room.ts`: after recording mark + broadcasting `wordMarked`, run win detection — if winner found, set `#phase = 'ended'`, persist, broadcast `winDeclared`
- Win detection: iterate all line patterns for the winning player's board; a line is complete if every non-blank cell's `cellId` is in the player's `#marks` Set (blank cells skip the mark check)
- `startNewGame` handler: guard host-only, then clear `#boards`, `#marks`, reset `#phase = 'lobby'`, persist, broadcast `gameReset`
- `RoomState` shape: add `phase: 'ended'` to union; no other RoomState fields change for Phase 4

</code_context>

<specifics>
## Specific Ideas

- Win detection line patterns for an N×N grid: N rows (indices 0..N-1) + N columns + 2 diagonals (main and anti). Server has `#boards` Map (playerId → BoardCell[]) — after a mark, check only the lines that include the newly marked cell (optimization, not required for correctness at v1 scale)
- `winningLine.index` convention: for `type: 'row'`, index = row number (0-based); for `type: 'col'`, index = column number (0-based); for `type: 'diagonal'`, index = 0 for main diagonal (top-left → bottom-right), 1 for anti-diagonal (top-right → bottom-left)
- canvas-confetti invocation: `confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })` — fire once on `winDeclared` received by the winning client
- `gameReset` message triggers client store to: `board = null`, `markedCellIds = new Set()`, `playerMarks = {}`, `state.phase = 'lobby'` — word pool and players untouched

</specifics>

<deferred>
## Deferred Ideas

- Near-miss indicator (one cell from winning) → v2 (SOCL-02)
- Sound effects on win → v2 (SOCL-03)
- Social-validation anti-cheat → v2 (SOCL-04)
- Reconnection/resume after win screen → Phase 5 (RESI-01 through RESI-06)
- Post-game summary / game history → v2 (PERS-01)
- Winner streak tracking across rounds → v2

</deferred>

---

*Phase: 04-win-detection-announcement-play-again*
*Context gathered: 2026-04-18*
