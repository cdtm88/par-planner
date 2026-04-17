# Phase 3: Board Generation & Core Mark Loop - Research

**Researched:** 2026-04-17
**Domain:** Server-authoritative board generation + real-time mark propagation over WebSocket Hibernation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Game Transition (Lobby → Board)**
- **D-01:** Board renders within existing `/room/[code]` route via conditional render — `{#if state.phase === 'playing'}<Board />{:else}<Lobby />{/if}`. No SvelteKit `goto()` navigation. WebSocket stays alive across the transition.
- **D-02:** `state.phase === 'playing'` is already tracked in `room.svelte.ts` (set on `gameStarted`). Phase 3 adds a `<Board />` component that the existing phase check renders.

**Board Delivery (Private Per-Player)**
- **D-03:** After `gameStarted`, server generates a unique Fisher-Yates-shuffled board for each connected player and sends via a player-specific `boardAssigned` ServerMessage on each individual connection (not broadcast). Board layout is never included in broadcast messages.
- **D-04:** Board state lives in the room store — `room.svelte.ts` adds a `board` reactive state field populated on `boardAssigned`. Board data: array of cells `{ cellId, wordId | null, text | null, blank: boolean }`.

**Mark Loop**
- **D-05:** Player taps a word cell → client sends `markWord { cellId }` ClientMessage → DO increments mark count for that player, records the mark, broadcasts `wordMarked { playerId, markCount }` to all connections. Board layout never leaked in `wordMarked`.
- **D-06:** Acting player's board updates optimistically on tap (immediate local state toggle), then confirmed/corrected by server response if needed.

**Mark Visibility for Peers**
- **D-07:** Extend existing `PlayerRow.svelte` with a live mark-count badge alongside each player's entry (e.g., "3" next to name). No new scoreboard surface or sidebar. Player list remains accessible during the game.
- **D-08:** `wordMarked` ServerMessage carries `{ playerId, markCount }` — store maintains a `playerMarks` map (`playerId → count`) updated on each `wordMarked`.

**Blank Cell Behavior**
- **D-09:** Blank cells are **inert/passive** — no word, no text, no click handler. Visually distinct (surface `#1A1A23` + faint dashed/dimmed border, no content). Tapping a blank does nothing.
- **D-10:** Win detection (Phase 4) counts blank cells as automatically satisfied in line checks. Board generation assigns `blank: true` to filler cells; win-check logic treats `blank === true` as pre-satisfied.
- **D-11:** Blank cells must have clear visual affordance that they are not interactive — no hover effect, no active state, cursor default.

**Board Visual Design**
- **D-12:** **Unmarked word cell:** Surface `#1A1A23`, white text, subtle border `#2A2A36`.
- **D-13:** **Marked word cell:** Accent fill `#F5D547` background + dark `#0F0F14` text (~5.9:1 WCAG AA; actual 14.1:1). No icon overlay.
- **D-14:** **Blank/inert cell:** Surface `#1A1A23`, faint dashed or 40%-opacity border, no text, no cursor-pointer.
- **D-15:** All cells minimum 44px tap target (BOAR-07). CSS grid with equal cell sizing. 3×3, 4×4, 5×5 auto-scale to viewport in portrait.
- **D-16:** Phase 4 win-line highlight must differentiate from marked state — a border glow, brightness boost, or overlay ring (not a conflicting fill color).

### Claude's Discretion

- Exact grid sizing algorithm (whether cells shrink text or truncate with ellipsis at 5×5)
- Whether the player list collapses or scrolls above the board on small mobile screens
- Animation for the mark transition (instant toggle vs brief scale/flash)
- Exact blank cell dashed border style

### Deferred Ideas (OUT OF SCOPE)

- Win detection and announcement → Phase 4 (WIN-01 through WIN-05)
- Reconnect/resume (board state recovery on disconnect) → Phase 5 (RESI-01 through RESI-06)
- Near-miss indicator (one cell from winning) → v2 (SOCL-02)
- Sound effects on mark → v2 (SOCL-03)
- Social-validation anti-cheat → v2 (SOCL-04)
- Win-line visual highlight (Phase 4 scope)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOAR-01 | Each player receives a uniquely generated bingo board upon game start | §Architecture Patterns — per-connection iteration in DO after `startGame`; each player gets own Fisher-Yates shuffle |
| BOAR-02 | Boards generated server-side using cryptographic randomness (Fisher-Yates shuffle) | §Code Examples — `crypto.getRandomValues()` driven Fisher-Yates; `party/game-room.ts` extension |
| BOAR-03 | Each player's board is private — only their own board layout is sent to them | §Architecture Patterns — `boardAssigned` sent via `conn.send()` on matching `conn.state.playerId`; never in `broadcast()` |
| BOAR-04 | Blank spaces distributed across the board to fill remaining cells (total cells minus word count) | §Standard Stack — `deriveGridTier` already in codebase; blanks fill `cellCount - wordCount` after shuffle |
| BOAR-05 | Player can click a word cell to mark it as called; cell shows visual marked state | §Code Examples — `BoardCell.svelte` optimistic toggle + `markWord` client send |
| BOAR-06 | Marked cells propagate to all players (peers see mark count, not board layout) | §Architecture Patterns — `wordMarked { playerId, markCount }` broadcast; no `cellId` or `text` in payload |
| BOAR-07 | Board displayed responsively and usable on mobile (minimum 44px tap targets) | §Code Examples — `min-h-11 min-w-11` + `aspect-ratio: 1/1` CSS grid; viewport fallback to horizontal scroll below 148px |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives enforced during Phase 3 (authoritative):

- **Stack is frozen:** SvelteKit 2.57.1 + Svelte 5.55.4 + PartyServer 0.4.1 + PartySocket 1.1.16 + Valibot 1.3.1 + nanoid 5.1.9. No new dependencies unless unavoidable. `[VERIFIED: npm view` against live registry 2026-04-17].
- **No Redux/Zustand/MobX:** Svelte 5 runes (`$state`, `$derived`, `$effect`) only.
- **No Next.js / React:** SvelteKit is the framework.
- **No Zod:** Valibot for all WS message validation.
- **No Socket.IO or managed WS vendors:** Durable Objects + WS Hibernation is the transport.
- **No polling:** mark propagation uses the live WebSocket only.
- **Tailwind v4 via `@theme` tokens** (no `tailwind.config.js`). Utilities reference `var(--color-*)` custom properties already declared in `src/app.css`.
- **GSD workflow enforcement:** all file changes go through `/gsd-execute-phase` task actions; no direct edits.
- **Sub-1s round-trip target** for peer mark visibility.

No conflict between these directives and the Phase 3 scope.

## Summary

Phase 3 extends the existing Phase 2 DO + Svelte 5 stack with a small set of surgical additions. The codebase is already in a healthy state for this phase: the `gameStarted` broadcast is in place (Phase 2), `conn.setState({ playerId })` is set after `hello`, the `#phase` state machine exists on the DO, and the room store already pipes `gameStarted` into a `state.phase = "playing"` flip.

Phase 3 adds **three new messages** (`boardAssigned`, `markWord`, `wordMarked`), **per-player DO state** (`#boards: Map<playerId, BoardCell[]>`, `#marks: Map<playerId, Set<cellId>>`), **one new client-side store field** (`board`, `playerMarks`), **two new Svelte components** (`Board.svelte`, `BoardCell.svelte`), and **one modification** to `PlayerRow.svelte` (mark-count badge).

**Primary recommendation:** Implement board generation as a synchronous loop inside the existing `startGame` handler in `party/game-room.ts` — (1) shuffle the word pool once per player using `crypto.getRandomValues()`-driven Fisher-Yates, (2) map to `BoardCell[]` (words first, then blanks filling to cellCount), (3) broadcast `gameStarted`, (4) iterate `this.getConnections()` and `conn.send()` each player's private `boardAssigned` on their connection. Use `conn.state.playerId` to route. This pattern is a direct PartyServer idiom and the only correct way to deliver per-player private payloads on a hibernated WebSocket.

