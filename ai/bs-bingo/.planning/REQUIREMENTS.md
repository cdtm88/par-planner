# Requirements: Bullshit Bingo

**Defined:** 2026-04-16
**Core Value:** Players can join a live game, mark off buzzwords as they're said, and race to be the first to call "Bingo"

## v1 Requirements

### Session

- [ ] **SESS-01**: User can create a new game session and receive a 6-character join code and shareable link
- [ ] **SESS-02**: User can join an existing session by entering a join code
- [ ] **SESS-03**: User can join an existing session by opening a share link
- [ ] **SESS-04**: User can enter a display name to identify themselves in the lobby (no account required)
- [ ] **SESS-05**: All players in the lobby can see who has joined in real time (live presence)
- [ ] **SESS-06**: First player to create a room is designated the host
- [ ] **SESS-07**: User opening a link for an expired or non-existent room sees a clear error message

### Lobby

- [ ] **LOBB-01**: Players can submit words they expect to hear during the meeting
- [ ] **LOBB-02**: Duplicate words (case-insensitive) are rejected with a clear message
- [ ] **LOBB-03**: Players can remove words they personally submitted
- [ ] **LOBB-04**: Host can choose from starter buzzword packs (Corporate Classics, Agile, Sales) to pre-seed the word pool
- [ ] **LOBB-05**: Grid size is automatically derived from word count (3×3 for 5–11 words, 4×4 for 12–20 words, 5×5 for 21+ words)
- [ ] **LOBB-06**: Host cannot start the game until the minimum word count for the selected grid is reached
- [ ] **LOBB-07**: Host can start the game; non-hosts see a "waiting for host to start" state

### Board

- [ ] **BOAR-01**: Each player receives a uniquely generated bingo board upon game start
- [ ] **BOAR-02**: Boards are generated server-side using cryptographic randomness (Fisher-Yates shuffle)
- [ ] **BOAR-03**: Each player's board is private — only their own board layout is sent to them
- [ ] **BOAR-04**: Blank spaces are distributed across the board to fill remaining cells (total cells minus word count)
- [ ] **BOAR-05**: Player can click a word cell to mark it as called; cell shows a visual marked state
- [ ] **BOAR-06**: Marked cells propagate to all players (peers see a mark count, not the board layout)
- [ ] **BOAR-07**: Board is displayed responsively and usable on mobile (minimum 44px tap targets)

### Win

- [ ] **WIN-01**: Server checks for a completed line (row, column, or diagonal including blanks) after every mark
- [ ] **WIN-02**: When a line is complete, server broadcasts the win to all players
- [ ] **WIN-03**: Winning player sees a celebration state (confetti animation + "BINGO!" announcement)
- [ ] **WIN-04**: All players see who won and which line completed
- [ ] **WIN-05**: Host can start a new game from the end screen, resetting to lobby with the same players

### Resilience

- [ ] **RESI-01**: Player identity is stored in sessionStorage and decoupled from the WebSocket connection
- [ ] **RESI-02**: Server holds a player's slot for 30–60 seconds after disconnection before removing them
- [ ] **RESI-03**: Reconnecting player receives a full game state snapshot and resumes their session
- [ ] **RESI-04**: UI shows a "reconnecting…" indicator when the WebSocket connection is lost
- [ ] **RESI-05**: If the host disconnects, host role transfers to the next-longest-connected player
- [ ] **RESI-06**: Game proactively resyncs state when the browser tab becomes visible again (visibilitychange)

## v2 Requirements

### Social

- **SOCL-01**: Players can react with emoji during the game
- **SOCL-02**: Near-miss indicator shows when a player is one cell away from winning
- **SOCL-03**: Sound effects on mark and win
- **SOCL-04**: Social-validation anti-cheat (peers must confirm a word was said before it counts)

### Access

- **ACCE-01**: QR code generation for join link
- **ACCE-02**: Spectator mode — watch without a board
- **ACCE-03**: Dark mode support

### Moderation

- **MODR-01**: Host can remove a player from the game
- **MODR-02**: Basic profanity filter on submitted words

### Persistence

- **PERS-01**: Game history — view past game results
- **PERS-02**: Custom word list save/reload across sessions

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / authentication | Kills zero-friction join; games are ephemeral |
| Custom grid sizes (host chooses) | Auto-derive from word count is simpler and sufficient |
| In-game chat | Scope creep; players are already in a Zoom call |
| AI-generated buzzwords | Adds complexity, defers to after core loop proven |
| Native mobile app | Browser-only is sufficient; meetings happen on any device |
| Game persistence / history | Ephemeral sessions only for v1 |
| Monetization | Not a v1 concern |
| Word voting (democratic removal) | Over-engineered for a meeting party game |
| Mid-game joins | Post-start joins rejected; spectators are v2 |

## Traceability

*Populated during roadmap creation.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | Phase 1 | Pending |
| SESS-02 | Phase 1 | Pending |
| SESS-03 | Phase 1 | Pending |
| SESS-04 | Phase 1 | Pending |
| SESS-05 | Phase 1 | Pending |
| SESS-06 | Phase 1 | Pending |
| SESS-07 | Phase 1 | Pending |
| LOBB-01 | Phase 2 | Pending |
| LOBB-02 | Phase 2 | Pending |
| LOBB-03 | Phase 2 | Pending |
| LOBB-04 | Phase 2 | Pending |
| LOBB-05 | Phase 2 | Pending |
| LOBB-06 | Phase 2 | Pending |
| LOBB-07 | Phase 2 | Pending |
| BOAR-01 | Phase 3 | Pending |
| BOAR-02 | Phase 3 | Pending |
| BOAR-03 | Phase 3 | Pending |
| BOAR-04 | Phase 3 | Pending |
| BOAR-05 | Phase 3 | Pending |
| BOAR-06 | Phase 3 | Pending |
| BOAR-07 | Phase 3 | Pending |
| WIN-01 | Phase 4 | Pending |
| WIN-02 | Phase 4 | Pending |
| WIN-03 | Phase 4 | Pending |
| WIN-04 | Phase 4 | Pending |
| WIN-05 | Phase 4 | Pending |
| RESI-01 | Phase 5 | Pending |
| RESI-02 | Phase 5 | Pending |
| RESI-03 | Phase 5 | Pending |
| RESI-04 | Phase 5 | Pending |
| RESI-05 | Phase 5 | Pending |
| RESI-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after initial definition*
