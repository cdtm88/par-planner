# Phase 4: Win Detection, Announcement & Play-Again - Research

**Researched:** 2026-04-18
**Domain:** Server-authoritative win detection + client celebration surface + room-level game reset on Durable Object
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**End-Screen Presentation**
- **D-01:** Win state uses a **phase swap**: `phase === 'ended'` renders a new `EndScreen.svelte` component, replacing the `Board` view — mirrors the existing `lobby → playing` pattern (`{#if phase === 'playing'}<Board />{:else if phase === 'ended'}<EndScreen />{:else}<Lobby />{/if}`). No overlay; the EndScreen owns its full layout.
- **D-02:** `EndScreen.svelte` renders full-bleed confetti (canvas-confetti, fires once for the winner only), a "BINGO!" heading, winner name, the mini win-line grid icon, and — host-only — a "Start New Game" CTA. No z-index stacking risk.
- **D-03:** Win-line glow on the winning player's frozen board cells uses CSS `box-shadow` ring (`0 0 0 2px #F5D547, 0 0 12px #F5D547`) NOT a `#F5D547` fill — satisfies Phase 3 D-16 differentiation requirement. The EndScreen freezes the board snapshot received via `boardAssigned`; it is not re-rendered live.
- **D-04:** Confetti library: **canvas-confetti** (~10KB gzipped). Fires once on `winDeclared` received by the winner's client only. Non-winners do not get confetti.

**Win Line Reveal to Non-Winners**
- **D-05:** WIN-04 ("all players see which line completed") is satisfied by a **mini grid icon** — a small CSS/SVG grid (matching the current board size: 3×3, 4×4, or 5×5) with the winning row/column/diagonal cells highlighted in white against a dark surface. Non-winners see the icon + winner's display name. No full board is exposed.
- **D-06:** The `winDeclared` ServerMessage carries `{ winnerId, winnerName, winningLine: { type: 'row' | 'col' | 'diagonal', index: number }, winningCellIds: string[] }`. `winningLine` drives the mini grid icon for all players. `winningCellIds` is used by the winning player's client to highlight those cells in the frozen board snapshot.
- **D-07:** Mini grid icon is a new lightweight component (`WinLineIcon.svelte` or equivalent). Derives which cells to highlight from `winningLine.type + winningLine.index` and the current grid size. ~30 lines, no additional dependencies.

**Post-Win Board State**
- **D-08:** After `winDeclared` is received, the board transitions to `EndScreen.svelte` — the live `Board.svelte` unmounts. No further marks are accepted (DO enforces `phase !== 'playing'` guard already in `markWord` handler). Boards are frozen in the EndScreen snapshot.

**Play-Again Flow**
- **D-09:** Host clicks "Start New Game" → client sends `startNewGame` ClientMessage → DO resets state and broadcasts `gameReset` ServerMessage.
- **D-10:** On `gameReset`, the DO resets: `#phase → 'lobby'`, `#boards → empty Map`, `#marks → empty Map`. It retains: `#words` (full word pool unchanged), `#usedPacks` (pack buttons remain marked used — words are already in pool, no double-load needed), `#players` (roster unchanged), `hostId` (host role unchanged).
- **D-11:** Lobby experience after play-again is **identical to a fresh game**: players can add/remove words normally (including words from previous round), grid progress bar is live, host hits "Start Game" manually when ready. No auto-start, no countdown.
- **D-12:** `RoomState.phase` union expands to `"lobby" | "playing" | "ended"`. The `ended` phase is the signal for all clients to render `EndScreen.svelte`.

**Protocol Changes**
- **D-13:** New `ClientMessage`: `startNewGame` (host-only guard enforced in DO — non-host requests are silently dropped).
- **D-14:** New `ServerMessage` variants:
  - `winDeclared { winnerId: string, winnerName: string, winningLine: { type: 'row' | 'col' | 'diagonal', index: number }, winningCellIds: string[] }` — broadcast to all players
  - `gameReset` — broadcast; clients clear board + marks, flip phase to lobby, keep word pool

### Claude's Discretion

- Exact confetti particle config (colors, duration, particle count — keep it exuberant but not jarring) — UI-SPEC already prescribes `{ particleCount: 180, spread: 90, startVelocity: 45, ticks: 220, origin: { y: 0.25 }, colors: ['#F5D547', '#F5F5F7', '#F87171'] }`
- Exact EndScreen layout (single column on all breakpoints per UI-SPEC)
- Animation/transition for the Board → EndScreen phase swap (120ms/150ms crossfade per UI-SPEC)
- Non-winner EndScreen copy (UI-SPEC prescribes `{WinnerDisplayName} got Bingo!` + `Nice try. One more round?`)
- Exact WinLineIcon cell sizes and highlight style within the dark theme (64px square, 1px gap, white on `#2A2A36`)

### Deferred Ideas (OUT OF SCOPE)

- Near-miss indicator (one cell from winning) → v2 (SOCL-02)
- Sound effects on win → v2 (SOCL-03)
- Social-validation anti-cheat → v2 (SOCL-04)
- Reconnection/resume after win screen → Phase 5 (RESI-01 through RESI-06)
- Post-game summary / game history → v2 (PERS-01)
- Winner streak tracking across rounds → v2

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIN-01 | Server checks for a completed line (row, column, or diagonal including blanks) after every mark | §Architecture Patterns — `detectWin(board, marks)` helper called from end of `markWord` handler in `party/game-room.ts` after toggle + persist. §Pattern 1 gives the line-enumeration algorithm. |
| WIN-02 | When a line is complete, server broadcasts the win to all players | §Pattern 2 — `this.broadcast(winDeclared)` after `#phase = 'ended'` flip. §Don't Hand-Roll uses existing `broadcast` primitive. |
| WIN-03 | Winning player sees a celebration state (confetti animation + "BINGO!" announcement) | §Pattern 3 — `canvas-confetti@1.9.4` dynamic import + one-shot call guarded on `winnerId === selfPlayerId`. §Pitfall 3 handles SSR `window is not defined`. |
| WIN-04 | All players see who won and which line completed | §Pattern 4 — `WinLineIcon.svelte` derives highlighted cell indices from `{ type, index }` + `gridSize`. §Pattern 5 covers winner-name display. |
| WIN-05 | Host can start a new game from the end screen, resetting to lobby with the same players | §Pattern 6 — `startNewGame` handler resets `#phase/#boards/#marks` and persists; `gameReset` broadcast flips all clients back to lobby. §Pitfall 5 covers DO hibernation rehydration of the reset state. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives enforced during Phase 4 (authoritative, unchanged from Phase 3):

- **Stack is frozen (one addition this phase):** SvelteKit 2.57.1 + Svelte 5.55.4 + PartyServer 0.4.1 + PartySocket 1.1.16 + Valibot 1.3.1 + nanoid 5.1.9. **Phase 4 adds canvas-confetti 1.9.4 + @types/canvas-confetti 1.9.0** — covered by CONTEXT.md D-04 and UI-SPEC "New dependency" declaration. [VERIFIED: `npm view canvas-confetti version` → 1.9.4, published 2025-10-25; `npm view @types/canvas-confetti version` → 1.9.0].
- **No Redux/Zustand/MobX:** Svelte 5 runes (`$state`, `$derived`, `$effect`) only.
- **No Next.js / React:** SvelteKit is the framework.
- **No Zod:** Valibot for all WS message validation.
- **No Socket.IO or managed WS vendors:** Durable Objects + WS Hibernation is the transport.
- **No polling:** win + reset propagation uses the live WebSocket only.
- **Tailwind v4 via `@theme` tokens** (no `tailwind.config.js`).
- **GSD workflow enforcement:** all file changes go through `/gsd-execute-phase` task actions; no direct edits.
- **Sub-1s round-trip target** — `winDeclared` and `gameReset` must reach every peer within 1 second of the triggering event (mark / button press).

No conflict between these directives and the Phase 4 scope. The canvas-confetti addition is explicitly sanctioned by CONTEXT.md D-04 and is the only dependency delta.

## Summary