The open invariant question flagged in STATE.md — bingo fairness — is addressed in §Common Pitfalls and §Open Questions below with a concrete recommendation: because every player's shuffle is an independent unbiased permutation of the same word pool with blanks randomly placed after the word slots, the winnability property reduces to "does every cell either contain a markable word or a `blank: true` filler" — which is trivially preserved by the generator. No additional spike needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Board shuffle (Fisher-Yates) | API / DO (`party/game-room.ts`) | — | D-03 mandates server-side generation. Client cannot be trusted with shuffle; privacy (D-04/BOAR-03) requires server-authored layout per player. |
| Per-player board storage | API / DO | — | `#boards: Map<playerId, BoardCell[]>` lives on the DO. Needed for Phase 4 win-check (DO evaluates lines). |
| Board delivery (private) | API / DO → Frontend (WS client) | — | `conn.send(boardAssigned)` is per-connection; PartyServer `broadcast()` is NOT used for board payloads (D-03). |
| Mark recording | API / DO | — | `#marks: Map<playerId, Set<cellId>>` — DO is authoritative. Required for Phase 4 win-check (DO evaluates lines against its own record). |
| Mark count broadcast | API / DO → All Frontends | — | `wordMarked { playerId, markCount }` broadcast. No layout in payload (D-05, BOAR-06). |
| Optimistic UI toggle | Frontend (Svelte 5 runes) | — | Local `markedCellIds: Set<cellId>` per D-06 — immediate visual response. |
| Board rendering | Frontend (Svelte components) | — | `<Board>` + `<BoardCell>` — pure render from reactive props. |
| Mark-count badge rendering | Frontend (`PlayerRow.svelte` extension) | — | Badge reads `playerMarks[playerId]` from store; no tier boundary crossing. |
| WebSocket transport | Cloudflare Platform (WS Hibernation) | — | Hibernation keeps idle rooms free (CLAUDE.md). No code concern this phase. |

**Tier-check sanity:** All four success-criteria data flows cross exactly one tier boundary (DO → client via WS). No capability is assigned to the wrong tier.

## Standard Stack

### Core (no changes — all already installed and version-verified)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `partyserver` | `0.4.1` | DO + WS Hibernation wrapper | [VERIFIED: `npm view partyserver version` → 0.4.1, 2026-04-17]. Locked stack per CLAUDE.md. `getConnections()` iteration is the per-player send idiom. |
| `partysocket` | `1.1.16` | Client-side WS with reconnect | [VERIFIED: `npm view partysocket version` → 1.1.16, 2026-04-17]. Already wired in `room.svelte.ts`. |
| `valibot` | `1.3.1` | WS message schema + validation | [VERIFIED: `npm view valibot version` → 1.3.1, 2026-04-17]. All three new messages extend the existing discriminated unions in `src/lib/protocol/messages.ts`. |
| `nanoid` | `5.1.9` | `cellId` generation per cell | [VERIFIED: `npm view nanoid version` → 5.1.9, 2026-04-17]. Already installed; used for `wordId`. Reuse pattern: `import { nanoid } from "nanoid"`. |
| `svelte` | `5.55.4` | UI + reactive state | [VERIFIED: `npm view svelte version` → 5.55.4, 2026-04-17]. `$state`, `$derived`, `$effect` runes. |
| Web Crypto API | (platform) | `crypto.getRandomValues()` for unbiased shuffle | [VERIFIED: Cloudflare Workers runtime docs — Web Crypto is a standard runtime API]. Satisfies BOAR-02. No polyfill needed. |

