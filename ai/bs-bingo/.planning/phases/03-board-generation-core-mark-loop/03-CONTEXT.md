# Phase 3: Board Generation & Core Mark Loop - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers two things: (1) server-side generation of a unique, private bingo board for every player when the game starts, and (2) the mark loop — player taps a word cell, it visually marks on their board, and peers see that player's total mark count increment in real time. Win detection and announcements are Phase 4 scope. Reconnection/resume resilience is Phase 5 scope.

</domain>

<decisions>
## Implementation Decisions

### Game Transition (Lobby → Board)

- **D-01:** The board renders within the existing `/room/[code]` route via conditional render — `{#if state.phase === 'playing'}<Board />{:else}<Lobby />{/if}`. No SvelteKit `goto()` navigation. The WebSocket stays alive across the transition, eliminating any reconnect race at the exact moment the board payload arrives.
- **D-02:** `state.phase === 'playing'` is already tracked in `room.svelte.ts` (set on `gameStarted` message) — Phase 3 adds a `<Board />` component that the existing phase check renders. No new routes needed.

### Board Delivery (Private Per-Player)

- **D-03:** After `gameStarted`, the server generates a unique Fisher-Yates-shuffled board for each connected player and sends it via a player-specific `boardAssigned` ServerMessage on each individual connection (not broadcast). Board layout is never included in broadcast messages.
- **D-04:** Board state lives in the room store: `room.svelte.ts` adds a `board` reactive state field populated on `boardAssigned`. Board data: array of cells, each with `{ cellId, wordId | null, text | null, blank: boolean }`.

### Mark Loop

- **D-05:** Player taps a word cell → client sends `markWord { cellId }` ClientMessage → DO increments mark count for that player, records the mark, and broadcasts `wordMarked { playerId, markCount }` to all connections. Board layout is never leaked in `wordMarked`.
- **D-06:** The acting player's board updates optimistically on tap (immediate local state toggle), then is confirmed/corrected by server response if needed.

### Mark Visibility for Peers

- **D-07:** Extend the existing `PlayerRow.svelte` component to show a live mark count badge alongside each player's entry (e.g., "3" next to their name). No new scoreboard surface or sidebar. Player list remains accessible during the game (above the board or in a collapsible panel).
- **D-08:** `wordMarked` ServerMessage carries `{ playerId, markCount }` — store maintains a `playerMarks` map (`playerId → count`) updated on each `wordMarked` event.

### Blank Cell Behavior

- **D-09:** Blank cells are **inert/passive** — they have no word, no text, and no click handler. They are visually distinct from word cells (surface background `#1A1A23` + faint dashed or dimmed border, no content). Tapping a blank does nothing.
- **D-10:** Win detection (Phase 4) counts blank cells as automatically satisfied in line checks — they need no player action. Board generation assigns `blank: true` to filler cells; win-check logic treats `blank === true` as pre-satisfied without requiring a mark.
- **D-11:** Blank cells must have clear visual affordance that they are not interactive — no hover effect, no active state, cursor default. The visual language must prevent player confusion without instructions (zero-signup, play-immediately game).

### Board Visual Design

- **D-12:** **Unmarked word cell:** Surface background `#1A1A23`, white text, subtle border `#2A2A36`.
- **D-13:** **Marked word cell:** Accent fill `#F5D547` background + dark `#0F0F14` text. Bold, high-contrast, scannable at a glance (~5.9:1 WCAG AA). No icon overlay needed.
- **D-14:** **Blank/inert cell:** Surface background `#1A1A23`, faint dashed or 40%-opacity border, no text, no cursor-pointer. Visually passive, clearly non-interactive.
- **D-15:** All cells minimum 44px tap target (BOAR-07). Grid uses CSS grid with equal cell sizing. 3×3, 4×4, 5×5 layouts auto-scale responsively to viewport width in portrait orientation.
- **D-16:** Phase 4 win-line highlight must differentiate from the marked state — a border glow, brightness boost, or overlay ring (not a conflicting fill color) is the right approach.

### Claude's Discretion

