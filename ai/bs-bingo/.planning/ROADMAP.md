# Roadmap: Bullshit Bingo

## Overview

Bullshit Bingo ships in five phases that each deliver a verifiable slice of the meeting-party experience: first a live room with presence, then word submission, then the randomized boards and the mark loop, then the payoff (win detection, celebration, play-again), and finally the resilience work that turns a happy-path demo into something that survives a real meeting on a flaky phone. Each phase ends with something a human can actually try; nothing sits half-built waiting for a later phase to light it up.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation — Transport, Room, Lobby, Presence** — Anyone can create a room, share a code or link, and see who has joined in real time.
- [ ] **Phase 2: Lobby Gameplay — Word Submission & Start** — Players can seed the word pool, the grid auto-sizes, and the host can start the game.
- [ ] **Phase 3: Board Generation & Core Mark Loop** — Every player gets a private, fairly shuffled board and can mark words that other players see count updates for.
- [ ] **Phase 4: Win Detection, Announcement & Play-Again** — The server declares the winner, everyone sees the celebration, and the host can rematch with the same lobby.
- [ ] **Phase 5: Resilience & Mobile Hardening** — Sessions survive phone locks, network drops, host disconnects, and tab-away meetings.

## Phase Details

### Phase 1: Foundation — Transport, Room, Lobby, Presence
**Goal**: A host can spin up a live room and share it, players can join by code or link with a display name, and everyone in the room sees the live roster update in under a second.
**Depends on**: Nothing (first phase)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06, SESS-07
**Success Criteria** (what must be TRUE):
  1. A user can create a new room and is shown both a 6-character join code and a shareable link.
  2. A second user can join that room either by entering the code or by opening the link, and both appear in the lobby with their chosen display names.
  3. When a new player joins or leaves, every other player in the lobby sees the roster update live without a manual refresh.
  4. The room's creator is visibly marked as host, and that designation is consistent for all players.
  5. Opening a link for an expired or unknown room lands on a clear error page rather than a broken lobby.
**Plans**: 5 plans
  - [x] 01-01-PLAN.md — Scaffold SvelteKit + Cloudflare + Tailwind, install test infra, author shared utilities (protocol schemas, roomCode, session, playerColor, initials)
  - [x] 01-02-PLAN.md — Implement GameRoom Durable Object + Worker entry + POST /api/rooms + existence endpoints
  - [x] 01-03-PLAN.md — Build design-system components + home page (create/join flows) + /join/[code] route
  - [x] 01-04-PLAN.md — Wire room store (PartySocket) + lobby page + error page + reconnecting banner
  - [x] 01-05-PLAN.md — Playwright e2e suite (SESS-02/03/05/06/07) + mobile-device human verification
**UI hint**: yes

### Phase 2: Lobby Gameplay — Word Submission & Start
**Goal**: Players can populate the buzzword pool (with starter packs as a shortcut), the grid size auto-negotiates from the word count, and the host can start the game only once the pool is viable.
**Depends on**: Phase 1
**Requirements**: LOBB-01, LOBB-02, LOBB-03, LOBB-04, LOBB-05, LOBB-06, LOBB-07
**Success Criteria** (what must be TRUE):
  1. Any player can submit a word and immediately see it appear in the shared word pool for everyone in the lobby.
  2. Attempting to submit a duplicate word (case-insensitive) is rejected with an inline message explaining why.
  3. A player can remove a word they personally submitted; they cannot remove words others submitted.
  4. The host can one-click seed the pool from a starter pack (Corporate Classics, Agile, or Sales) and those words merge into the pool without breaking dedupe.
  5. The "Start Game" control is visible to the host, disabled with an explanatory hint while the minimum word count for the current grid tier is unmet, and enabled the instant the threshold is crossed; non-hosts see a clear "waiting for host to start" state.
**Plans**: 3 plans
Plans:
  - [x] 02-01-PLAN.md — Define type contracts (Valibot schemas, gridTier utilities, starter pack constants) + unit tests
  - [x] 02-02-PLAN.md — Extend GameRoom DO with word pool handlers + room store with word state + DO unit tests
  - [x] 02-03-PLAN.md — Build UI components (WordChip, WordPool, PackPills, GridProgress) + wire into lobby page + human verification
**UI hint**: yes