### Supporting (no new packages — reuse existing)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-svelte` | `^1.0.1` | Icons (none required this phase) | Phase 3 deliberately uses color contrast only (UI-SPEC confirms no check icon on marked cells). |
| Tailwind v4 via `@tailwindcss/vite` | `^4.2.2` | Utility classes for grid, cells, badge | `grid-cols-3/4/5`, `gap-2`, `aspect-square`, `min-h-11`. No custom CSS needed beyond what's in `src/app.css`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff — Why Not |
|------------|-----------|--------------------|
| `crypto.getRandomValues()` | `Math.random()` | Fails BOAR-02 (requires cryptographic randomness). `Math.random()` is also worse: implementation-defined distribution, not unbiased for shuffles. |
| `conn.send()` per-connection | `broadcast()` with payload | Fails D-03 / BOAR-03 (privacy). `broadcast()` would leak every player's layout to every connection. |
| Optimistic client-side toggle | Round-trip-then-render | Fails D-06 and the "same-frame" success criterion (#3). Tap → server → broadcast → render is ~100–200ms minimum — users perceive lag. Optimistic toggle makes the local response 0ms. |
| Per-cell `<div onclick>` | Per-cell `<button>` | Violates accessibility and keyboard navigation (UI-SPEC). `<button>` gives Tab/Enter/Space for free and is the ARIA default for actionable elements. |
| `nanoid` for cellId | `crypto.randomUUID()` | Identical outcome; `nanoid` is already installed and shorter. Saves 14 bytes per cell in payload. |
| Store marks as `Map<cellId, playerId>` on DO | `Map<playerId, Set<cellId>>` | The per-player shape directly supports Phase 4 win-check (iterate one player's marks against their board). The cellId-keyed shape would require a reverse lookup every win-check. Chose the directly useful shape. |

**Installation:** No packages to add. All dependencies are already in `package.json`.

## Architecture Patterns

### System Architecture Diagram

```
                             ┌───────────────────────────────┐
                             │  CLIENT (Svelte 5 + runes)    │
                             │                               │
   User taps                 │  BoardCell.svelte             │
   word cell  ──────────────▶│  ├─ onclick → local toggle    │
                             │  │   (optimistic, D-06)       │
                             │  └─ store.send({markWord,..}) │
                             │              │                │
                             │              ▼                │
                             │       PartySocket             │
                             └──────────────┬────────────────┘
                                            │ WebSocket (stays open
                                            │   across phase flip —
                                            │   D-01/D-02)
                                            ▼
                             ┌───────────────────────────────┐
                             │  DURABLE OBJECT (GameRoom)    │
                             │                               │
                             │  onMessage(conn, raw)         │
                             │    │                          │
                             │    ├─ "startGame" (Phase 2)   │
                             │    │    │                     │
                             │    │    ├─ gate: hostId check │
                             │    │    ├─ set #phase="playing│
                             │    │    ├─ broadcast gameStart│
                             │    │    │                     │
                             │    │    └─ FOR EACH conn:     │
                             │    │         ├─ Fisher-Yates  │
                             │    │         │  (crypto-rand) │
                             │    │         ├─ #boards.set() │
                             │    │         └─ conn.send(    │
                             │    │             boardAssigned)
                             │    │                          │
                             │    └─ "markWord" (NEW)        │
                             │         │                     │
                             │         ├─ validate cellId    │
                             │         │  against conn's     │
                             │         │  own board          │
                             │         ├─ toggle #marks entry│
                             │         ├─ compute markCount  │
                             │         └─ broadcast          │
                             │             wordMarked{pid,   │
                             │                       count}  │
                             │                               │
                             │  In-memory state:             │
                             │  ┌─ #boards:Map<pid,Cell[]>   │
                             │  ├─ #marks:Map<pid,Set<cid>>  │
                             │  └─ (Phase 2 fields…)         │
                             └───────────────────────────────┘

LEGEND:
  gameStarted      = broadcast (all)  — contains NO board data
  boardAssigned    = conn.send (one)  — contains THAT player's cells
  wordMarked       = broadcast (all)  — contains {playerId, markCount} only
```

**Data-flow trace (primary use case — player marks first cell):**

1. Host clicks Start Game → client sends `{ type: "startGame" }` (already working)
2. DO: `startGame` handler sets `#phase = "playing"`, broadcasts `gameStarted` (already working — Phase 2)
3. DO: iterates `this.getConnections()`, for each:
   - Reads `conn.state.playerId`
   - Generates Fisher-Yates permutation of `[...this.#words.values()]`
   - Builds `BoardCell[]` — each word becomes `{cellId: nanoid(), wordId, text, blank:false}`; remaining slots become `{cellId: nanoid(), wordId:null, text:null, blank:true}`
   - Stores in `#boards.set(playerId, cells)`
   - Sends `conn.send(JSON.stringify({type: "boardAssigned", cells}))`
4. Client: `ws.message` handler matches `boardAssigned`, sets `board = msg.cells` in the store
5. Client: `+page.svelte` already derives `gameStarted = roomState?.phase === "playing"` → renders `<Board cells={store.board} />`
6. User taps cell → `BoardCell` runs local `onToggle()` → `markedCellIds.add(cellId)` → visual updates same frame → `store.send({type:"markWord", cellId})`
7. DO: `markWord` handler:
   - Looks up `#boards.get(playerId)` — confirms `cellId` exists and is not blank
   - Toggles `#marks.get(playerId)`.{add|delete}(cellId)
   - `markCount = this.#marks.get(playerId).size`
   - `this.broadcast(JSON.stringify({type:"wordMarked", playerId, markCount}))`
8. All clients: `wordMarked` handler updates `playerMarks[playerId] = markCount`
9. All `PlayerRow` components reactively re-render their mark-count badge

**Total round-trip to peer visual:** WS message (~50–150ms on mobile LTE + DO processing <1ms + broadcast fan-out <1ms + client render <16ms) = well under 1s on any plausible network.

### Recommended Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── Board.svelte           # NEW — grid container
│   │   ├── BoardCell.svelte       # NEW — single cell (word or blank)
│   │   ├── PlayerRow.svelte       # MODIFIED — add markCount prop + badge
│   │   └── (all other Phase 1/2 components — UNCHANGED)
│   ├── protocol/
│   │   └── messages.ts            # MODIFIED — add BoardCell schema + 3 messages
│   ├── stores/
│   │   └── room.svelte.ts         # MODIFIED — add board, playerMarks, markedCellIds
│   └── util/
│       └── shuffle.ts             # NEW — pure Fisher-Yates (testable without DO)
├── routes/
│   └── room/[code]/
│       └── +page.svelte           # MODIFIED — swap stub "Game on!" placeholder with <Board />
party/
└── game-room.ts                    # MODIFIED — add #boards, #marks, markWord handler, startGame emits boardAssigned per conn
tests/
└── unit/
    ├── shuffle.test.ts             # NEW — shuffle properties (unbiased, all elements retained)
    ├── game-room.test.ts           # EXTENDED — boardAssigned, markWord cases
    ├── protocol.test.ts            # EXTENDED — 3 new message schema tests
    └── room-store.test.ts          # EXTENDED — board + playerMarks state
```

### Pattern 1: Cryptographically Unbiased Fisher-Yates on Cloudflare Workers

**What:** Shuffle an array in-place using `crypto.getRandomValues()` with rejection sampling to avoid modulo bias.

**When to use:** Any time BOAR-02 applies — the single place is `party/game-room.ts` during board generation.

**Critical detail:** Naive `crypto.getRandomValues() % n` introduces bias when `n` does not divide `2^32`. Correct implementation uses rejection sampling up to the largest multiple of `n` that fits in `2^32`, or uses `Math.floor(rand01 * n)` with the full 32-bit range as float. Both are standard; the rejection approach is clearer about correctness.

**Example:**
```typescript
// src/lib/util/shuffle.ts — pure function, unit-testable
// Source: Wikipedia Fisher–Yates §Modern Algorithm [CITED: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle]
// Bias avoidance: rejection sampling per crypto.getRandomValues() caveat [CITED: Cloudflare Workers Web Crypto docs]

/**
 * Cryptographically unbiased integer in [0, n). Uses rejection sampling
 * over Uint32 to eliminate modulo bias. Safe on Cloudflare Workers runtime
 * (Web Crypto is available).
 */
function randomIntBelow(n: number): number {
  if (n <= 0) throw new Error("n must be > 0");
  const buf = new Uint32Array(1);
  // Largest multiple of n that fits in 2^32
  const max = Math.floor(0xffffffff / n) * n;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= max);
  return x % n;
}

/**
 * In-place Fisher–Yates. Returns the same array for chaining.
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIntBelow(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

### Pattern 2: Per-Connection Private Payload Delivery on PartyServer

**What:** After a state transition that affects every connected player with a per-player payload, iterate `this.getConnections()` and send to each connection individually.

**When to use:** Board delivery (D-03). Any future "private per-player" message in this game (e.g., private hand in a card game).

**Critical detail:** `conn.state.playerId` must already be set (done in Phase 1's `hello` handler). `getConnections()` returns an iterable of live connections, including hibernating ones — the runtime wakes the hibernating connection to deliver. `conn.send()` is the per-connection primitive; `broadcast()` is strictly the multi-cast primitive.

**Example:**
```typescript
// party/game-room.ts — inside the existing startGame case
// Source: PartyServer docs §getConnections [CITED: https://docs.partykit.io/reference/partyserver-api/]
//         PartyServer README §broadcast/getConnections [CITED: github.com/threepointone/partyserver/blob/main/packages/partyserver/README.md]

case "startGame": {
  const cs = conn.state as { playerId?: string } | null;
  if (cs?.playerId !== this.#hostId) return;
  if (this.#words.size < 5) {
    conn.send(JSON.stringify({ type: "error", code: "not_enough_words" }));
    return;
  }

  this.#phase = "playing";

  // 1. Broadcast phase flip FIRST so all clients transition before boards arrive
  //    (prevents race where a client receives boardAssigned while still in lobby view)
  this.broadcast(JSON.stringify({ type: "gameStarted" }));

  // 2. Generate + deliver per-player boards
  const cellCount = gridCellCount(this.#words.size);  // 9, 16, or 25
  const wordPool = [...this.#words.values()];

  for (const c of this.getConnections()) {
    const s = c.state as { playerId?: string } | null;
    if (!s?.playerId) continue;             // pre-hello connection — skip

    const cells = buildBoardForPlayer(wordPool, cellCount);  // uses shuffle()
    this.#boards.set(s.playerId, cells);
    this.#marks.set(s.playerId, new Set());

    c.send(JSON.stringify({ type: "boardAssigned", cells }));
  }
  return;
}
```

**Anti-pattern (DO NOT DO):**
```typescript
// ❌ WRONG — broadcasts every player's private board to every connection
for (const c of this.getConnections()) {
  const cells = buildBoardForPlayer(wordPool, cellCount);
  this.broadcast(JSON.stringify({ type: "boardAssigned", cells }));  // leak!
}
```

### Pattern 3: Server-Authoritative Mark with Client-Optimistic Render

**What:** Client toggles local visual state on tap (0ms response) and sends `markWord`; server validates, records, computes `markCount`, broadcasts to all. All clients (including the actor) then reconcile their local `markedCellIds` against the server's authoritative state only when divergence is detected.

**When to use:** Every cell tap. This is the core loop.

**Critical detail:** The server must validate `cellId` against the actor's own board (`#boards.get(playerId)`) — never trust client-supplied IDs. Blank cells must be rejected. A second tap on the same cell toggles off (unmark) — idempotency is not an option, it's a feature (BOAR-05 says "click to mark as called" but UX dictates that tapping a false-positive mark must be reversible; UI-SPEC confirms toggle behavior).

**Example:**
```typescript
// party/game-room.ts — new handler inside the onMessage switch
case "markWord": {
  const cs = conn.state as { playerId?: string } | null;
  if (!cs?.playerId) return;
  if (this.#phase !== "playing") return;

  const myBoard = this.#boards.get(cs.playerId);
  const myMarks = this.#marks.get(cs.playerId);
  if (!myBoard || !myMarks) return;         // board not assigned — ignore

  const { cellId } = result.output;
  const cell = myBoard.find((c) => c.cellId === cellId);
  if (!cell || cell.blank) {
    // invalid or blank — silent drop; client bug, not user error
    return;
  }

  // Toggle
  if (myMarks.has(cellId)) myMarks.delete(cellId);
  else myMarks.add(cellId);

  this.broadcast(JSON.stringify({
    type: "wordMarked",
    playerId: cs.playerId,
    markCount: myMarks.size,
  }));
  return;
}
```

```typescript
// src/lib/components/BoardCell.svelte — client optimistic toggle
<script lang="ts">
  import type { BoardCell } from "$lib/protocol/messages";
  let { cell, marked, onToggle }: {
    cell: BoardCell; marked: boolean; onToggle?: () => void;
  } = $props();

  function handleClick() {
    if (cell.blank) return;
    onToggle?.();   // parent flips markedCellIds + sends markWord to server
  }
</script>

{#if cell.blank}
  <div class="aspect-square min-h-11 min-w-11 bg-[var(--color-surface)]
              border border-dashed border-[var(--color-divider)]/40"
       aria-hidden="true" tabindex="-1"></div>
{:else}
  <button
    type="button"
    onclick={handleClick}
    aria-label={marked ? `${cell.text}. Marked. Tap to unmark.` : `${cell.text}. Tap to mark.`}
    class={[
      "aspect-square min-h-11 min-w-11 rounded-lg font-semibold text-sm leading-tight",
      "transition-[background-color,color,border-color,transform] duration-[120ms] ease-out",
      "motion-reduce:transition-none",
      "active:scale-[0.97]",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink-secondary)]",
      marked
        ? "bg-[var(--color-accent)] text-[var(--color-ink-inverse)] border border-[var(--color-accent)]"
        : "bg-[var(--color-surface)] text-[var(--color-ink-primary)] border border-[var(--color-divider)] hover:border-[#3A3A48]",
    ].join(" ")}
  >
    <span class="block px-[6px] break-words hyphens-auto">{cell.text}</span>
  </button>
{/if}
```

### Pattern 4: Svelte 5 Store Extension for Per-Player Mark Counts

**What:** Extend `createRoomStore` to maintain a `playerMarks: Record<string, number>` rune and a `markedCellIds: Set<string>` rune (the actor's own marks). Expose both as getters.

**When to use:** The one source of truth for client-side mark state. Components bind via props.

**Example:**
```typescript
// src/lib/stores/room.svelte.ts — add to existing file
// (existing declarations omitted)

let board = $state<BoardCell[] | null>(null);
let playerMarks = $state<Record<string, number>>({});
let markedCellIds = $state<Set<string>>(new Set());  // MY marks only

ws.addEventListener("message", (ev) => {
  const parsed = v.safeParse(ServerMessage, JSON.parse((ev as MessageEvent).data));
  if (!parsed.success) return;
  const msg = parsed.output;
  switch (msg.type) {
    // ... existing cases

    case "boardAssigned":
      board = msg.cells;
      markedCellIds = new Set();      // fresh board → no marks yet
      break;

    case "wordMarked":
      playerMarks = { ...playerMarks, [msg.playerId]: msg.markCount };
      break;
  }
});

function toggleMark(cellId: string) {
  // Optimistic: flip local Set immediately
  const next = new Set(markedCellIds);
  if (next.has(cellId)) next.delete(cellId);
  else next.add(cellId);
  markedCellIds = next;
  ws.send(JSON.stringify({ type: "markWord", cellId }));
}

return {
  // ... existing getters
  get board() { return board; },
  get playerMarks() { return playerMarks; },
  get markedCellIds() { return markedCellIds; },
  toggleMark,
};
```

**Why a `Set` not `Array`:** O(1) has/add/delete. Grid cell re-render cost dominates otherwise.

**Why recreate the Set on change (`markedCellIds = next`) rather than mutating in place:** Svelte 5 runes detect reassignment of the `$state` variable; in-place `Set.add()` does NOT trigger reactivity on a `$state<Set>` — this is a documented rune behavior.

### Pattern 5: PlayerRow.svelte Extension with Optional Badge

**What:** Add a new optional prop `markCount?: number` to `PlayerRow.svelte`. Render the badge only when `markCount > 0`. Keep Phase 1/2 usage (no prop) working.

**Example:**
```svelte
<!-- src/lib/components/PlayerRow.svelte — additive change -->
<script lang="ts">
  import type { Player } from "$lib/protocol/messages";
  import Badge from "./Badge.svelte";
  import { Crown } from "lucide-svelte";
  import { getPlayerColor } from "$lib/util/playerColor";
  import { getInitials } from "$lib/util/initials";

  let { player, markCount = 0 }: { player: Player; markCount?: number } = $props();
  const color = $derived(getPlayerColor(player.playerId));
  const initials = $derived(getInitials(player.displayName));
</script>

<li
  aria-label={markCount > 0
    ? `${player.displayName}, ${markCount} ${markCount === 1 ? "mark" : "marks"}`
    : player.displayName}
  class="flex items-center gap-3 p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-divider)]"
>
  <span class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-[var(--color-ink-inverse)]"
        style="background: {color}">
    {initials}
  </span>
  <span class="flex-1">{player.displayName}</span>

  {#if player.isHost}
    <Badge>
      {#snippet icon()}<Crown size={12} />{/snippet}
      {#snippet children()}Host{/snippet}
    </Badge>
  {/if}

  {#if markCount > 0}
    <span class="inline-flex items-center h-5 px-2 rounded-full
                 bg-[var(--color-accent)] text-[var(--color-ink-inverse)]
                 text-sm font-semibold tabular-nums">
      {markCount}
    </span>
  {/if}
</li>
```

### Anti-Patterns to Avoid

- **Broadcasting `boardAssigned`:** Leaks private layout (breaks BOAR-03). Always per-connection via `conn.send()`.
- **Mutating `markedCellIds` in place:** `markedCellIds.add(id)` on a `$state<Set>` does NOT fire reactivity — cells won't re-render. Always reassign: `markedCellIds = new Set([...])`.
- **Trusting client `cellId` without DO validation:** Lets a malicious client mark cells they don't have, inflate their count, and feed Phase 4 a bogus win. The DO must look `cellId` up in `#boards.get(playerId)`.
- **Using `Math.random()` for the shuffle:** Fails BOAR-02 (explicitly requires cryptographic randomness). Also biased on many implementations.
- **Putting the `Board` on a new route:** Violates D-01 (causes WS reconnect). Use conditional render inside `/room/[code]/+page.svelte`.
- **Adding `board` to `RoomState`:** The `RoomState` schema is broadcast-shaped (same for every recipient). Board is per-player and MUST NOT be in `RoomState`. It travels in its own `boardAssigned` payload (CONTEXT code_context explicitly notes this).
- **Marking blank cells:** Blank cells have no `onclick`, no keyboard handler, `aria-hidden`, `tabindex="-1"`. A user cannot mark them; the DO also rejects `markWord` on a blank cellId as a second line of defense.
- **Using a toast or banner when mark is rejected:** UI-SPEC explicitly silences this case — rejection is always a client bug, never user error. Silent optimistic revert.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unbiased shuffle | Hand-rolled Lehmer/PRNG wrapper | Web Crypto `getRandomValues()` + Fisher-Yates with rejection sampling | Subtle bias in custom PRNGs is a classic footgun; Web Crypto is the platform-blessed source on Workers. |
| Unique cell IDs | `Math.random().toString(36)` | `nanoid()` | Already installed; URL-safe, collision-resistant, same library used for `wordId`. |
| WS message validation | Hand-rolled type guards | `v.safeParse(ClientMessage, …)` | Existing Valibot pattern in `messages.ts` — extend the variant, inherit all guards. |
| Reconnect/backoff | Custom WebSocket wrapper | `partysocket` (already installed) | Already in use in `room.svelte.ts`; Phase 3 changes nothing in that layer. |
| WS connection iteration | Tracking connections in a Map yourself | `this.getConnections()` on the PartyServer `Server` | Built-in iterable returns all live connections including hibernating ones. Manual tracking drifts out of sync with hibernation. |
| Reactive Set-valued state | A plain Svelte store with manual subscribers | Svelte 5 `$state<Set>` with full-reassignment on change | Runes are the stack choice (CLAUDE.md). Full-reassignment is the idiomatic reactive-Set pattern. |
| CSS grid with equal-size cells | Flexbox with manual percentages | `grid-template-columns: repeat(N, 1fr)` + `aspect-ratio: 1/1` | Native CSS, zero JS, handles all 3/4/5 tiers identically. |
| Contrast checker at runtime | `color-contrast()` shim | Hardcoded `#F5D547` on `#0F0F14` (14.1:1, pre-audited in UI-SPEC) | The palette is fixed; contrast was audited at Phase 1. |

**Key insight:** The stack is already rich enough to solve every Phase 3 subproblem. The temptation in this phase is to reach for a state machine library (XState) or a shuffle library (`lodash.shuffle`, `fast-shuffle`) — both are rejected by CLAUDE.md and are overkill. A 12-line pure `shuffle.ts` covers 100% of BOAR-02.

## Runtime State Inventory

> Skipped — Phase 3 is a greenfield feature phase. No rename, refactor, migration, or string-replacement work is involved. No stored data, OS-registered state, secrets, or build artifacts carry a name that Phase 3 changes.

## Common Pitfalls

### Pitfall 1: Modulo bias in Fisher-Yates

**What goes wrong:** `crypto.getRandomValues(buf)[0] % n` returns a skewed distribution when `n` does not evenly divide `2^32`. A shuffle with biased RNG is detectably non-uniform — this violates BOAR-02 in spirit even if the randomness source is cryptographic.

**Why it happens:** `2^32 = 4294967296`. For `n = 3`, values `0..4294967295` map to `0..2` with residues [1431655766, 1431655766, 1431655764] — small bias. For larger `n` (e.g., 21-word pools with 4-cell boards), the bias can reach measurable levels across many shuffles.

**How to avoid:** Rejection sampling. Compute `max = floor(2^32 / n) * n`, draw, reject if `>= max`, retry. See Pattern 1 code. Worst-case rejection probability is < 50% and practically < 1% for small `n`.

**Warning signs:** None at runtime. Only visible via statistical tests (e.g., chi-squared over millions of samples). Write the unit test up-front — it's a property test (`shuffle` of `[1,2,3,4,5]` repeated 1000 times should give each element roughly 1000/5 = 200 occurrences at each index, within ~2σ).

### Pitfall 2: Broadcast-vs-send confusion (privacy leak)

**What goes wrong:** `this.broadcast(JSON.stringify({type:"boardAssigned",cells}))` sends the *same* cells to every connection — so each player sees every other player's layout. BOAR-03 violated.

**Why it happens:** Copy-paste from the Phase 2 `wordAdded` broadcast pattern. `broadcast` is the frequent primitive and `conn.send` is rarer; the typo is easy.

**How to avoid:** Code review the iteration: any message containing per-player private data MUST use `c.send(...)` inside a `for (const c of this.getConnections())` loop. Never `this.broadcast(...)`. Unit test this: subscribe two fake connections, run `startGame`, assert each connection received a DIFFERENT `boardAssigned` payload.

**Warning signs:** Unit test "two players get different boards" fails. Runtime: a player sees a board cell count that exceeds the word pool divided by the tier (impossible if board is their own), or sees another player's word in a slot they didn't submit.

### Pitfall 3: Svelte 5 `$state<Set>` in-place mutation does not trigger reactivity

**What goes wrong:** `markedCellIds.add(cellId)` — nothing re-renders. The user taps a cell and the UI is frozen.

**Why it happens:** Svelte 5 runes use reassignment to detect change. `Set.add()` mutates but doesn't reassign. `$state<Set>` is shallow-reactive by default.

**How to avoid:** Always reassign: `markedCellIds = new Set([...markedCellIds, cellId])`. Or expose a proxy via `$state.raw` and manually track version — but for a sub-25-element Set, full reconstruction on mark is trivially fast.

**Warning signs:** Tap a cell, no visual change. Add a `console.log` in the `BoardCell` reactive block; if it doesn't fire, it's reactivity. Verify the Set reference changes: `console.log(oldSet === markedCellIds)` before/after.

### Pitfall 4: `conn.state` is undefined before `hello`

**What goes wrong:** If `startGame` fires before a connection has sent `hello` (e.g., user opened the page but hasn't typed a name), `conn.state?.playerId` is `undefined`, and that connection silently skips getting a board — but they're on the `/room/[code]` page waiting.

**Why it happens:** `conn.setState({playerId})` only runs inside the `hello` handler. A freshly opened WS that hasn't sent `hello` yet has null state.

**How to avoid:** Guard the per-connection board-generation loop with `if (!s?.playerId) continue;`. Additionally: the `hello` handler must, after setting state, check `if (this.#phase === "playing")` and send this latecomer their board (Phase 5 reconnect resilience) — but for Phase 3 we treat "in lobby when game started" as the only valid entry point; latecomers after `startGame` are a Phase 5 concern.

**Warning signs:** A player's Board never renders (board = null), but gameStarted set their phase to "playing" — they see an empty grid or the defensive "Dealing your board…" fallback indefinitely. Test: send `startGame` with a connection that never sent `hello`; verify the handler doesn't crash and the hello-less conn is skipped.

### Pitfall 5: Word-pool mutation during shuffle

**What goes wrong:** `shuffle([...this.#words.values()])` works, but `shuffle(this.#words.values())` is an iterator, not an array — TypeError on `arr.length`. Or worse: `const pool = [...this.#words.values()]; shuffle(pool)` — next iteration reuses the *same shuffled pool* because `shuffle` is in-place. Second player's board is identical to first.

**Why it happens:** Fisher-Yates is in-place by convention. Reusing the reference across players = same permutation.

**How to avoid:** Create a fresh copy per player: `const pool = [...this.#words.values()]; shuffle(pool);` inside the per-connection loop.

**Warning signs:** All players see the same board — easy to catch in the unit test ("two players get different boards"). Run in isolation: 2 players, 9 cells, assert `boards[0] !== boards[1]` (cell-by-cell comparison by wordId).

### Pitfall 6: Blank cells rendered as clickable

**What goes wrong:** Blank cell is a `<button>` with `tabindex="-1"` — keyboard Tab skips it, but a click still fires. Or blank cell uses `pointer-events:none` — click event doesn't fire on the child, but the parent does nothing, so the user taps and sees no response (frustrating).

**Why it happens:** Inconsistent inert treatment. The cell is visually passive but the DOM is active.

**How to avoid:** In `BoardCell.svelte`, render `<div aria-hidden="true" tabindex="-1">` for blanks (NOT a button). A `<div>` with `cursor: default` (the default) doesn't hint interactivity. The `onclick` handler on the parent `<Board>` (if any) must also check `cell.blank` before invoking `onToggle`. DO `markWord` handler also rejects blank cellIds as defense-in-depth.

**Warning signs:** Users tap what look like filler cells and nothing happens — "is the game broken?" On tests: assert blank cells have no `role="button"`, no `onclick` listener, and calling `markWord` with a blank `cellId` does not alter `#marks`.

### Pitfall 7: Mark count overflow / desync under disconnect

**What goes wrong:** Player disconnects (phone tunneled), the Phase 1 disconnect logic removes them from `#players` after grace period, but `#boards` and `#marks` entries remain. Memory leak, and the stale `playerMarks` on other clients still shows their count.

**Why it happens:** Phase 3 adds two Maps keyed on playerId but the existing `onClose` only cleans `#players`.

**How to avoid:** For Phase 3, leave the cleanup loose — Phase 5 (RESI) owns the full disconnect lifecycle. Document the known leak. However: when a player is definitively removed (Phase 5), also clear `#boards.delete(playerId)` and `#marks.delete(playerId)`.

**Warning signs:** Not visible to end-users in Phase 3 (rooms are ephemeral). Phase 5 will surface it.

### Pitfall 8: Race — `boardAssigned` arrives before `gameStarted` on the same client

**What goes wrong:** DO sends `broadcast(gameStarted)` then `conn.send(boardAssigned)`. On the actor's connection, message delivery ordering is WS-FIFO (guaranteed). But the phase-flip render in `+page.svelte` and the board render both depend on `state.phase === "playing"` — if the store processes `boardAssigned` before the `gameStarted` message updates `state.phase`, the board data lands but doesn't render (page still showing lobby).

**Why it happens:** In the current `room.svelte.ts`, `state` is set by `roomState` messages. `gameStarted` is a separate message that currently does `state = { ...state, phase: "playing" }`. `boardAssigned` needs to arrive AFTER this flip or the `<Board>` component isn't mounted yet.

**How to avoid:** Broadcast `gameStarted` FIRST (order in the DO matters — WS is FIFO per connection), then per-connection `boardAssigned`. On the client, the switch-case order doesn't matter because each case only mutates its own field. Test it: simulate message arrival order boardAssigned → gameStarted and verify Board renders once `state.phase` flips (Svelte reactivity handles the re-render).

**Warning signs:** User clicks Start Game, sees a blink of empty grid then cells appear — or sees cells appear late. Should be imperceptible in practice but watch for it in manual QA.

## Code Examples

Verified patterns adapted for this project.

### `src/lib/protocol/messages.ts` — Add BoardCell schema + 3 messages

```typescript
// Add after existing WordEntry (before RoomState)
export const BoardCell = v.object({
  cellId: v.string(),
  wordId: v.nullable(v.string()),
  text: v.nullable(v.string()),
  blank: v.boolean(),
});
export type BoardCell = v.InferOutput<typeof BoardCell>;

// Append to ClientMessage variants
v.object({
  type: v.literal("markWord"),
  cellId: v.pipe(v.string(), v.minLength(1)),
}),

// Append to ServerMessage variants
v.object({ type: v.literal("boardAssigned"), cells: v.array(BoardCell) }),
v.object({
  type: v.literal("wordMarked"),
  playerId: v.pipe(v.string(), v.minLength(1)),
  markCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
}),
```

**Note:** `RoomState` does NOT gain a `board` field (per CONTEXT `<code_context>`). Boards are per-player private payloads.

### `src/lib/util/shuffle.ts` — Pure Fisher-Yates (NEW FILE)

```typescript
// src/lib/util/shuffle.ts
// Cryptographically unbiased Fisher–Yates shuffle.
// Runs on Cloudflare Workers (Web Crypto is available).
// [CITED: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle]
// [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/]

function randomIntBelow(n: number): number {
  if (n <= 0) throw new Error("n must be > 0");
  const buf = new Uint32Array(1);
  const max = Math.floor(0xffffffff / n) * n;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= max);
  return x % n;
}

/** In-place shuffle. Returns the same array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIntBelow(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

### `party/game-room.ts` — Board generation helper

```typescript
// Add to party/game-room.ts imports
import { shuffle } from "../src/lib/util/shuffle.js";
import { deriveGridTier } from "../src/lib/util/gridTier.js";

// Add to GameRoom class fields
#boards = new Map<string, BoardCell[]>();
#marks = new Map<string, Set<string>>();

// Private helper — builds one player's board
#buildBoardForPlayer(wordPool: WordEntry[]): BoardCell[] {
  const cellCount = this.#cellCountForWordCount(wordPool.length);
  const shuffled = shuffle([...wordPool]);
  const wordCells: BoardCell[] = shuffled.slice(0, cellCount).map((w) => ({
    cellId: nanoid(),
    wordId: w.wordId,
    text: w.text,
    blank: false,
  }));
  const blanksNeeded = Math.max(0, cellCount - wordCells.length);
  const blankCells: BoardCell[] = Array.from({ length: blanksNeeded }, () => ({
    cellId: nanoid(),
    wordId: null,
    text: null,
    blank: true,
  }));
  // Interleave or fill-tail? Fill-tail then shuffle the combined array so
  // blanks are uniformly distributed across the grid.
  const all = [...wordCells, ...blankCells];
  return shuffle(all);
}

#cellCountForWordCount(n: number): number {
  const tier = deriveGridTier(n);  // "3x3" | "4x4" | "5x5"
  return tier === "5x5" ? 25 : tier === "4x4" ? 16 : 9;
}
```

### `party/game-room.ts` — Extend `startGame` + new `markWord` case

```typescript
// Replace existing "startGame" case
case "startGame": {
  const cs = conn.state as { playerId?: string } | null;
  if (cs?.playerId !== this.#hostId) return;
  if (this.#words.size < 5) {
    conn.send(JSON.stringify({ type: "error", code: "not_enough_words" }));
    return;
  }
  this.#phase = "playing";

  // Flip phase globally BEFORE sending boards (so clients mount <Board/>)
  this.broadcast(JSON.stringify({ type: "gameStarted" }));

  // Per-connection private board delivery
  const wordPool = [...this.#words.values()];
  for (const c of this.getConnections()) {
    const s = c.state as { playerId?: string } | null;
    if (!s?.playerId) continue;
    const cells = this.#buildBoardForPlayer(wordPool);
    this.#boards.set(s.playerId, cells);
    this.#marks.set(s.playerId, new Set());
    c.send(JSON.stringify({ type: "boardAssigned", cells }));
  }
  return;
}

// New case
case "markWord": {
  const cs = conn.state as { playerId?: string } | null;
  if (!cs?.playerId) return;
  if (this.#phase !== "playing") return;

  const myBoard = this.#boards.get(cs.playerId);
  const myMarks = this.#marks.get(cs.playerId);
  if (!myBoard || !myMarks) return;

  const { cellId } = result.output;
  const cell = myBoard.find((c) => c.cellId === cellId);
  if (!cell || cell.blank) return;

  if (myMarks.has(cellId)) myMarks.delete(cellId);
  else myMarks.add(cellId);

  this.broadcast(JSON.stringify({
    type: "wordMarked",
    playerId: cs.playerId,
    markCount: myMarks.size,
  }));
  return;
}
```

### `src/lib/components/Board.svelte` — Grid container (NEW)

```svelte
<!-- src/lib/components/Board.svelte -->
<script lang="ts">
  import type { BoardCell as Cell } from "$lib/protocol/messages";
  import BoardCell from "./BoardCell.svelte";

  let {
    cells,
    markedCellIds,
    onToggleMark,
  }: {
    cells: Cell[] | null;
    markedCellIds: Set<string>;
    onToggleMark: (cellId: string) => void;
  } = $props();

  // Derive grid tier from cell count. 9 → 3, 16 → 4, 25 → 5.
  const cols = $derived(
    cells == null ? 3 : cells.length === 25 ? 5 : cells.length === 16 ? 4 : 3
  );
</script>

<section class="flex flex-col gap-3">
  <p class="text-sm font-semibold text-[var(--color-ink-secondary)]">Your board</p>
  {#if cells == null}
    <div class="flex flex-col items-center justify-center py-10 gap-2">
      <p class="text-[var(--color-ink-secondary)] font-semibold">Dealing your board…</p>
      <p class="text-sm text-[var(--color-ink-secondary)]">
        Hang tight — we're shuffling the words.
      </p>
    </div>
  {:else}
    <div
      class="grid gap-2"
      style="grid-template-columns: repeat({cols}, minmax(44px, 1fr));"
    >
      {#each cells as cell (cell.cellId)}
        <BoardCell
          {cell}
          marked={markedCellIds.has(cell.cellId)}
          onToggle={() => onToggleMark(cell.cellId)}
        />
      {/each}
    </div>
  {/if}
</section>
```

### `src/routes/room/[code]/+page.svelte` — Swap stub for Board

Replace the current Phase 2 stub (the `"Game on!"` placeholder block) with:

```svelte
{#if gameStarted}
  <section class="flex flex-col gap-4">
    <h2 class="text-2xl font-semibold">Players · {playerCount}</h2>
    <ul class="flex flex-col gap-2">
      {#each roomState?.players ?? [] as player (player.playerId)}
        <PlayerRow
          {player}
          markCount={store?.playerMarks?.[player.playerId] ?? 0}
        />
      {/each}
    </ul>
  </section>
  <Board
    cells={store?.board ?? null}
    markedCellIds={store?.markedCellIds ?? new Set()}
    onToggleMark={(id) => store?.toggleMark(id)}
  />
{:else}
  <!-- existing lobby block unchanged -->
{/if}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shared-mutable server state via Redis + Node | Durable Objects (strong consistency per-room actor) | Cloudflare DO GA, 2022+ | No locks, no race around "first to win"; in-memory is fine. |
| Socket.IO with sticky sessions | Raw WebSocket + DO Hibernation | WS Hibernation GA 2023 | Connections survive cheap; no sticky sessions needed. |
| Client-side state managers (Redux/Zustand) for reactive stores | Svelte 5 runes in `.svelte.ts` modules | Svelte 5.0 GA 2024 | Less ceremony, compiled reactivity, no ext dep. |
| Zod for runtime schema validation | Valibot (tree-shakeable, 10× smaller) | 2024+ | Critical for Workers cold-start size. |
| `Math.random()` shuffle | `crypto.getRandomValues()` + Fisher-Yates | always, when fairness matters | BOAR-02 compliance + actually unbiased. |

**Deprecated/outdated:**
- Hand-rolled per-cell `<div onclick>` — rejected by accessibility practice; `<button>` is the baseline.
- Server-Sent Events for bi-directional state — SSE is unidirectional; WS covers both directions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PartyServer `Server` base class provides `this.getConnections()` returning an iterable of live connections (including hibernating) with `conn.send()` available per connection | Pattern 2, §Standard Stack | Can't deliver per-player private boards cleanly; would need manual `Map<playerId, conn>` tracking. Mitigation: verified via PartyServer docs [CITED: docs.partykit.io/reference/partyserver-api] and threepointone/partyserver README [CITED: github.com/threepointone/partyserver/blob/main/packages/partyserver/README.md]. The existing codebase already uses `this.broadcast()` which is a sibling primitive — same API surface. Also: `conn.setState()` / `conn.state` is already used in Phase 1/2 code (game-room.ts lines 90–148). Risk is LOW. |
| A2 | The mark "same frame" (success criterion #3) is achievable via optimistic local toggle. Svelte 5 reactivity flushes within one animation frame (<16ms) on commodity mobile | Pattern 3 | If flushing is slower (e.g., 100ms), the "same frame" claim is wishful. Mitigation: Svelte 5 compiled reactivity is on the JS microtask queue by default and is demonstrably sub-16ms in the referenced real-time-Runes case [CITED: dev.to/polliog/real-world-svelte-5-handling-high-frequency-real-time-data-with-runes]. Manual QA on mid-tier Android in DevTools slow-3G will confirm. Risk is LOW. |
| A3 | The `wordMarked` broadcast round-trip (click → render on peers) is consistently under 1000ms on typical mobile networks | Summary, §Success Criteria trace | If latency exceeds 1s on real networks (corporate VPN, cellular), violates success criterion #4. Mitigation: DO processing is sub-millisecond (in-memory); Cloudflare edge-to-device RTT is typically 50–200ms. 1s target has 3–5× headroom. But confirm via instrumented manual QA during execution. Risk is LOW. |
| A4 | Fill-tail-then-shuffle for blank distribution produces a uniform blank placement across the grid | Code Examples §`#buildBoardForPlayer` | If blanks cluster (non-uniform distribution), one player's board may have a whole blank row — which would be a trivial Phase 4 insta-win. Mitigation: Fisher-Yates of the combined array is uniform; this is mathematically the same as choosing a random subset of cellCount positions for blanks. Risk is LOW. |

## Open Questions

1. **Should blank cells be allowed to cluster into a full row?**
   - What we know: D-10 says blank cells count as pre-satisfied for line checks. If the shuffle produces a board with 5 blank cells on the same row (tier-dependent; ~impossible at 3×3 with 4 blanks but possible at 5×5 when word pool is 21–24), that row is an instant win at game start.
   - What's unclear: Is instant-win an acceptable novelty ("gave that person a gift") or a bug to mitigate?
   - Recommendation: ACCEPT as gameplay novelty. The probability of a same-row full-blank is low (at 5×5 with 4 blanks: C(21,4)/C(25,4) ≈ 0.3% chance blanks avoid row 1; so ≈ 99.7% at least one blank per row on average — real "full blank row" chance is <<1%). Phase 4 will detect it and celebrate. If user feedback in play-testing says "felt cheap," add a post-shuffle reroll in Phase 4's win invariants; not a Phase 3 concern. **Flag this in the plan for a play-test note.**

2. **Should unmarking (toggle off) be allowed?**
   - What we know: UI-SPEC explicitly says tapping a marked cell unmarks it. Pattern 3 implements toggle. The DO handles both directions.
   - What's unclear: Does Phase 4 need "locked marks" (cannot un-mark a cell that's part of a completed line)?
   - Recommendation: DEFER to Phase 4. Phase 3 ships pure toggle. Phase 4 can layer a "frozen after win" state on top.

3. **On `startGame` with 0 connected players besides the host, what happens?**
   - What we know: The iteration sends a board to the host (and only the host). `broadcast(gameStarted)` fires with zero recipients. No error.
   - What's unclear: Is a 1-player game useful? Phase 1 lobby-minimum is 2 players to start.
   - Recommendation: Phase 1/2 already gates "Start Game" behind a 5-word minimum, not a 2-player minimum. If a host starts with themselves alone, they get a board and can play solo. Matches "zero-signup, play-immediately" ethos. No change needed.

4. **What should the board section heading be?**
   - UI-SPEC says `Your board` (Label 14px, secondary ink). Pattern 1 follows this. No uncertainty — noted only to flag as a content decision the executor will implement verbatim.

## Environment Availability

> Skipped — Phase 3 is a code-only phase. No new external tools, services, runtimes, or CLIs are required beyond what Phase 1 already set up (Node.js, npm, Wrangler, Vitest, Playwright). All dependencies are existing `package.json` entries and versions are already verified.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.0 (unit) + Playwright 1.49.0 (e2e) [VERIFIED: package.json] |
| Config file | `vitest.config.ts` (implicit via SvelteKit), `playwright.config.ts` [existing] |
| Quick run command | `npm run test:unit -- tests/unit/<file>.test.ts -t "<name>"` |
| Full suite command | `npm test` (vitest + playwright) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOAR-01 | Each player gets a unique board | unit | `npm run test:unit tests/unit/game-room.test.ts -t "startGame sends different boards to different connections"` | ❌ Wave 0 (extend existing file) |
| BOAR-02 | Fisher-Yates + crypto randomness | unit | `npm run test:unit tests/unit/shuffle.test.ts` | ❌ Wave 0 (new file) |
| BOAR-03 | Board private — not broadcast | unit | `npm run test:unit tests/unit/game-room.test.ts -t "boardAssigned is sent per-connection, never broadcast"` | ❌ Wave 0 |
| BOAR-04 | Blanks fill remainder | unit | `npm run test:unit tests/unit/game-room.test.ts -t "board has cellCount cells with (cellCount - min(wordCount,cellCount)) blanks"` | ❌ Wave 0 |
| BOAR-05 | Click toggles mark visually | unit (component) | `npm run test:unit tests/unit/BoardCell.test.ts` (new) — renders marked vs unmarked classes | ❌ Wave 0 (new file) |
| BOAR-05 | Click toggles mark (end-to-end) | e2e | `npm run test:e2e tests/e2e/board-mark.spec.ts` | ❌ Wave 0 |
| BOAR-06 | Peers see count, not layout | unit | `npm run test:unit tests/unit/game-room.test.ts -t "wordMarked broadcast contains only playerId and markCount"` | ❌ Wave 0 |
| BOAR-06 | Peer badge updates within 1s | e2e | `npm run test:e2e tests/e2e/board-mark.spec.ts -g "peer sees count within 1s"` | ❌ Wave 0 |
| BOAR-07 | 44px tap target at all tiers | unit (component) | `npm run test:unit tests/unit/Board.test.ts` — assert `min-h-11 min-w-11` in rendered markup | ❌ Wave 0 (new file) |

### Sampling Rate
- **Per task commit:** `npm run test:unit -- <touched test file>`
- **Per wave merge:** `npm run test:unit` (full unit suite)
- **Phase gate:** `npm test` (unit + e2e) green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/shuffle.test.ts` — covers BOAR-02. Property test: shuffle preserves multiset; statistical test (1000 runs) confirms unbiasedness.
- [ ] `tests/unit/Board.test.ts` — covers BOAR-07 (grid structure, aspect ratio, min-h-11).
- [ ] `tests/unit/BoardCell.test.ts` — covers BOAR-05 (marked/unmarked/blank render paths, click handler).
- [ ] `tests/unit/game-room.test.ts` — EXTENDED with new describe block "GameRoom — board & marks (Phase 3)" — covers BOAR-01/03/04/06.
- [ ] `tests/unit/protocol.test.ts` — EXTENDED with new Valibot parse tests for `markWord`, `boardAssigned`, `wordMarked`.
- [ ] `tests/unit/room-store.test.ts` — EXTENDED with handler tests for `boardAssigned` and `wordMarked` messages (board state set, playerMarks updated).
- [ ] `tests/e2e/board-mark.spec.ts` — new e2e: two players, host starts, first player marks a cell, second player's UI shows mark count badge = 1.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 3 does not introduce auth; anonymous zero-signup by design (REQUIREMENTS.md). |
| V3 Session Management | partial | Inherits Phase 1 `sessionStorage` playerId; no new session surfaces. |
| V4 Access Control | **yes** | `markWord` must reject cellIds not in the actor's own board (authorization: "can this player mark this cell"). `startGame` already host-gated (Phase 2). |
| V5 Input Validation | **yes** | All three new messages (markWord, boardAssigned, wordMarked) validated via Valibot `v.safeParse`. `cellId` length-bounded, `markCount` non-negative integer. |
| V6 Cryptography | **yes** | `crypto.getRandomValues()` (Web Crypto API, platform-provided). Not hand-rolled. |

### Known Threat Patterns for SvelteKit + Durable Object + WS stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client forges `markWord` with another player's cellId to inflate their count | Tampering | DO validates `cellId ∈ #boards.get(conn.state.playerId)` before mutating marks. Authorization by conn-tagged identity. |
| Client omits `cellId` or sends malformed message to crash DO | DoS / Tampering | `v.safeParse(ClientMessage, …)` gates every inbound message. Existing pattern from Phase 1. |
| Client sends `markWord` spam to flood broadcast | DoS | Rate limit deferred; Phase 3 relies on natural game tempo. If needed, add a per-connection mark budget (not in Phase 3 scope). |
| Malicious client tries to mark a blank cell to trigger auto-win in Phase 4 | Elevation of Privilege / Tampering | DO rejects `cell.blank === true` in `markWord` handler (defense-in-depth alongside client-side inertness). |
| Player observes another player's board via network inspection | Information Disclosure | `boardAssigned` sent only via `conn.send()` on the target connection; never in `broadcast()`. Verified with unit test "two connections receive different `boardAssigned` payloads". |
| Shuffle predictability allows a player to pre-compute another player's board | Information Disclosure | Web Crypto `getRandomValues()` is cryptographically secure; per-player independent shuffles. |
| Board layout embedded in a broadcast message (e.g., `roomState` snapshot during refresh mid-game) | Information Disclosure | `RoomState` schema explicitly does NOT include `board`. Phase 5 reconnect will need to replay `boardAssigned` on re-hello, not snapshot the board in roomState. |
| XSS via word text rendered in cell | Tampering | Svelte escapes by default. Words are user-submitted but text rendering is `{cell.text}` (auto-escaped). Phase 2 already enforces `maxLength(30)` on `submitWord`. |

## Sources

### Primary (HIGH confidence)
- [PartyServer README](https://github.com/threepointone/partyserver/blob/main/packages/partyserver/README.md) — `getConnections()`, `broadcast(msg, exclude[])`, `conn.setState`, `conn.state` surface
- [PartyServer API docs](https://docs.partykit.io/reference/partyserver-api/) — per-connection send pattern, hibernation behavior with `getConnections()`
- [Cloudflare Workers Web Crypto docs](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) — `crypto.getRandomValues()` availability on Workers runtime
- [Fisher–Yates shuffle — Wikipedia](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) — modern algorithm + bias discussion
- [Cloudflare Durable Objects — WebSocket Hibernation example](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/) — confirmed pattern for per-connection sends during hibernation
- `npm view` registry lookups 2026-04-17 — versions for partyserver/partysocket/valibot/nanoid/svelte

### Secondary (MEDIUM confidence)
- [Building real-time games with Workers + Durable Objects + Unity](https://blog.cloudflare.com/building-real-time-games-using-workers-durable-objects-and-unity/) — validates DO-per-room actor model for games
- [Real-world Svelte 5: high-frequency real-time data with Runes](https://dev.to/polliog/real-world-svelte-5-handling-high-frequency-real-time-data-with-runes-3i2f) — confirms Svelte 5 reactivity is sub-16ms under real-time load (Assumption A2)

### Tertiary (LOW confidence)
- None — every Phase 3 claim is either verified against docs or codebase, or explicitly tagged as Assumption in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against live npm registry 2026-04-17; stack is frozen by CLAUDE.md; no new dependencies needed.
- Architecture: HIGH — per-connection send is a documented PartyServer idiom; server-authoritative mark with client-optimistic render is the textbook pattern for this domain.
- Pitfalls: HIGH — each pitfall has a code-level mitigation and a failing-test signal; modulo bias is a well-known Fisher-Yates trap with standard rejection-sampling solution.
- Fairness invariant (STATE.md flag): HIGH — Fisher-Yates of the combined word+blank array is uniform; blank row at game start is a low-probability edge case, not a bug. No spike needed (Open Question 1).

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days — stack is stable, all dependencies pinned, no major version drift expected)