- Exact grid sizing algorithm (whether cells shrink text or truncate with ellipsis at 5×5)
- Whether the player list collapses or scrolls above the board on small mobile screens
- Animation for the mark transition (instant toggle vs brief scale/flash)
- Exact blank cell dashed border style

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` §Board — BOAR-01 through BOAR-07 are the acceptance criteria for this phase
- `.planning/PROJECT.md` — project context, constraints (zero-signup, browser-only, sub-1s sync), Key Decisions table

### Phase 1 & 2 Foundations
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-CONTEXT.md` — established design decisions (dark theme, session model, lobby layout)
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-UI-SPEC.md` — design system: color tokens (`#0F0F14`, `#1A1A23`, `#2A2A36`, `#F5D547`), spacing scale, typography, component inventory
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-PATTERNS.md` — Svelte 5 runes patterns, PartyServer room class pattern, Valibot message schema extension pattern
- `.planning/phases/02-lobby-gameplay-word-submission-start/02-CONTEXT.md` — Phase 2 decisions (word pool, grid tiers, start-game flow)
- `.planning/phases/02-lobby-gameplay-word-submission-start/02-PATTERNS.md` — Phase 2 implementation patterns

### Codebase Entry Points (read before implementing)
- `src/lib/protocol/messages.ts` — current Valibot schemas for ClientMessage, ServerMessage, RoomState; Phase 3 adds `boardAssigned`, `markWord`, `wordMarked` variants
- `src/lib/stores/room.svelte.ts` — `createRoomStore` factory; Phase 3 adds `board` and `playerMarks` reactive state fields
- `party/game-room.ts` — GameRoom Durable Object; Phase 3 adds board generation (Fisher-Yates), per-player board storage, mark tracking, `wordMarked` broadcast
- `src/routes/room/[code]/+page.svelte` — existing lobby page; Phase 3 adds `{#if state.phase === 'playing'}<Board />{:else}<Lobby />{/if}` conditional

### Research Notes
- `.planning/STATE.md` — notes a recommended bingo-fairness invariant spike before implementation (winnability check, blank placement guarantees)

No external spec files beyond the above — requirements fully captured in REQUIREMENTS.md and decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PlayerRow.svelte` — extend with mark count badge (D-07); existing conditional rendering pattern (host badge) shows how to add conditional elements
- `Badge.svelte` — may inform mark count badge styling (small, rounded)
- `Button.svelte` — not needed for cell interaction (cells are custom), but available for any board-level actions
- `room.svelte.ts` `createRoomStore` — established extension point; Phase 3 adds `board` and `playerMarks` fields following the same `$state` pattern
- `messages.ts` — Valibot discriminated union pattern; all new message types follow `v.object({ type: v.literal("..."), ... })` shape

### Established Patterns
- Svelte 5 `$state` + `$derived` for reactive store state — no external state managers
- Valibot `v.variant("type", [...])` for all WS messages — new types appended to existing variant arrays
- Server-authoritative: DO holds state, broadcasts on change; clients update from server messages only
- `conn.setState({ playerId })` on DO for per-connection identity — used when sending `boardAssigned` to target the right connection
- `sessionStorage` identity: `bsbingo_player_{roomCode}` → `{ playerId, displayName }` — already decoupled from WS

### Integration Points
- `RoomState` in `messages.ts` does NOT need a `board` field — boards are per-player private payloads sent on individual connections, not broadcast state
- `ClientMessage` needs: `markWord { cellId: string }` variant
- `ServerMessage` needs: `boardAssigned { cells: BoardCell[] }` (sent per-connection, not broadcast) and `wordMarked { playerId: string, markCount: number }` (broadcast)
- `GameRoom` DO: add board generation logic, per-player board storage (Map<playerId, BoardCell[]>), mark tracking (Map<playerId, Set<cellId>>), and mark count broadcast
- `src/routes/room/[code]/+page.svelte`: add conditional render for `<Board />` component
- New components needed: `Board.svelte`, `BoardCell.svelte` (or single `Board.svelte` with inline cell rendering)

</code_context>

<specifics>
## Specific Ideas

- Fisher-Yates shuffle should use crypto randomness (BOAR-02): `crypto.getRandomValues()` is available in Cloudflare Workers — use it for the shuffle seed or for index selection
- Board cell ID: use `nanoid` (already installed) per cell so `cellId` is stable for mark tracking
- `boardAssigned` is sent on each player's individual connection immediately after `gameStarted` is broadcast — ordering: broadcast `gameStarted` first (all clients transition to "playing" view), then loop over connections and send each player their private `boardAssigned`
- Win detection (Phase 4) note: blank cells have `blank: true` and no `cellId` mark needed — win checker should treat `blank === true` as pre-satisfied when evaluating lines
- STATE.md flags a bingo-fairness spike: researcher should verify that Fisher-Yates on the word pool guarantees every player can win (no pathological blank placement), and that grid tier thresholds (5 words min for 3×3 = 9 cells → 4 blanks) are acceptable for gameplay

</specifics>

<deferred>
## Deferred Ideas

- Win detection and announcement → Phase 4 (WIN-01 through WIN-05)
- Reconnect/resume (board state recovery on disconnect) → Phase 5 (RESI-01 through RESI-06)
- Near-miss indicator (one cell from winning) → v2 (SOCL-02)
- Sound effects on mark → v2 (SOCL-03)
- Social-validation anti-cheat (peers confirm word was said) → v2 (SOCL-04)
- Win-line visual highlight (Phase 4 scope — noted that it must differentiate from `#F5D547` marked state)

</deferred>

---

*Phase: 03-board-generation-core-mark-loop*
*Context gathered: 2026-04-17*
