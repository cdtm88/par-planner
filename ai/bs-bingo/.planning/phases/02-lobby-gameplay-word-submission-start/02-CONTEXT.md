# Phase 2: Lobby Gameplay — Word Submission & Start - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the lobby gameplay layer on top of the live-room infrastructure from Phase 1: any player can submit buzzwords into a shared pool, the host can seed the pool from starter packs, the grid size auto-derives from word count, and the host can start the game once the minimum word count is met. Nothing about board generation or marking is in scope — this phase ends the moment the host taps "Start Game" and a transition signal is dispatched to all clients.

</domain>

<decisions>
## Implementation Decisions

### Word Pool Display

- **D-01:** Words are displayed as chips/tags in a wrapping flow layout inside the lobby. Each chip shows only the word text — no submitter attribution visible at rest.
- **D-02:** A player's own submitted words get an × delete button on the chip. Words submitted by others have no × — only text. Ownership is tracked per player session.
- **D-03:** Pool section header shows a live word count: "Words (12)".

### Word Submission Input

- **D-04:** Inline input field + Add button, docked below the word pool. Always visible — no extra tap to reveal. Submit on Enter or tapping Add.
- **D-05:** Max 30 characters per entry. Multi-word phrases (e.g., "move the needle") are allowed — no space restriction.
- **D-06:** Duplicate rejection (case-insensitive, per LOBB-02) is shown as: input shakes + inline error text below the field: "'Synergy' is already in the pool". Error clears on next keystroke.

### Starter Pack UX (host-only)

- **D-07:** Three inline pill buttons visible only to the host: "Corporate Classics", "Agile", "Sales". Placed in a host-only section of the lobby, labeled "Seed from a starter pack:".
- **D-08:** Loading a pack merges its words into the existing pool. Duplicates (case-insensitive) are silently skipped — no error shown.
- **D-09:** Each pack button can only be used once per session. After loading, the button is visually marked as used (greyed out + checkmark icon). Re-tapping a used pack button does nothing.

### Grid Threshold & Start Game Affordance

- **D-10:** Grid tiers (from LOBB-05): 3×3 = 5–11 words minimum, 4×4 = 12–20 words, 5×5 = 21+ words.
- **D-11:** A visual progress bar with tier markers (3×3 → 4×4 → 5×5) is shown near the Start Game control, displaying the word count toward the next tier. Updates live as words are added/removed.
- **D-12:** Start Game button: visible only to the host. Disabled (with the threshold indicator) while the minimum word count for the current tier is unmet. Enabled the instant the threshold is crossed.
- **D-13:** Non-hosts see "Waiting for [HostName] to start the game…" in subdued text in place of the Start Game control. No disabled button shown to non-hosts.

### Claude's Discretion

- Exact chip styling (border radius, padding, background color within the Phase 1 design system)
- Word pool empty state copy (e.g., "No words yet — add some buzzwords!")
- Exact wording of the threshold hint (e.g., "Need 1 more word for a 3×3 board" vs counter-only)
- Animation behavior when a pack is loaded (chips appear sequentially or all at once)
- Whether the word pool scrolls independently or the page scrolls as one unit

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` §Lobby — LOBB-01 through LOBB-07 are the acceptance criteria for this phase
- `.planning/PROJECT.md` — project context, constraints, key decisions table (stack and patterns validated in Phase 1)

### Phase 1 Foundations
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-CONTEXT.md` — established design decisions (dark theme, chip/badge patterns, lobby layout, display name rules, connection banner)
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-UI-SPEC.md` — design system: color tokens (`#0F0F14`, `#F5D547` accent yellow), spacing scale, typography (Inter/Space Grotesk), component inventory
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-PATTERNS.md` — Svelte 5 runes patterns, PartyServer room class extension pattern, Valibot message schema extension pattern

### Codebase Entry Points (read before implementing)
- `src/lib/protocol/messages.ts` — current Valibot schemas for ClientMessage, ServerMessage, RoomState; Phase 2 adds new message variants here
- `src/lib/stores/room.svelte.ts` — current room store using PartySocket + Svelte 5 `$state`; Phase 2 extends this with word pool state
- `party/game-room.ts` — GameRoom Durable Object; Phase 2 adds word pool management (add/remove/dedupe) and the "start game" transition
- `src/lib/components/` — existing Badge, Button, TextInput, Modal components; chips reuse/extend Badge with a delete affordance

No external spec files exist — requirements fully captured in REQUIREMENTS.md and decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Badge.svelte` — chip-style visual; needs a delete-affordance variant (pass `onDelete` prop) for owned word chips
- `Button.svelte` — covers Add button, pack buttons, and Start Game CTA
- `TextInput.svelte` — already has error display pattern; shake animation to be added for duplicate rejection
- `PlayerRow.svelte` — not directly reused for words, but its pattern (row with conditional action) informs the chip design
- `room.svelte.ts` — `createRoomStore` factory is the extension point for word pool reactive state

### Established Patterns
- Svelte 5 `$state` + `$derived` for reactive store state (no Svelte stores or external state managers)
- Valibot `v.variant("type", [...])` discriminated union for all WS messages — new message types follow the same pattern
- Server-authoritative broadcast: DO holds state, broadcasts to all connections on change; clients update from server messages only
- `conn.setState({ playerId })` on the DO side for tracking which player owns a connection
- `sessionStorage` identity: `bsbingo_player_{roomCode}` → `{ playerId, displayName }` — word ownership should be tracked by `playerId`

### Integration Points
- `RoomState` in `messages.ts` needs a `words` array field (array of `{ wordId, text, submittedBy }`)
- `ClientMessage` needs: `submitWord`, `removeWord`, `loadStarterPack`, `startGame` variants
- `ServerMessage` needs: `wordAdded`, `wordRemoved`, `gameStarted` variants (or full `roomState` broadcast — TBD for researcher)
- `GameRoom` DO: add `#words` Map, add dedupe logic, add starter pack content, add `startGame` guard checking minimum word count
- New route: `src/routes/room/[code]/+page.svelte` is the existing lobby page — Phase 2 augments it with the word pool UI sections

</code_context>

<specifics>
## Specific Ideas

- Grid tiers: 3×3 minimum = 9 cells → 9 words; but LOBB-05 says 5–11 → 3×3 is valid at 5 words (remaining cells are blanks per BOAR-04). Researcher should confirm the exact minimum: is it 5 or 9? The requirement says 5 — blanks fill the rest.
- Starter pack words should be defined server-side (in the DO or a shared constants file) to avoid client-side tampering
- Word IDs: use `nanoid` (already installed) to assign a unique `wordId` per submission — needed for stable chip keys and targeted removal
- Pack loading counts as "submitted by" the host player (or a special `"pack"` sentinel) — ownership determines who can delete; host can delete their own pack words, others cannot

</specifics>

<deferred>
## Deferred Ideas

- Per-word voting / democratic removal → v2 (MODR-02 out of scope)
- Word character validation beyond length (profanity filter) → v2 (MODR-02)
- Mid-game word pool modifications → out of scope; pool is frozen on start
- Multiple starter pack loads / pack management → deferred; once per session is sufficient for v1

</deferred>

---

*Phase: 02-lobby-gameplay-word-submission-start*
*Context gathered: 2026-04-17*
