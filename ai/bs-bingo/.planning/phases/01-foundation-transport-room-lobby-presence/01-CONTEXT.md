# Phase 1: Foundation — Transport, Room, Lobby, Presence - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the live room infrastructure: a host creates a room and gets a 6-character join code plus a shareable link; other players join by either path; everyone in the lobby sees the live roster update in real time. Nothing gameplay-specific (word submission, boards, win detection) is in scope — this phase proves that multi-client WebSocket sync works end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Home / Landing Page

- **D-01:** Single-page layout with two prominent CTAs: "Create a game" and "Join a game" (code entry field inline). No separate create/join routes — users land and immediately know their two options without navigating.
- **D-02:** No loading state needed on the home page — it is a static screen with no async data.

### Join Flow & Display Name

- **D-03:** Display name is collected inline (modal or sheet) the moment a user initiates either action (create or join). It is required before entering the lobby — no anonymous ghost players.
- **D-04:** Display name: max 20 characters, no special validation beyond non-empty trim. Stored in `sessionStorage` keyed by room ID — not persisted across sessions.
- **D-05:** Join code entry: uppercase, 6 characters, visually unambiguous alphabet (no 0/O/1/I/L). Input auto-uppercases and ignores ambiguous substitutions. Submit on Enter or button press.

### Room Code & Share Link

- **D-06:** 6-character nanoid with a custom alphabet. Displayed prominently in the lobby header. Copy-code button (Clipboard API) adjacent to the code.
- **D-07:** Share link = `{origin}/join/{code}`. Copy-link button in the lobby header alongside the code. Clicking the share link pre-fills the join code and prompts for a display name.

### Lobby Layout & Presence

- **D-08:** Lobby uses a vertical list layout. Each player entry shows: auto-assigned color circle with their initials, display name, and a "Host" badge (crown icon) on the room creator.
- **D-09:** Player list is ordered by join time (oldest at top). Live updates — new joiners append to the bottom; departures remove immediately with no animation needed in Phase 1.
- **D-10:** The lobby shows a "Waiting for players…" hint when fewer than 2 players are present.

### Connection State

- **D-11:** No persistent connection status indicator on the happy path — the UI is silent when connected. A non-blocking top banner ("Reconnecting…" with a spinner) appears only when the WebSocket is disconnected. Banner auto-dismisses on reconnect.

### Error States

- **D-12:** Expired, non-existent, or already-started rooms render a dedicated error page (not a broken lobby). The page shows a human-readable message and a single CTA: "Create a new game" (returns to home).
- **D-13:** Phase 5 handles reconnection/resume. Phase 1 error states are for cold-entry failures only (bad code, dead room).

### Host Designation

- **D-14:** First player to create the room is the host. This is shown in the lobby. Host cannot leave Phase 1 (host transfer is Phase 5 scope). In Phase 1, if the host navigates away the room is effectively orphaned — acceptable for this phase.

### Claude's Discretion

- Visual design (color palette, typography, spacing) — implement with Tailwind 4, clean and minimal, mobile-first
- Exact animation/transition style for player join/leave — subtle or none is fine
- Whether copy-code and copy-link are one combined button or two separate buttons
- Error message copy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` §Session — SESS-01 through SESS-07 are the acceptance criteria for this phase
- `.planning/PROJECT.md` — project context, constraints (zero-signup, browser-only, sub-second sync)

### Research Findings
- `.planning/research/STACK.md` — prescribed stack: SvelteKit 2.57 + Svelte 5 + PartyServer 0.4.1 + PartySocket 1.1.16 + Cloudflare Durable Objects + Wrangler 4.83 + Tailwind 4.2 + nanoid 5.1
- `.planning/research/ARCHITECTURE.md` — component boundaries, DO room pattern, join-code generation approach (nanoid custom alphabet, 6 chars), sessionStorage identity model
- `.planning/research/PITFALLS.md` — session lifecycle must be specified before coding; player identity must be decoupled from WebSocket (RESI-01 is Phase 5 but the token architecture is Phase 1); unambiguous code alphabet
- `.planning/research/SUMMARY.md` — executive summary with critical risks

### External Docs (for implementer to consult)
- PartyServer docs: `https://docs.partykit.io` — room pattern, DO binding, Cloudflare adapter
- SvelteKit Cloudflare adapter: official docs for `@sveltejs/adapter-cloudflare`
- Wrangler config: `wrangler.jsonc` with DO binding setup

No external spec files exist yet — requirements fully captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is a greenfield project. Phase 1 creates the scaffold.

### Established Patterns
- To be established in this phase: SvelteKit route structure, Svelte 5 runes store pattern, PartyServer room class pattern, Tailwind 4 component styling.

### Integration Points
- This phase creates the root: `src/` for SvelteKit frontend, `party/` for PartyServer Durable Object, `wrangler.jsonc` binding them.
- All subsequent phases integrate into the room state machine established here.

</code_context>

<specifics>
## Specific Ideas

- Use `nanoid` with alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (removes ambiguous chars 0/O/1/I/L) for room codes
- `sessionStorage` key: `bsbingo_player_{roomCode}` → `{ playerId, displayName }` — decoupled from WS per ARCHITECTURE.md guidance (enables Phase 5 reconnection)
- Share link format: `https://{domain}/join/{code}` — pre-fills the join code input on the home page
- Home page: minimal, centered layout — "Bullshit Bingo" heading, two action buttons, possibly a one-liner tagline

</specifics>

<deferred>
## Deferred Ideas

- Host transfer on disconnect → Phase 5 (RESI-05)
- Reconnect / session resume → Phase 5 (RESI-01 through RESI-04)
- Spectator mode → v2 (explicitly out of scope)
- QR code for join link → v2

</deferred>

---

*Phase: 01-foundation-transport-room-lobby-presence*
*Context gathered: 2026-04-16*