### Phase 3: Board Generation & Core Mark Loop
**Goal**: Starting the game deals every player a private, server-generated board, and the mark-a-cell interaction round-trips to peers as a count update in under a second on both desktop and mobile.
**Depends on**: Phase 2
**Requirements**: BOAR-01, BOAR-02, BOAR-03, BOAR-04, BOAR-05, BOAR-06, BOAR-07
**Success Criteria** (what must be TRUE):
  1. When the host starts the game, every player transitions to a board screen showing a uniquely shuffled grid of the submitted words plus blank cells filling any remainder.
  2. A player's own board layout is visible only to that player — inspecting another player's network traffic or state does not leak it.
  3. Tapping a word cell toggles it into a visibly marked state on the acting player's board within the same frame.
  4. When one player marks a cell, every other player sees that player's public mark count update within ~1 second, without ever seeing the underlying layout.
  5. The board is fully usable on a phone held in portrait: every cell is at least a 44px tap target, nothing overflows the viewport, and marking works with touch as reliably as with a mouse.
**Plans**: 4 plans
Plans:
  - [x] 03-01-PLAN.md — Define BoardCell + markWord/boardAssigned/wordMarked message schemas + unbiased Fisher-Yates shuffle utility (BOAR-02)
  - [x] 03-02-PLAN.md — Extend GameRoom DO with startGame board-deal (per-connection send), markWord handler, wordMarked broadcast (BOAR-01/02/03/04/06)
  - [x] 03-03-PLAN.md — Extend room store with board/playerMarks/markedCellIds/toggleMark + BoardCell.svelte leaf component (BOAR-04/05)
  - [x] 03-04-PLAN.md — Board.svelte grid + PlayerRow markCount badge + room page wiring + e2e board-mark test (BOAR-04/05/06/07)
**UI hint**: yes

### Phase 4: Win Detection, Announcement & Play-Again
**Goal**: The server — not the client — decides who wins, every player sees a consistent celebration moment, and the host can reset the room for another round without anyone having to re-join.
**Depends on**: Phase 3
**Requirements**: WIN-01, WIN-02, WIN-03, WIN-04, WIN-05
**Success Criteria** (what must be TRUE):
  1. The instant a player's marks complete any row, column, or diagonal (blanks counted), the server declares them the winner and further marks no longer change the outcome.
  2. The winning player sees a celebration screen with a confetti animation and a "BINGO!" announcement.
  3. Every non-winning player sees who won and which line completed, and the view is identical in content across all clients.
  4. The host sees a "Start new game" control on the end screen that is unavailable to non-hosts.
  5. When the host triggers a new game, every player — without rejoining — lands back in the lobby with the roster and host role preserved, ready to submit words for a new round.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Resilience & Mobile Hardening
**Goal**: Real-meeting conditions — iPhones locking, tabs backgrounding, hosts dropping off Wi-Fi — no longer break a game in progress; disconnected players resume cleanly and hosts are reassigned automatically.
**Depends on**: Phase 4
**Requirements**: RESI-01, RESI-02, RESI-03, RESI-04, RESI-05, RESI-06
**Success Criteria** (what must be TRUE):
  1. A player whose connection drops mid-game sees a "reconnecting…" indicator, and once the network returns their full game state (board, marks, phase, winner if any) is restored without them having to refresh or re-enter a name.
  2. A player who closes and reopens their tab within the slot-hold window returns to the same seat in the same game, identified by their sessionStorage token.
  3. If the host disconnects and does not return within the slot-hold window, host role transfers to the next-longest-connected player and that transfer is visible to everyone.
  4. Switching back to a backgrounded tab triggers an immediate resync so the returning player's view matches the live state within a second.
  5. A player opening a link for a room that has been reaped still lands on the Phase 1 "room not found" error rather than a stalled lobby.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation — Transport, Room, Lobby, Presence | 0/5 | Not started | - |
| 2. Lobby Gameplay — Word Submission & Start | 0/3 | Not started | - |
| 3. Board Generation & Core Mark Loop | 0/4 | Not started | - |
| 4. Win Detection, Announcement & Play-Again | 0/TBD | Not started | - |
| 5. Resilience & Mobile Hardening | 0/TBD | Not started | - |

---
*Roadmap created: 2026-04-16*
*Coverage: 32 / 32 v1 requirements mapped (100%)*