Phase 4 closes the core loop. Every piece it needs already has a direct analog in the Phase 1/2/3 codebase: DO handler (`markWord` in `party/game-room.ts`), per-connection dispatch (`startGame`'s `getConnections()` iteration), reactive store extension (Phase 3 `board`/`markedCellIds`), and phase-conditional rendering (`gameStarted` branch in `+page.svelte`). The only brand-new primitive is a client-side celebration animation library — **canvas-confetti 1.9.4** — and it's a drop-in vanilla-browser call with an ESM default export that dynamic-imports cleanly on SvelteKit + Cloudflare Workers.

Four new protocol pieces: one ClientMessage (`startNewGame`), two ServerMessages (`winDeclared`, `gameReset`), and one union expansion (`RoomState.phase` gains `"ended"`). Four new server-side behaviors: win-line detection on `markWord`, `#phase = 'ended'` + broadcast on win, host-only `startNewGame` reset handler, hibernation-safe persistence of the expanded phase. Two new components (`EndScreen.svelte`, `WinLineIcon.svelte`), one new utility module (`src/lib/util/winLine.ts` — the `util` singular form per codebase convention, NOT `utils` as the UI-SPEC mistakenly writes in one place), and three client-store extensions (`winner`, `winningLine`, `winningCellIds`) plus two new message handlers (`winDeclared`, `gameReset`).

**Primary recommendation:** Implement win detection as a pure function `detectWin(cells, marks)` in `src/lib/util/winLine.ts` so it's unit-testable without a DO harness; call it from `party/game-room.ts` at the end of the `markWord` handler *after* the mark has been toggled and `#persistMarks()` has been called but *before* the `wordMarked` broadcast — or, preferably, **in place of** the `wordMarked` broadcast when a win is detected (emit `wordMarked` then `winDeclared` in that order so the mark-count badge update and the win announcement arrive together). The line-enumeration algorithm generates `N rows + N cols + 2 diagonals = 2N + 2` lines total (max 12 for a 5×5 grid) — trivial to check exhaustively on every mark; no optimization needed at v1 scale.

The one non-obvious correctness detail is the **winner's frozen board persistence across reconnect**. Phase 4 is NOT responsible for reconnect resume (that's Phase 5), but the EndScreen reads `board` from the client store — the store's `board` field was populated by `boardAssigned` during Phase 3's `startGame`. On `gameReset`, we must clear `board = null` and `markedCellIds = new Set()` on the client so the lobby re-renders cleanly. See Pitfall 4.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Win-line detection algorithm | API / DO (`party/game-room.ts`) | Shared util (`src/lib/util/winLine.ts`) for unit testability | D-08 mandates DO is authoritative (`phase !== 'playing'` guard). Pure function kept in `src/lib/util/` so Vitest can import it without `cloudflare:workers` ambient — same pattern as Phase 3's `shuffle.ts`. |
| `#phase = 'ended'` state flip | API / DO | — | D-08, D-12. The DO is the single source of truth for phase. |
| `winDeclared` broadcast | API / DO → All Frontends | — | D-14. All players need winner identity + line data; no per-player payload differences. |
| Frozen board storage (winner's view) | Frontend (client store, already present) | — | D-03, D-08. Board was delivered in Phase 3's `boardAssigned`; EndScreen reads existing `store.board`. No new server payload. |
| Win-line ring glow on winner's frozen cells | Frontend (CSS via `data-win-line="true"` attribute) | — | D-03. `BoardCell.svelte` gets one new CSS rule scoped to the attribute. Set by `EndScreen.svelte` for cells whose `cellId ∈ winningCellIds`. |
| Mini-grid icon rendering | Frontend (`WinLineIcon.svelte`) | — | D-05, D-07. Pure computation from `{ type, index, gridSize }` — no tier crossing. |
| Confetti burst | Frontend (winner's client only) | — | D-04. Fires on `winDeclared` message receipt, guarded on `winnerId === selfPlayerId`. |
| `startNewGame` ClientMessage → reset | API / DO | — | D-09, D-13. Host-only guard in DO matches existing `startGame`/`loadStarterPack` pattern. |
| `gameReset` broadcast | API / DO → All Frontends | — | D-14. Identical payload for every player (no winner/line data); clients clear local game state and return to lobby. |
| Lobby re-entry after reset | Frontend (phase-conditional render) | — | D-11, D-12. Phase flips back to `'lobby'`; existing Phase 2 lobby surface renders with retained `words` + `players` state. |

**Tier-check sanity:** All five success-criteria data flows cross exactly the same tier boundary as Phase 3 (DO → clients via WebSocket). Confetti is the only net-new capability in the browser tier; the animation is self-contained to the winner's DOM and does not cross a tier. No misassignment.

## Standard Stack

### Core (all already installed — locked stack unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `partyserver` | `0.4.1` | DO + WS Hibernation wrapper | [VERIFIED: `npm view partyserver version` → 0.4.1 (Phase 3)]. `broadcast()` + host-only guard pattern is the established server idiom. |
| `partysocket` | `1.1.16` | Client-side WS with reconnect | [VERIFIED: Phase 3 research]. Existing wiring in `room.svelte.ts` handles both `winDeclared` and `gameReset` with zero reconnect concern. |
| `valibot` | `1.3.1` | WS message schema + validation | [VERIFIED: Phase 3 research]. Phase 4 extends `ClientMessage` and `ServerMessage` variant unions with three new object variants; `RoomState.phase` union adds one literal. |
| `svelte` | `5.55.4` | UI + reactive state | [VERIFIED: Phase 3 research]. `$state`, `$derived`, `$effect` runes. `$effect` used for the confetti one-shot trigger. |
| `@sveltejs/kit` | `2.57.1` | Routing + SSR | [VERIFIED: Phase 1 research]. No new routes this phase; conditional render inside existing `/room/[code]/+page.svelte`. |
| Web Crypto API | (platform) | — | Not needed this phase (no fresh board generation — reset clears, Phase 3's shuffle runs again on next `startGame`). |

### New (Phase 4 addition — one library)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `canvas-confetti` | `1.9.4` | Winner's celebration burst | [VERIFIED: `npm view canvas-confetti version` → 1.9.4, published 2025-10-25]. [CITED: https://github.com/catdad/canvas-confetti/blob/master/README.md via Context7 `/catdad/canvas-confetti`]. ESM default export, ~10KB gzipped, zero runtime dependencies, respects `prefers-reduced-motion` via `disableForReducedMotion: true`. CONTEXT D-04 locks this choice. |
| `@types/canvas-confetti` | `1.9.0` | TypeScript declarations | [VERIFIED: `npm view @types/canvas-confetti version` → 1.9.0]. Required because canvas-confetti is plain JS; `svelte-check` will fail without types. Dev dependency. |

### Supporting (no additions — reuse)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-svelte` | `^1.0.1` | Optional `party-popper` icon on winner heading | UI-SPEC Claude's Discretion — decorative only; contract is satisfied without it. If included, sits immediately before the "BINGO!" wordmark. |
| Tailwind v4 via `@tailwindcss/vite` | `^4.2.2` | Utility classes for EndScreen layout, WinLineIcon grid, pulsing ring animation | Existing tokens: `bg-[var(--color-bg)]`, `bg-[var(--color-surface)]`, `bg-[var(--color-accent)]`, `text-[var(--color-ink-inverse)]`, `border-[var(--color-divider)]`. Pulsing ring uses a Tailwind `animate-*` utility or a scoped `@keyframes`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff — Why Not |
|------------|-----------|--------------------|
| `canvas-confetti` | Hand-rolled CSS/SVG confetti | Reinventing a 10KB library that handles 60fps canvas animation, reduced-motion, and clean canvas lifecycle. CONTEXT D-04 locks the library. |
| `canvas-confetti` | `react-confetti`, `tsparticles` | React-specific (react-confetti) or 10x larger (tsparticles ~100KB). `canvas-confetti` is framework-neutral vanilla JS. |
| Client-side win detection | Server-side win detection (D-08) | Fails D-08 and WIN-01 (explicitly "server checks"). Also trivially cheatable: any client could claim a win. Server-authoritative is the non-negotiable shape for a competitive real-time game. |
| Emitting `winDeclared` only | Emitting `wordMarked` then `winDeclared` | The winning mark SHOULD update peer badges before the win announcement — otherwise peers see the announcement before the badge reaches the winner's final count. Order: `wordMarked` first, `winDeclared` immediately after (both broadcast, FIFO on the WS). |
| Optimistic `gameReset` on host click | Wait-for-server-confirmation | UI-SPEC explicitly calls for "no local optimistic transition (wait for server confirmation)". Server is the source of truth for phase; optimistic flip would race against the broadcast and cause flicker if the DO dropped the message. |
| Putting winning-line cells in `RoomState` | Keeping them in `winDeclared` payload | `RoomState` is broadcast on `roomState` snapshot messages — it should NOT carry event-specific data (win facts). Events travel in their own message types; `RoomState` is the "who's here and what phase" snapshot. Also, Phase 5 (reconnect) will need `RoomState` to include `winner` fields to rehydrate mid-end-screen clients — that's Phase 5's call. **Phase 4 deliberately does NOT put winner data in `RoomState`.** |
| New route for EndScreen | Conditional render inside `/room/[code]/+page.svelte` | D-01 mandates conditional render. Route change would reconnect the WebSocket, losing the frozen board snapshot and triggering rebroadcast cost. |

**Installation command (Phase 4 single delta):**

```bash
npm install canvas-confetti
npm install --save-dev @types/canvas-confetti
```

**Version verification (performed 2026-04-18):**
```
$ npm view canvas-confetti version           → 1.9.4
$ npm view canvas-confetti time.modified     → 2025-10-25T05:15:42.389Z
$ npm view @types/canvas-confetti version    → 1.9.0
```

## Architecture Patterns

### System Architecture Diagram

```
                             ┌───────────────────────────────┐
                             │  CLIENT A (winner)            │
                             │                               │
   User taps                 │  BoardCell.svelte             │
   completing cell ─────────▶│  ├─ onclick → local toggle    │
                             │  └─ store.send({markWord,..}) │
                             │              │                │
                             │              ▼                │
                             │       PartySocket ────────────┼─┐
                             └───────────────────────────────┘ │
                                                               │
                             ┌───────────────────────────────┐ │
                             │  DURABLE OBJECT (GameRoom)    │ │
                             │                               │◀┘
                             │  onMessage(conn, "markWord")  │
                             │    │                          │
                             │    ├─ guard: phase=="playing" │
                             │    ├─ guard: cell valid/!blank│
                             │    ├─ toggle #marks[player]   │
                             │    ├─ persist marks           │
                             │    ├─ broadcast wordMarked    │◀──┐
                             │    │     {playerId,markCount} │   │  broadcast fan-out
                             │    │                          │   │  (all clients)
                             │    └─ detectWin(board,marks)  │   │
                             │         │                     │   │
                             │         ├─ if win detected:   │   │
                             │         │  │                  │   │
                             │         │  ├─ #phase="ended"  │   │
                             │         │  ├─ persist phase   │   │
                             │         │  └─ broadcast       │◀──┤
                             │         │      winDeclared {  │   │
                             │         │       winnerId,     │   │
                             │         │       winnerName,   │   │
                             │         │       winningLine,  │   │
                             │         │       winningCellIds│   │
                             │         │      }              │   │
                             │         └─ else: no-op        │   │
                             │                               │   │
                             │                               │   │
                             │  onMessage(conn,"startNewGame)│   │
                             │    │                          │   │
                             │    ├─ guard: hostId check     │   │
                             │    ├─ guard: phase=="ended"   │   │
                             │    │        (optional — D-10  │   │
                             │    │         says just reset) │   │
                             │    ├─ #phase="lobby"          │   │
                             │    ├─ #boards.clear()         │   │
                             │    ├─ #marks.clear()          │   │
                             │    ├─ persist all 3           │   │
                             │    └─ broadcast gameReset     │◀──┤
                             │                               │   │
                             │  Retained across reset:       │   │
                             │    #words, #usedPacks,        │   │
                             │    #players, #hostId          │   │
                             │                               │   │
                             │  In-memory state (extends     │   │
                             │  Phase 3):                    │   │
                             │  ┌─ #phase: "lobby"|"playing" │   │
                             │  │          |"ended"  (NEW)   │   │
                             │  └─ (all Phase 3 fields…)     │   │
                             └───────────────────────────────┘   │
                                                                 │
                             ┌───────────────────────────────┐   │
                             │  CLIENT A (winner) on receive │   │
                             │                               │◀──┤
                             │  ws.message("winDeclared")    │   │
                             │    ├─ store.winner = {id,name}│   │
                             │    ├─ store.winningLine = ... │   │
                             │    ├─ store.winningCellIds=...│   │
                             │    ├─ state.phase = "ended"   │   │
                             │    │                          │   │
                             │    └─ if winnerId==selfId:    │   │
                             │       dynamic import          │   │
                             │       canvas-confetti +       │   │
                             │       fire burst (one-shot)   │   │
                             │                               │   │
                             │  +page.svelte                 │   │
                             │    {#if phase=='ended'}       │   │
                             │       <EndScreen />           │   │
                             │       ├─ "BINGO!" wordmark    │   │
                             │       ├─ Frozen board snap    │   │
                             │       │  (winner view only)   │   │
                             │       │  ─ win-line cells     │   │
                             │       │    get ring glow      │   │
                             │       └─ "Start new game" CTA │   │
                             │         (host only)           │   │
                             └───────────────────────────────┘   │
                                                                 │
                             ┌───────────────────────────────┐   │
                             │  CLIENT B (non-winner)        │◀──┘
                             │                               │
                             │  ws.message("winDeclared")    │
                             │    ├─ store.winner = {...}    │
                             │    ├─ store.winningLine = ... │
                             │    ├─ state.phase = "ended"   │
                             │    └─ NO confetti             │
                             │                               │
                             │  +page.svelte                 │
                             │    {#if phase=='ended'}       │
                             │       <EndScreen />           │
                             │       ├─ "{Name} got Bingo!"  │
                             │       ├─ <WinLineIcon         │
                             │       │    gridSize=N         │
                             │       │    winningLine={...}/>│
                             │       └─ "Waiting for host"   │
                             │         placeholder           │
                             └───────────────────────────────┘
```

**Data-flow trace (primary use case — winner's final mark):**

1. Winner taps the last cell completing a line (tap reuses Phase 3 `toggleMark()` → `markWord` ClientMessage).
2. DO `markWord` handler: toggles `#marks[playerId]`, persists, broadcasts `wordMarked` (Phase 3 unchanged).
3. DO `markWord` handler continues: calls `detectWin(myBoard, myMarks)` — returns `{ winningLine, winningCellIds } | null`.
4. On win (non-null):
   - Sets `#phase = 'ended'`, calls `#persistPhase()`.
   - Reads winner's display name from `this.#players.get(playerId)`.
   - Broadcasts `winDeclared { winnerId, winnerName, winningLine, winningCellIds }`.
5. All clients receive `winDeclared`:
   - Store updates: `winner`, `winningLine`, `winningCellIds`, `state.phase = 'ended'`.
   - If `winnerId === selfPlayerId`: dynamic `import('canvas-confetti')` + fire burst (guarded in handler, not in `$effect`, so reconnect hydration doesn't re-fire).
6. `+page.svelte` phase conditional now matches `'ended'` → renders `<EndScreen />`.
   - Winner sees: "BINGO!" wordmark + frozen board snapshot (from existing `store.board` + ring glow on `winningCellIds`) + host's "Start New Game" CTA (if host).
   - Non-winner sees: `{WinnerDisplayName} got Bingo!` heading + `<WinLineIcon>` + "Waiting for host" placeholder.
7. Host clicks "Start New Game":
   - Client sends `{ type: "startNewGame" }`.
   - DO host-guard check → clears `#boards`, `#marks`, sets `#phase = 'lobby'`, persists all three.
   - Broadcasts `gameReset`.
8. All clients receive `gameReset`:
   - Clear: `board = null`, `markedCellIds = new Set()`, `playerMarks = {}`, `winner = null`, `winningLine = null`, `winningCellIds = []`.
   - Set: `state.phase = 'lobby'`.
   - Retained: `words` (pool unchanged), `players`, `hostId`, `usedPacks`.
9. `+page.svelte` phase conditional now matches `'lobby'` (default) → renders the existing Phase 2 lobby. Word pool, pack buttons, Start Game button all re-enable per Phase 2 logic.

**Total round-trip to peer visual (mark → winDeclared seen by non-winner):** ~50–150ms WS + <1ms DO compute (line detection is 2N+2 iterations × N cells each, max 12 × 5 = 60 comparisons) + <16ms client render. Well under 1s on any plausible network.

### Recommended Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── EndScreen.svelte        # NEW — phase==="ended" root surface
│   │   ├── WinLineIcon.svelte      # NEW — mini grid icon for non-winners
│   │   ├── BoardCell.svelte        # MODIFIED — accept data-win-line attribute (scoped CSS rule)
│   │   └── (all other Phase 1/2/3 components — UNCHANGED)
│   ├── protocol/
│   │   └── messages.ts             # MODIFIED — add WinningLine object, 3 message variants, expand RoomState.phase
│   ├── stores/
│   │   └── room.svelte.ts          # MODIFIED — add winner/winningLine/winningCellIds state + winDeclared/gameReset handlers + startNewGame sender
│   └── util/
│       └── winLine.ts              # NEW — detectWin() + formatWinLine() + winLineCellIndices() pure functions
├── routes/
│   └── room/[code]/
│       └── +page.svelte            # MODIFIED — add {:else if state.phase === 'ended'}<EndScreen />{/if} branch
party/
└── game-room.ts                     # MODIFIED — win detection in markWord, startNewGame handler, #phase union expansion
tests/
└── unit/
    ├── winLine.test.ts              # NEW — pure-function tests: row/col/diagonal detection, blank-cell handling, negative cases
    ├── EndScreen.test.ts            # NEW — winner vs non-winner vs host render paths
    ├── WinLineIcon.test.ts          # NEW — correct cells highlighted for every (type, index, gridSize) combination
    ├── game-room.test.ts            # EXTENDED — describe block "GameRoom — win & reset (Phase 4)"
    ├── protocol.test.ts             # EXTENDED — 3 new variant schemas + RoomState phase union + WinningLine object
    └── room-store.test.ts           # EXTENDED — winDeclared + gameReset handler tests; startNewGame sender
e2e/
└── win-and-reset.spec.ts            # NEW — two-browser flow: host+peer, seed 5 words, start, mark until row complete, assert EndScreen on both, host clicks New Game, assert both return to lobby
```

### Pattern 1: Pure-Function Win Detection

**What:** Deterministic line-enumeration over the player's own board + marks. Returns the first completed line found, or `null`.

**When to use:** Called from the DO's `markWord` handler after the mark toggle. Also unit-testable in isolation.

**Critical detail:** Blank cells are "pre-satisfied" — a line is complete if every cell on that line is either `blank === true` OR `cellId ∈ marks`. The algorithm iterates `2N + 2` candidate lines (N rows, N columns, 2 diagonals) and returns the first one that passes. Order of enumeration is deterministic (rows → cols → diagonals), which matters for visual consistency if two lines complete simultaneously (vanishingly unlikely in practice — only possible if a single mark completes two lines, e.g., the center cell on a 3×3 when all others are marked).

**Example:**

```typescript
// src/lib/util/winLine.ts — pure functions, unit-testable without DO harness
// NOTE: Codebase convention is src/lib/util/ (singular). UI-SPEC text writes "utils" once;
// use "util" to match Phase 3's shuffle.ts, gridTier.ts, etc.

import type { BoardCell } from "$lib/protocol/messages";

export type WinningLine = {
  type: "row" | "col" | "diagonal";
  index: number; // row/col: 0-based; diagonal: 0 = main (TL→BR), 1 = anti (TR→BL)
};

export type WinResult = {
  winningLine: WinningLine;
  winningCellIds: string[];
};

/**
 * Detect whether the given board + marks complete a line.
 * Returns the first completed line (row → col → diagonal order) or null.
 * A line is complete when every cell on it is either blank or in `marks`.
 */
export function detectWin(cells: BoardCell[], marks: Set<string>): WinResult | null {
  const n = cells.length === 25 ? 5 : cells.length === 16 ? 4 : 3;

  const isSatisfied = (idx: number): boolean => {
    const cell = cells[idx];
    return cell.blank || marks.has(cell.cellId);
  };

  // Rows
  for (let r = 0; r < n; r++) {
    const indices = Array.from({ length: n }, (_, c) => r * n + c);
    if (indices.every(isSatisfied)) {
      return {
        winningLine: { type: "row", index: r },
        winningCellIds: indices.filter((i) => !cells[i].blank).map((i) => cells[i].cellId),
      };
    }
  }

  // Cols
  for (let c = 0; c < n; c++) {
    const indices = Array.from({ length: n }, (_, r) => r * n + c);
    if (indices.every(isSatisfied)) {
      return {
        winningLine: { type: "col", index: c },
        winningCellIds: indices.filter((i) => !cells[i].blank).map((i) => cells[i].cellId),
      };
    }
  }

  // Main diagonal (top-left → bottom-right)
  {
    const indices = Array.from({ length: n }, (_, i) => i * n + i);
    if (indices.every(isSatisfied)) {
      return {
        winningLine: { type: "diagonal", index: 0 },
        winningCellIds: indices.filter((i) => !cells[i].blank).map((i) => cells[i].cellId),
      };
    }
  }

  // Anti-diagonal (top-right → bottom-left)
  {
    const indices = Array.from({ length: n }, (_, i) => i * n + (n - 1 - i));
    if (indices.every(isSatisfied)) {
      return {
        winningLine: { type: "diagonal", index: 1 },
        winningCellIds: indices.filter((i) => !cells[i].blank).map((i) => cells[i].cellId),
      };
    }
  }

  return null;
}

/** Human-readable win-line label. Source of truth for aria-labels + subline copy. */
export function formatWinLine(line: WinningLine): string {
  if (line.type === "row") return `Row ${line.index + 1}`;            // 1-indexed in UI
  if (line.type === "col") return `Column ${line.index + 1}`;         // 1-indexed in UI
  return line.index === 0 ? "Top-left diagonal" : "Top-right diagonal";
}

/**
 * Return the 0-based cell indices (row-major) for the cells on the given winning line
 * in a grid of gridSize × gridSize. Used by WinLineIcon to decide which cells highlight.
 */
export function winLineCellIndices(
  line: WinningLine,
  gridSize: 3 | 4 | 5
): number[] {
  const n = gridSize;
  if (line.type === "row") return Array.from({ length: n }, (_, c) => line.index * n + c);
  if (line.type === "col") return Array.from({ length: n }, (_, r) => r * n + line.index);
  if (line.index === 0) return Array.from({ length: n }, (_, i) => i * n + i);
  return Array.from({ length: n }, (_, i) => i * n + (n - 1 - i));
}
```

### Pattern 2: Extending the `markWord` DO Handler with Win Detection

**What:** After the Phase 3 `markWord` handler toggles + persists + broadcasts `wordMarked`, call `detectWin()`. On a win, flip `#phase`, persist, broadcast `winDeclared`.

**When to use:** The one place win detection runs. Nowhere else.

**Critical detail:** The win check MUST happen AFTER the mark is applied (otherwise the final mark wouldn't count). Also AFTER the `wordMarked` broadcast (so peers see the badge update before the win announcement — the two events are meaningful as a pair; reversing order creates a weird half-second where the badge hasn't caught up). And the `#phase = 'ended'` flip + persist must happen BEFORE the `winDeclared` broadcast, so any hibernation event mid-broadcast still sees the correct phase on wake.

**Example:**

```typescript
// party/game-room.ts — extension of the existing markWord case (lines 299-327)
// Source: Phase 3 pattern for markWord; this phase APPENDS the win-check tail.

import { detectWin } from "../src/lib/util/winLine.js";

case "markWord": {
  const connState = conn.state as { playerId?: string } | null;
  if (!connState?.playerId) return;
  if (this.#phase !== "playing") return;                       // phase guard (existing)

  const myBoard = this.#boards.get(connState.playerId);
  const myMarks = this.#marks.get(connState.playerId);
  if (!myBoard || !myMarks) return;

  const { cellId } = result.output;
  const cell = myBoard.find((c) => c.cellId === cellId);
  if (!cell || cell.blank) return;

  // Toggle — existing
  if (myMarks.has(cellId)) myMarks.delete(cellId);
  else myMarks.add(cellId);
  this.#persistMarks();

  // Existing broadcast — peer mark counts update first
  this.broadcast(JSON.stringify({
    type: "wordMarked",
    playerId: connState.playerId,
    markCount: myMarks.size,
  }));

  // NEW (Phase 4): win detection immediately after mark
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
}
```

**Why not detect win on unmark:** A player can toggle OFF a mark by tapping a second time. After an unmark, `detectWin` cannot newly return a line (removing a mark can't complete a previously-incomplete line). Skipping the check on unmark is a safe optimization — but the code above runs `detectWin` on every `markWord` (toggle direction doesn't matter for correctness). The cost is negligible. Do not optimize prematurely.

### Pattern 3: Client-Side Win Declaration Handler + Confetti

**What:** Extend the `room.svelte.ts` message handler with a `winDeclared` case. Set store fields. Guard the confetti call on `winnerId === selfPlayerId`.

**When to use:** The single client entry point for win data.

**Critical detail (SSR):** `canvas-confetti` imports the DOM. Direct top-level `import` would crash during `svelte-kit build` SSR (`window is not defined`). Use **dynamic `import()`** inside the message handler so the module only loads in the browser. The store runs client-side (ws client), but `room.svelte.ts` is imported by SvelteKit's route module graph — defensive dynamic import is the safe pattern.

**Critical detail (confetti one-shot):** Fire confetti from the MESSAGE HANDLER (imperative), not from a `$effect` watching `store.winner`. If a future reconnect (Phase 5) rehydrates `store.winner` from `RoomState`, the `$effect` would re-fire confetti — jarring. The message handler only runs when a fresh `winDeclared` arrives.

**Example:**

```typescript
// src/lib/stores/room.svelte.ts — extension of the existing message handler
// Source: existing boardAssigned/wordMarked handlers (Phase 3); dynamic import pattern per SvelteKit SSR docs.

// (existing $state declarations + add three)
let winner = $state<{ playerId: string; displayName: string } | null>(null);
let winningLine = $state<WinningLine | null>(null);
let winningCellIds = $state<string[]>([]);

ws.addEventListener("message", (ev) => {
  const parsed = v.safeParse(ServerMessage, JSON.parse((ev as MessageEvent).data));
  if (!parsed.success) return;
  const msg = parsed.output;

  switch (msg.type) {
    // ... existing cases ...

    case "winDeclared": {
      winner = { playerId: msg.winnerId, displayName: msg.winnerName };
      winningLine = msg.winningLine;
      winningCellIds = msg.winningCellIds;
      if (state) state = { ...state, phase: "ended" };

      // Fire confetti ONLY on the winner's client, and ONLY in a browser.
      // Dynamic import avoids SSR crash (canvas-confetti touches window).
      if (typeof window !== "undefined" && msg.winnerId === player.playerId) {
        import("canvas-confetti").then(({ default: confetti }) => {
          confetti({
            particleCount: 180,
            spread: 90,
            startVelocity: 45,
            ticks: 220,
            origin: { y: 0.25 },
            colors: ["#F5D547", "#F5F5F7", "#F87171"],
            disableForReducedMotion: false, // UI-SPEC: reduced-motion still fires, with a smaller config (see branch below)
          });
        }).catch(() => {
          // If the confetti module fails to load (offline, CDN issue), fail silently —
          // the EndScreen copy and layout still convey the win.
        });
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
  }
});

// Expose in the return object:
return {
  // ... existing ...
  get winner() { return winner; },
  get winningLine() { return winningLine; },
  get winningCellIds() { return winningCellIds; },
  startNewGame() {
    ws.send(JSON.stringify({ type: "startNewGame" }));
  },
};
```

**Reduced-motion variant (inside the same import callback):**
```typescript
const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
confetti(
  reduce
    ? { particleCount: 60, spread: 90, ticks: 100, origin: { y: 0.25 }, colors: ["#F5D547", "#F5F5F7", "#F87171"] }
    : { particleCount: 180, spread: 90, startVelocity: 45, ticks: 220, origin: { y: 0.25 }, colors: ["#F5D547", "#F5F5F7", "#F87171"] }
);
```

UI-SPEC Motion section explicitly requires reduced-motion to still fire confetti (just smaller) — the burst IS the celebration contract per CONTEXT D-04. Do NOT pass `disableForReducedMotion: true`, because that would remove the burst entirely.

### Pattern 4: WinLineIcon Component

**What:** A 64×64 dark card with internal `N × N` cells; cells on the winning line are highlighted in white.

**When to use:** Rendered on non-winner EndScreens to show which line completed, without exposing the winner's board layout (BOAR-03 preserved).

**Critical detail:** Derive highlighted indices from `winLineCellIndices(line, gridSize)`. Use Tailwind's grid utilities with a dynamic `grid-cols-{N}` — but since v4 Oxide doesn't support arbitrary class compositions reliably, use inline `style="grid-template-columns: repeat(N, 1fr)"` (same pattern as Phase 3's early `Board.svelte` draft, then changed to literal `grid-cols-3/4/5` for Tailwind v4 scanner). Either pattern works; literal class names are scanner-safe:

```svelte
<!-- src/lib/components/WinLineIcon.svelte -->
<script lang="ts">
  import type { WinningLine } from "$lib/protocol/messages";
  import { winLineCellIndices } from "$lib/util/winLine";

  type Props = {
    gridSize: 3 | 4 | 5;
    winningLine: WinningLine;
  };
  let { gridSize, winningLine }: Props = $props();

  // Tailwind v4 scanner safety: enumerate literal class tokens.
  const colsClass = $derived(
    gridSize === 3 ? "grid-cols-3" : gridSize === 4 ? "grid-cols-4" : "grid-cols-5"
  );
  const highlightedSet = $derived(new Set(winLineCellIndices(winningLine, gridSize)));
  const totalCells = $derived(gridSize * gridSize);
</script>

<div
  class={["grid gap-[2px] w-16 h-16 p-1.5 bg-[var(--color-surface)] rounded border border-[var(--color-divider)]", colsClass].join(" ")}
  aria-label={`Winning line indicator`}
  role="img"
>
  {#each Array(totalCells) as _, i}
    <div
      class={highlightedSet.has(i)
        ? "bg-[var(--color-ink-primary)] rounded-[1px]"    /* white highlight */
        : "bg-[var(--color-divider)] rounded-[1px]"        /* dim */}
    ></div>
  {/each}
</div>
```

Source: D-05, D-07, UI-SPEC component inventory.

### Pattern 5: EndScreen Composition

**What:** The `phase === 'ended'` root surface. Branches on `isWinner` and `isHost` props.

**When to use:** Rendered from `/room/[code]/+page.svelte`'s phase conditional.

**Critical detail:** The EndScreen renders the frozen board by reading the existing `store.board` (populated during Phase 3's `boardAssigned`). The EndScreen wraps the `BoardCell` children inline in a `pointer-events: none` container — this avoids needing a "frozen" prop on `Board.svelte` and lets the EndScreen add the `data-win-line="true"` attribute to cells where `cellId ∈ winningCellIds`.

```svelte
<!-- src/lib/components/EndScreen.svelte -->
<script lang="ts">
  import type { BoardCell, WinningLine } from "$lib/protocol/messages";
  import BoardCellComp from "./BoardCell.svelte";
  import WinLineIcon from "./WinLineIcon.svelte";
  import Button from "./Button.svelte";
  import { formatWinLine } from "$lib/util/winLine";

  type Props = {
    winner: { playerId: string; displayName: string };
    winningLine: WinningLine;
    winningCellIds: string[];
    board: BoardCell[] | null;          // null for non-winners
    markedCellIds: Set<string>;
    isHost: boolean;
    isWinner: boolean;
    onStartNewGame: () => void;
  };
  let { winner, winningLine, winningCellIds, board, markedCellIds, isHost, isWinner, onStartNewGame }: Props = $props();

  const winCellIdSet = $derived(new Set(winningCellIds));
  const winLineLabel = $derived(formatWinLine(winningLine));
  const gridSize = $derived<3 | 4 | 5>(
    board == null || board.length === 9 ? 3 : board.length === 16 ? 4 : 5
  );
  const colsClass = $derived(
    gridSize === 3 ? "grid-cols-3" : gridSize === 4 ? "grid-cols-4" : "grid-cols-5"
  );
</script>

<section class="flex flex-col items-center gap-6 pt-8">
  {#if isWinner}
    <h1
      class="font-display text-[40px] sm:text-[56px] font-semibold text-[var(--color-accent)] tracking-[0.02em] leading-[1.1]"
      aria-live="polite"
    >
      BINGO!
    </h1>
    <p class="text-[24px] font-semibold text-[var(--color-ink-primary)]">{winner.displayName}</p>
    <p class="text-base text-[var(--color-ink-secondary)]">You called it. {winLineLabel}.</p>
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
  {:else}
    <h1 class="text-[24px] font-semibold text-[var(--color-ink-primary)]" aria-live="polite">
      {winner.displayName} got Bingo!
    </h1>
    <WinLineIcon {gridSize} {winningLine} />
    <p class="text-base text-[var(--color-ink-secondary)]">{winLineLabel} completed.</p>
    <p class="text-base text-[var(--color-ink-secondary)]">Nice try. One more round?</p>
  {/if}

  {#if isHost}
    <div class="flex flex-col gap-2 w-full sm:w-auto">
      <Button variant="primary" onclick={onStartNewGame}>
        {#snippet children()}Start new game{/snippet}
      </Button>
      <p class="text-sm text-[var(--color-ink-secondary)]">
        Word pool and players are kept. You can tweak the pool before starting.
      </p>
    </div>
  {:else}
    <p class="text-base text-[var(--color-ink-secondary)]">
      Waiting for the host to start a new game.
    </p>
  {/if}
</section>
```

**BoardCell.svelte modification (additive — one scoped CSS rule):**

Phase 4 adds a `data-win-line="true"` attribute-based ring glow. The cleanest place is a scoped `<style>` block in `BoardCell.svelte` (Svelte 5 supports `<style>` blocks per-component). Alternatively, put it in `src/app.css` with an attribute selector — since `BoardCell.svelte` currently has no `<style>` block (all utilities via Tailwind), adding a global CSS rule in `src/app.css` is the lower-friction path:

```css
/* src/app.css — append */
@keyframes winLinePulse {
  0%, 100% { box-shadow: 0 0 0 2px #F5D547, 0 0 8px #F5D547; }
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

This approach requires **zero change to `BoardCell.svelte`**. The `<div data-win-line="true">` wrapper in `EndScreen.svelte` is the only place the attribute is applied.

### Pattern 6: startNewGame Handler (DO-side reset)

**What:** Host-only DO handler that clears per-game state and broadcasts `gameReset`.

**When to use:** Called from the DO on `{ type: "startNewGame" }` from a host connection.

**Critical detail:** The handler must run the host-guard FIRST (matches existing `startGame`/`loadStarterPack` pattern), clear ALL three game-scoped fields (`#boards`, `#marks`, `#phase`), persist ALL three (hibernation safety — per Phase 3 pitfall), and broadcast `gameReset`. The `#words`, `#usedPacks`, `#players`, `#hostId` fields are NOT touched — per D-10 those are the retained identity of the room.

**Example:**

```typescript
// party/game-room.ts — new case in the onMessage switch
case "startNewGame": {
  const connState = conn.state as { playerId?: string } | null;
  if (connState?.playerId !== this.#hostId) return;        // host-only, silent
  // Optional: guard phase === "ended". CONTEXT D-10 does not require it.
  // We allow reset from any phase for resilience (e.g., host clicks twice).

  this.#boards.clear();
  this.#marks.clear();
  this.#phase = "lobby";

  this.#persistBoards();
  this.#persistMarks();
  this.#persistPhase();

  this.broadcast(JSON.stringify({ type: "gameReset" }));
  return;
}
```

### Anti-Patterns to Avoid

- **Detecting win on the client:** Fails D-08 / WIN-01. Also trivially cheatable. Client-side detection is a read-only convenience at best; the DO is the sole authority.
- **Including winner data in `RoomState`:** `RoomState` is the broadcast snapshot shape; event data belongs in event messages (`winDeclared`). Adding `winner` to `RoomState` now would complicate the Phase 5 reconnect-hydration work, which will have to decide what "current EndScreen" means. **Phase 4 deliberately leaves this for Phase 5.**
- **Firing confetti from a `$effect` on `store.winner`:** A reconnect that rehydrates `winner` would re-fire the burst. Guard on the message handler instead.
- **Static top-level `import confetti from "canvas-confetti"`:** Risks SSR crash. Use dynamic `import()` inside the handler or a `$effect` that runs client-only.
- **Detecting win BEFORE persisting marks:** If the DO hibernates between detect and persist, the mark is lost but the win has been declared — inconsistent state on wake. Order: toggle → persist marks → detect win → persist phase → broadcast.
- **Missing `#persistPhase()` on reset OR on win:** Hibernation wipes in-memory `#phase`. Without persistence, a DO wake would see `#phase === "lobby"` after a win and start accepting `markWord` messages again. Matches Phase 3's start-game bug.
- **Tapping a frozen cell registers a mark:** The EndScreen wraps the frozen board in `pointer-events: none`; the DO also rejects `markWord` when `#phase !== "playing"`. Defense in depth.
- **`gameReset` broadcast clears `words` or `usedPacks`:** Wrong. D-10 explicitly retains those. Clearing them would make play-again feel like a fresh room (users would have to re-seed packs).
- **Using `disableForReducedMotion: true`:** Removes confetti entirely for reduced-motion users. UI-SPEC requires a reduced burst instead (see Pattern 3 branch).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confetti animation | Hand-rolled CSS confetti with `@keyframes` | `canvas-confetti` 1.9.4 | 60fps canvas is the difference between "celebration" and "laggy pixels". Library handles particle physics, lifecycle, and reduced-motion. 10KB gzipped. Locked by CONTEXT D-04. |
| Line detection algorithm | Ad-hoc "is every cell in this row marked?" inlined in the DO | `detectWin()` in `src/lib/util/winLine.ts` | Pure function is unit-testable (no DO harness). Single source of truth. Same file also exports `formatWinLine()` + `winLineCellIndices()` so EndScreen, WinLineIcon, and aria-labels don't drift. |
| Host-only guard | New pattern | Existing Phase 2 `loadStarterPack` / `startGame` guard: `if (connState?.playerId !== this.#hostId) return;` | Established idiom in the codebase. Matches CONTEXT D-13 (silent drop for non-hosts). |
| DO state persistence | New persistence scheme | Existing `#persistPhase()`, `#persistBoards()`, `#persistMarks()` private helpers | Already wired for Phase 3. Reset handler just calls the same three. |
| WS message validation | Hand-rolled type guards for 3 new messages | `v.safeParse(ClientMessage, ...)` / `v.safeParse(ServerMessage, ...)` + Valibot `v.variant` extension | Existing pattern in `messages.ts`. All three new messages are variant-append jobs. |
| Phase-conditional render | New routing logic | Existing `{#if gameStarted} ... {:else} ...` in `+page.svelte` | Extend to `{#if phase === 'playing'} ... {:else if phase === 'ended'} ... {:else} ...`. Same file, same pattern. |
| Reactive `$state<Set>` mutation | `markedCellIds.add(cellId)` | `markedCellIds = new Set([...markedCellIds, cellId])` | Phase 3 Pitfall 3 — runes don't fire on in-place Set mutation. Applies to `gameReset` clearing too: `markedCellIds = new Set()`. |
| EndScreen-to-Lobby transition | SPA route change / `goto()` | Existing phase-conditional render | Matches D-01. WS stays alive; no reconnect flicker. |
| Confetti cleanup | Manual canvas removal | `canvas-confetti` auto-removes its canvas ~3s after last particle settles | [CITED: Context7 `/catdad/canvas-confetti` docs — `confetti.reset()` exists but is not needed for a single burst; the library cleans up on its own]. If we need it, the import callback can grab `confetti.reset` and call on page unload. |

**Key insight:** Phase 4 is **mostly assembly**. The hardest technical decision (library for confetti) is locked by CONTEXT. Every server-side idiom (host guard, broadcast, per-field persist, hibernation-safe mutation) exists in the codebase as a direct template. The only **new primitive** anywhere is the dynamic `import("canvas-confetti")` call — roughly 8 lines of TypeScript.

## Runtime State Inventory

> Skipped — Phase 4 is a greenfield feature phase. No rename, refactor, migration, or string-replacement work is involved. The DO has persistent storage (`ctx.storage`), but Phase 4 only adds to it (expanded phase literal, persists identically to Phase 3's `#phase`) — no existing data is being renamed or migrated.

Explicit check by category:

| Category | Status |
|----------|--------|
| **Stored data** | None — DO storage keys (`phase`, `boards`, `marks`) already exist; Phase 4 only writes different values to the existing `phase` key (the literal `"ended"` joins `"lobby"` / `"playing"`). No key renames. |
| **Live service config** | None — no Cloudflare dashboard config, no n8n, no external service identifiers tied to Phase 4 names. |
| **OS-registered state** | None — Cloudflare Workers runtime; no OS-level task scheduling. |
| **Secrets / env vars** | None — no secret keys reference Phase 4 strings. |
| **Build artifacts** | None — no compiled binaries, no pip egg-info, no Docker tags with phase-4 strings. |

## Environment Availability

> Skipped — Phase 4 has no new external dependencies beyond the existing toolchain (Node, npm, Wrangler, Playwright). The canvas-confetti npm package is installed via `npm install` like every other dep; no CLI, no running service, no database. The existing Phase 1 dev environment (Wrangler + Vitest + Playwright) covers everything.

## Common Pitfalls

### Pitfall 1: Win declared but mark not persisted (hibernation corruption)

**What goes wrong:** DO hibernates between `#marks.add(cellId)` and `#persistMarks()`. On wake, the mark is gone — but the `winDeclared` broadcast already fired, so clients have frozen boards showing the win state. If a `roomState` refresh arrives later (e.g., from a new connection), clients see inconsistent data.

**Why it happens:** DO hibernation evicts in-memory state at any point between requests. Any mutation not backed by `ctx.storage` is lost.

**How to avoid:** Order must be: `toggle → #persistMarks() → detectWin → (on win) #persistPhase() → broadcast`. The existing Phase 3 `markWord` handler already calls `#persistMarks()` before the `wordMarked` broadcast; keep the win check after that persist, and before its own broadcast.

**Warning signs:** Unit test: stub `ctx.storage` with a recorder, run a mark that completes a line, assert that `put(K_MARKS, ...)` was called BEFORE `broadcast(winDeclared)`. Ordering assertion, not just presence.

### Pitfall 2: `#phase = 'ended'` not persisted → wake accepts marks again

**What goes wrong:** Same class as Pitfall 1, but for `#phase`. Without `#persistPhase()` after the `= "ended"` flip, a hibernation wake restores `#phase = "playing"` from storage (or the default from `onStart`). Clients still see the EndScreen (their own state is locally held), but the DO accepts `markWord` from any player — a peer could continue marking cells and receive `wordMarked` broadcasts, creating phantom mark counts on all EndScreens.

**Why it happens:** The Phase 3 bug recurrence pattern — forgetting to persist a newly-mutated field. STATE.md explicitly notes this as a lesson learned: "DO hibernation requires persist+rehydrate for all in-memory state."

**How to avoid:** After any `this.#phase = X` assignment, call `this.#persistPhase()` on the very next line. Same for `#boards.clear()` → `#persistBoards()` and `#marks.clear()` → `#persistMarks()` in the reset handler. Unit test: after each handler that mutates phase/boards/marks, assert the matching persist helper was called in the same synchronous flow.

**Warning signs:** Unit test: run `startNewGame` then simulate a `markWord` from a non-host player; assert no `wordMarked` broadcast. Then simulate hibernation (reset the in-memory fields to defaults, re-run `onStart` rehydration from the storage mocks) and repeat — the `wordMarked` should still be blocked because `#phase` restored as `"lobby"`.

### Pitfall 3: canvas-confetti SSR crash

**What goes wrong:** Top-level `import confetti from "canvas-confetti"` in `room.svelte.ts` breaks `svelte-kit build` or any SSR path, because the library touches `window` during module initialization. Build fails with `ReferenceError: window is not defined`.

**Why it happens:** SvelteKit SSRs every route by default during build (prerender + HTML generation). Even though `room.svelte.ts` is a client-side file (sets up a WebSocket), SvelteKit's module graph eagerly imports it during the route-detection pass.

**How to avoid:** Use `import("canvas-confetti").then(...)` inside the message handler (dynamic import is lazy — only runs when the handler runs, which is browser-only). Alternative: put `if (typeof window !== "undefined")` around the entire confetti block (works but is less clean than dynamic import because it still statically imports the module).

**Warning signs:** `npm run build` fails with "window is not defined" or "document is not defined". If it builds successfully, you did it right.

### Pitfall 4: gameReset doesn't clear client-side state completely

**What goes wrong:** The client receives `gameReset`, flips `state.phase = "lobby"`, but leaves `board` / `markedCellIds` / `playerMarks` / `winner` / `winningLine` populated. When `+page.svelte` renders the lobby, the old state is still in the store — on the next `startGame`, the old board flashes before `boardAssigned` arrives with fresh cells.

**Why it happens:** It's easy to write a handler that only flips the phase and forgets all the derived state the lobby doesn't use but the Board/EndScreen did. Seven fields to clear: `board`, `markedCellIds`, `playerMarks`, `winner`, `winningLine`, `winningCellIds`, and `state.phase` itself.

**How to avoid:** Define a single `clearGameScopedState()` helper inside `createRoomStore` and call it from the `gameReset` handler. List every field. Any new game-scoped field added in future phases goes in there.

**Warning signs:** Unit test: populate all seven fields, emit `gameReset`, assert all seven are their post-reset values (board null, all three Sets empty, three win-fields null/empty array, phase "lobby"). The assertion surfaces any forgotten field.

### Pitfall 5: Win check runs on unmark and panics

**What goes wrong:** If `detectWin` is called with a mark Set that was just emptied by a second-tap unmark, nothing should happen. But if a future version of `detectWin` assumes a non-empty Set (e.g., starts from a marked cell and looks for adjacent completions), an empty Set could cause a subtle bug.

**Why it happens:** Implementer confuses "must have at least one mark" with "must have a complete line." Empty Set can't complete a line (unless blanks cover the entire line, which can happen on a 3×3 with only 5 words — center + 4 corners are words, 4 middle-edge are blanks; a diagonal could be all blanks).

**How to avoid:** `detectWin` is purely structural — iterate all 2N+2 lines, check each. Blanks are pre-satisfied. Empty marks → no word-cells satisfied; a line completes only if EVERY cell on the line is blank. That case is mathematically possible for a 3×3 (5 words / 4 blanks) but vanishingly rare. If it happens legitimately, the DO declares the win — the winner happens to be the first player assigned a board whose all-blanks diagonal completed before any mark. **This is not a bug — it's emergent behavior of the blank-equals-satisfied rule (D-10).**

**Warning signs:** Unit test: a 3×3 board with 5 words where the main diagonal happens to be 3 blanks → `detectWin(cells, new Set())` returns `{ type: "diagonal", index: 0, winningCellIds: [] }`. Implementation must return `winningCellIds: []` correctly (no word cells on the line; ring glow highlights nothing on the frozen board for this edge case — the WinLineIcon still correctly shows the diagonal). **Confirm this is acceptable behavior with the planner.** Edge case is so unlikely it's not worth special-casing — but document it.

### Pitfall 6: Host leaves during EndScreen, nobody can start a new game

**What goes wrong:** Host disconnects while EndScreen is showing. `#hostId` stays pointed at the departed player (per Phase 1 D-14 — host transfer is Phase 5). No connected player passes the host-guard on `startNewGame`. The room is effectively stuck.

**Why it happens:** Host-transfer is explicitly deferred to Phase 5 (RESI-05). Phase 4 inherits this limitation.

**How to avoid:** **Do not solve in Phase 4.** Document the limitation in the `## Open Questions` section below. The UX fallback is that the other players close the tab and reopen via the original join link — but a new connection won't rehydrate them as host either (same `#hostId`). The lesson: Phase 5 resilience work must cover "host leaves during end screen" alongside "host leaves during gameplay."

**Warning signs:** Manual test. Playwright e2e: host disconnects after `winDeclared`, peer clicks nothing (no CTA exists for non-hosts), peer closes tab and re-opens to the room code — `#hostId` is unchanged; the peer sees the EndScreen (depending on Phase 5 hydration) but still no Start New Game button. **This is the expected behavior for Phase 4.**

### Pitfall 7: Tailwind v4 scanner misses dynamic class names

**What goes wrong:** `WinLineIcon.svelte` uses `grid-cols-${gridSize}` template literal or inline `style="grid-template-columns: repeat(${n}, 1fr)"`. The Tailwind v4 Oxide scanner parses source for literal class tokens — dynamic compositions aren't always picked up.

**Why it happens:** Tailwind v4 Oxide is faster but stricter about literal class tokens. Phase 3's `Board.svelte` had this exact issue and resolved by enumerating literal tokens in a `$derived` ternary (not template literal).

**How to avoid:** Use the Phase 3 pattern — `$derived` returning a literal class name string, chosen from a small set:
```typescript
const colsClass = $derived(
  gridSize === 3 ? "grid-cols-3" : gridSize === 4 ? "grid-cols-4" : "grid-cols-5"
);
```

**Warning signs:** The rendered DOM shows the class name in `class=`, but DevTools shows `display: initial` (Tailwind's rule didn't generate). Hard refresh or check `tailwind.css` for the missing utility. **Verify with Playwright e2e that the grid actually renders as 3/4/5 columns at runtime.**

### Pitfall 8: Confetti fires on every `winDeclared` — including replays on reconnect

**What goes wrong:** Phase 5 reconnect work (future) replays missed messages including `winDeclared`. Current handler fires confetti every time `winDeclared` arrives. On reconnect mid-EndScreen, the winner gets a fresh confetti burst — jarring.

**Why it happens:** The handler doesn't distinguish "first-time win" from "rehydrate-win-state."

**How to avoid:** **Phase 4 can ignore this** — there is no reconnect replay in Phase 4. Document that Phase 5's reconnect handler must suppress confetti on replay. One option for Phase 5: reconnect uses a `roomState` snapshot (not message replay), which naturally avoids re-invoking `winDeclared` handlers. **Flag this for Phase 5 planning, do not solve now.**

## Code Examples

All code examples above are drawn from verified Context7 sources or Phase 3's established patterns.

### Minimal end-to-end trace (new markWord tail + new handler)

```typescript
// party/game-room.ts — complete new-case shape + markWord extension
// Source: Phase 3 pattern; canvas-confetti via Context7 /catdad/canvas-confetti

// Inside onMessage switch:
case "startNewGame": {
  const connState = conn.state as { playerId?: string } | null;
  if (connState?.playerId !== this.#hostId) return;
  this.#boards.clear();
  this.#marks.clear();
  this.#phase = "lobby";
  this.#persistBoards();
  this.#persistMarks();
  this.#persistPhase();
  this.broadcast(JSON.stringify({ type: "gameReset" }));
  return;
}
```

```typescript
// src/lib/protocol/messages.ts — variant append + union expansion
// Source: Phase 3 PATTERNS.md extension pattern

// NEW: WinningLine object
export const WinningLine = v.object({
  type: v.picklist(["row", "col", "diagonal"]),
  index: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type WinningLine = v.InferOutput<typeof WinningLine>;

// MODIFIED RoomState — phase union expansion:
export const RoomState = v.object({
  code: v.string(),
  phase: v.union([v.literal("lobby"), v.literal("playing"), v.literal("ended")]),  // + "ended"
  hostId: v.nullable(v.string()),
  players: v.array(Player),
  words: v.array(WordEntry),
  usedPacks: v.array(v.string()),
});

// NEW ClientMessage variant (append to existing variant array):
v.object({ type: v.literal("startNewGame") }),

// NEW ServerMessage variants (append to existing variant array):
v.object({
  type: v.literal("winDeclared"),
  winnerId: v.pipe(v.string(), v.minLength(1)),
  winnerName: v.pipe(v.string(), v.minLength(1)),
  winningLine: WinningLine,
  winningCellIds: v.array(v.string()),
}),
v.object({ type: v.literal("gameReset") }),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side win detection + peer verification | Server-authoritative detection (DO) | Established by CONTEXT D-08, WIN-01 | Phase 4 takes the only correct shape; no alternatives considered. |
| Polling for game-end status | WebSocket `winDeclared` broadcast | Phase 1 transport choice (locked) | Sub-1s peer visibility inherited from Phase 3 mark-count work. |
| Full page-refresh on play-again | Phase-conditional SPA render | CONTEXT D-11 | WS stays alive across reset — zero reconnect cost. |
| `@particles/` (heavyweight) or custom CSS confetti | `canvas-confetti` (10KB, canvas-based, framework-neutral) | CONTEXT D-04 | Single drop-in dependency; no framework-specific wrapper needed. |

**Deprecated/outdated:** None — all patterns are current as of 2026-04-18.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.0 (unit) + Playwright 1.49.0 (e2e) — inherited from Phase 3 |
| Config file | Implicit Vitest config via SvelteKit; `playwright.config.ts` |
| Quick run command | `npm run test:unit -- tests/unit/<file>.test.ts -t "<name>"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIN-01 | Server checks every mark for win | unit | `npm run test:unit tests/unit/game-room.test.ts -t "Phase 4"` | ❌ Wave 0 |
| WIN-01 | Pure detectWin() covers rows/cols/both diagonals, blanks as satisfied | unit | `npm run test:unit tests/unit/winLine.test.ts` | ❌ Wave 0 |
| WIN-02 | winDeclared broadcast on win | unit | `npm run test:unit tests/unit/game-room.test.ts -t "winDeclared"` | ❌ Wave 0 |
| WIN-02 | winDeclared payload shape validates via Valibot | unit | `npm run test:unit tests/unit/protocol.test.ts -t "winDeclared"` | ❌ Wave 0 (extend existing) |
| WIN-03 | Winner's client fires confetti; non-winner does not | unit | `npm run test:unit tests/unit/room-store.test.ts -t "winDeclared"` | ❌ Wave 0 (extend existing) |
| WIN-03 | EndScreen renders "BINGO!" for winner, heading for non-winner | unit | `npm run test:unit tests/unit/EndScreen.test.ts` | ❌ Wave 0 |
| WIN-04 | WinLineIcon highlights correct cells for every (type, index, gridSize) | unit | `npm run test:unit tests/unit/WinLineIcon.test.ts` | ❌ Wave 0 |
| WIN-04 | All players see the EndScreen within 1s (e2e) | e2e | `npm run test:e2e tests/e2e/win-and-reset.spec.ts -t "both players see EndScreen"` | ❌ Wave 0 |
| WIN-05 | startNewGame resets DO state (host-only guard) | unit | `npm run test:unit tests/unit/game-room.test.ts -t "startNewGame"` | ❌ Wave 0 |
| WIN-05 | gameReset clears client store; returns to lobby | unit | `npm run test:unit tests/unit/room-store.test.ts -t "gameReset"` | ❌ Wave 0 (extend existing) |
| WIN-05 | Host clicks New Game; both players land in lobby with words retained | e2e | `npm run test:e2e tests/e2e/win-and-reset.spec.ts -t "host starts new game"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test:unit -- tests/unit/<touched>.test.ts`
- **Per wave merge:** `npm run test:unit`
- **Phase gate:** Full suite green (`npm test`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/winLine.test.ts` — NEW — covers WIN-01 detection for every line type, all three grid sizes, blank-satisfaction, negative cases, and edge cases (empty marks, all-blanks line)
- [ ] `tests/unit/EndScreen.test.ts` — NEW — winner vs non-winner vs host render paths, aria-live, "Start new game" CTA visibility
- [ ] `tests/unit/WinLineIcon.test.ts` — NEW — cell-highlight correctness for every (type, index, gridSize) combination
- [ ] `tests/unit/game-room.test.ts` — EXTENDED — new describe block "GameRoom — win & reset (Phase 4)": win detection on completing mark, no winDeclared on non-completing mark, host-only startNewGame, gameReset clears boards/marks/phase, hibernation-safe rehydration of `phase: "ended"`
- [ ] `tests/unit/protocol.test.ts` — EXTENDED — parse tests for `startNewGame`, `winDeclared`, `gameReset`, the expanded `RoomState.phase` union, and the `WinningLine` object
- [ ] `tests/unit/room-store.test.ts` — EXTENDED — handler tests for `winDeclared` (fields set, phase flipped, confetti fired via mock), `gameReset` (all fields cleared, phase back to lobby), `startNewGame` sender
- [ ] `tests/e2e/win-and-reset.spec.ts` — NEW — two-browser flow: host + peer, seed 5+ words (3×3), host starts, host marks row to completion, both browsers see EndScreen (winner's BINGO vs peer's mini-grid), host clicks Start New Game, both browsers return to lobby with words retained

*(Extension to existing unit suites is preferred over new files where a describe block fits — matches Phase 3 PATTERNS.md convention.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in v1 (zero-signup per PROJECT.md) |
| V3 Session Management | partial | Player identity is `sessionStorage`-held `playerId`; server validates connection-to-playerId via Phase 1 `hello` handshake |
| V4 Access Control | yes | Host-only guard on `startNewGame` (same pattern as `startGame`/`loadStarterPack`). Winner-attribution via `conn.state.playerId` — server uses connection state, not client-supplied `winnerId` |
| V5 Input Validation | yes | Valibot `v.safeParse(ClientMessage, ...)` — Phase 4 new messages (`startNewGame`) have no payload beyond `type`; no attack surface |
| V6 Cryptography | no | No crypto operations in Phase 4 (reset does not regenerate boards — that happens on next `startGame`, where Phase 3's Fisher-Yates applies) |

### Known Threat Patterns for SvelteKit + DO + WS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **Forged win claim** — client sends `{ type: "winDeclared" }` as a ClientMessage | Spoofing | Valibot rejects: `winDeclared` is in the `ServerMessage` variant, not `ClientMessage`. Even if a malicious client tried to inject, the DO only parses `ClientMessage` on `onMessage`. Threat has no surface. |
| **Host-impersonation reset** — non-host sends `{ type: "startNewGame" }` | Elevation of Privilege | DO guard: `if (connState?.playerId !== this.#hostId) return;`. Silent drop. Same pattern as `startGame`/`loadStarterPack`. |
| **Mark-spam after win** — player sends `markWord` after `winDeclared` | Tampering | Existing Phase 3 guard: `if (this.#phase !== "playing") return;`. Phase 4's `#phase = "ended"` blocks further marks immediately after the win. Persistence of `#phase` is the critical detail (Pitfall 2). |
| **Winner-name injection via displayName** | Tampering | `winnerName` comes from `this.#players.get(playerId).displayName`, which was set during `hello` with Valibot's `maxLength(20)` constraint. No HTML rendering in EndScreen (Svelte escapes by default). |
| **WebSocket flood** — spam `markWord` to force `detectWin` loop | DoS | `detectWin` is O(N²) on N=5 (25 cells, 12 lines × 5 cells) — 60 comparisons per call. Negligible. Cloudflare DO rate limits per-client connection implicitly via single-connection-per-room-per-player. |
| **Winner-cell enumeration leak** — non-winner client infers winner's board from `winningCellIds` | Information Disclosure | `winningCellIds` contains only the cellIds on the winning LINE (up to 5 IDs out of 9/16/25). That's 5/25 = 20% leakage of one player's board structure, limited to the one line. Non-winners don't know what words are in those cells (no text leak), only that the winner has some words there. Acceptable per CONTEXT D-06 (explicit decision to include). |

**No new security-sensitive code this phase.** All critical paths extend existing Phase 2/3 patterns that have been audited.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `wordMarked` broadcast should precede `winDeclared` broadcast (on the winning mark) so peers see the final badge increment before the announcement | Pattern 2 | Minor UX — badge "catches up" after announcement. No correctness impact. If planner prefers reversed order, swap two lines. |
| A2 | Confetti should still fire for `prefers-reduced-motion: reduce` users, but with a smaller config (60 particles, 100 ticks) rather than being disabled | Pattern 3 | UI-SPEC states this explicitly ("confetti is load-bearing"), but a disability-advocacy review might disagree. `disableForReducedMotion: true` is a one-line toggle if needed. |
| A3 | An all-blank winning line on a 3×3 is acceptable behavior (first player dealt a board with a blank-diagonal "wins" before any mark is made if blanks fall on that diagonal) | Pitfall 5 | Very unlikely in practice (specific permutation + first player), but possible. Could feel unfair. Discuss with planner — mitigation would be a "must have ≥1 marked word on the line" rule, adding a line in `detectWin`. |
| A4 | Host leaving during EndScreen leaves the room stuck with no Start New Game CTA — acceptable for Phase 4 because host-transfer is Phase 5 scope | Pitfall 6 | Users hit a dead-end if host leaves. Workaround is a new room. Document in HUMAN-UAT as a known limitation. |
| A5 | The CSS `@keyframes winLinePulse` rule lives in `src/app.css` (global), scoped via `[data-win-line="true"]` attribute selector. No change to `BoardCell.svelte` | Pattern 5 | Alternative: Svelte 5 `<style>` block inside `BoardCell.svelte`. The global approach is simpler and doesn't modify BoardCell. If the planner prefers component-scoped styles, move the rule. |
| A6 | On `gameReset`, the client-side `board` field is cleared to `null` (lobby doesn't need it); the next `startGame` will populate it via `boardAssigned` as usual | Pitfall 4 | If `gameReset` forgets to clear `board`, a flash of the previous board may show on the next game before `boardAssigned` arrives. Mitigated by thorough test coverage (assert all 7 fields cleared). |
| A7 | The `WinLineIcon` is 64×64 on every breakpoint (UI-SPEC non-negotiable); internal cells scale to fit | Pattern 4 | UI-SPEC locks this. If layout iteration reveals readability issues on 3×3 mobile, revisit — but unlikely given N ≤ 5 cells at 64px / 5 = ~12px per cell, which reads fine. |

**None of these assumptions block planning.** Each is either UI-SPEC-locked or has a safe default. Flag A3 (all-blank win) and A4 (host-leaves limitation) in discuss-phase if not already confirmed.

## Open Questions

1. **Should `detectWin` require at least one marked word on the winning line?**
   - What we know: Current algorithm treats all-blank lines as satisfied (`blank || marks.has(cellId)`). Mathematically possible on 3×3 with 5 words.
   - What's unclear: Product intent. Is "blank diagonal alone wins" an acceptable micro-surprise, or would it feel like a bug?
   - Recommendation: Document as A3 and leave current behavior. Users have low discovery chance; if a player complains, add `lineHasAtLeastOneMark` check in one line.

2. **Should `startNewGame` be guarded on `phase === "ended"`?**
   - What we know: CONTEXT D-10 does not specify. The current recommendation (Pattern 6) does NOT guard on phase — allows reset from any phase for resilience.
   - What's unclear: If a host accidentally clicks a duplicate "Start new game" (e.g., after a double-tap), a second reset from `phase === "lobby"` does nothing harmful (clears already-empty boards/marks). Safe.
   - Recommendation: No phase guard. Document as A-intentional. Minor robustness win.

3. **Host leaves during EndScreen — documented behavior?**
   - What we know: Host-transfer deferred to Phase 5 (RESI-05). Room is stuck if host leaves.
   - What's unclear: Should Phase 4 add a fallback (e.g., "anyone can start a new game after 30s of host absence")? Probably no — adds scope, conflicts with Phase 5 design space.
   - Recommendation: Document as A4. Test in HUMAN-UAT. Leave for Phase 5.

4. **Confetti burst during slow connection — what if the import fails?**
   - What we know: `import("canvas-confetti").catch(() => {})` silently swallows load failures. The EndScreen still renders correctly without the burst.
   - What's unclear: Should the planner add a fallback CSS animation? Probably not — the burst is sugar, not load-bearing.
   - Recommendation: Accept silent failure. No fallback required. Phase 4 is scope-constrained; a CSS fallback is deferrable to a "polish" follow-up if user reports it.

## Sources

### Primary (HIGH confidence)

- **Context7 `/catdad/canvas-confetti`** — topics fetched: `api options particleCount spread origin colors disableForReducedMotion`, `types typescript import module esm svelte`, `cleanup reset canvas mount unmount memory`. All API surface used (dynamic import, options object, reset behavior) verified against README.
- **canvas-confetti README** — https://github.com/catdad/canvas-confetti/blob/master/README.md — version, ESM/CJS import, `disableForReducedMotion` behavior
- **npm registry** — `npm view canvas-confetti version` → `1.9.4` published `2025-10-25T05:15:42.389Z` (verified 2026-04-18); `npm view @types/canvas-confetti version` → `1.9.0`
- **Existing codebase** — `party/game-room.ts`, `src/lib/stores/room.svelte.ts`, `src/lib/protocol/messages.ts`, `src/routes/room/[code]/+page.svelte`, `src/lib/components/BoardCell.svelte`, `src/lib/components/Board.svelte`
- **.planning/phases/03-board-generation-core-mark-loop/03-RESEARCH.md** — patterns, pitfalls, anti-patterns for DO handler extension and rune reactivity
- **.planning/phases/03-board-generation-core-mark-loop/03-PATTERNS.md** — file-level analog extraction for Phase 4 (same mapping exercise applies)
- **.planning/phases/04-win-detection-announcement-play-again/04-UI-SPEC.md** — component inventory, color/motion/copy contracts

### Secondary (MEDIUM confidence)

- **Fisher-Yates / blank-satisfaction reasoning** — derived from Phase 3 RESEARCH.md + basic combinatorics; no external source needed (pure algorithm)

### Tertiary (LOW confidence)

- None — no findings at this confidence level. All claims are either verified against the codebase, Context7, or the UI-SPEC.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — canvas-confetti verified via Context7 + npm registry; all other deps unchanged from Phase 3 (HIGH-verified).
- Architecture: HIGH — every DO pattern is a direct Phase 3 analog; no net-new server primitives.
- Pitfalls: HIGH — #phase persistence pitfall is codebase-documented (STATE.md learning). SSR + dynamic import pattern is SvelteKit orthodoxy. Set-mutation pitfall is Phase 3's documented trap.
- Client confetti integration: HIGH — Context7 + live README cover the exact API shape and SSR concerns.

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stack is stable; canvas-confetti last shipped 2025-10-25 so it's unlikely to churn)
