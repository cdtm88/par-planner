# Feature Landscape

**Domain:** Real-time multiplayer browser party game (buzzword bingo for meetings)
**Researched:** 2026-04-16
**Confidence:** MEDIUM-HIGH (grounded in competitor analysis of BuzzwordBingoApp, Jackbox, Skribbl.io, Gartic Phone, Kahoot; patterns verified against multiple sources)

## Design Principles (derived from competitor analysis)

Browser party games (Jackbox, Skribbl.io, Gartic Phone, BuzzwordBingoApp) converge on a consistent pattern:

1. **Zero friction to start** — room code or link, no signup, open in any browser
2. **Host is one of the players** — not a separate role, just a player with extra controls
3. **Lobby is the pre-game social space** — see who's joined, chat, settings, word submission happens here
4. **Meeting context matters** — players have the game in a side tab; UX must tolerate split attention and quick glances
5. **Celebrate wins visibly** — confetti, sound, announcement; this IS the payoff

## Table Stakes

Features without which the game fundamentally doesn't work or feels broken. Missing any of these means shipping an MVP that doesn't deliver the core value.

| # | Feature | Why Table Stakes | Complexity | Dependencies |
|---|---------|------------------|------------|--------------|
| 1 | **Create game session (host flow)** | Entry point — nothing works without it. Generates a room ID/code. | Low | — |
| 2 | **Join via shareable code AND link** | Dual path is standard (Jackbox, Kahoot, Skribbl). Code for in-person/verbal share, link for chat paste. | Low | #1 |
| 3 | **Display name on join** | Anonymous != nameless. Players must distinguish each other on the presence list and winner announcement. | Low | #2 |
| 4 | **Lobby / waiting room** | Shows who's in, their ready state, host controls. Every competitor has this. | Medium | #1, #2, #3 |
| 5 | **Live player list / presence** | See who's in the room, who just joined, who left. WebSocket-driven. | Medium | #4 |
| 6 | **Word submission during lobby phase** | Core differentiator of BS Bingo vs generic bingo: players contribute. Needs per-player submission UI with add/remove. | Medium | #4 |
| 7 | **Duplicate word detection (case-insensitive, trimmed)** | If two players submit "Synergy" and "synergy ", they must collapse to one entry. Otherwise board generation is broken. | Low | #6 |
| 8 | **Minimum word threshold before start** | Host can't start a 3x3 game with 4 words. Need rule: `words >= grid_size^2 - blank_count`. | Low | #6 |
| 9 | **Host-triggered "Start Game" action** | Everyone needs to transition from lobby to board simultaneously. Host decides when the word pool is ready. | Low | #4, #6 |
| 10 | **Grid size selection (3x3 / 4x4 / 5x5)** | Per project requirements. Host picks OR it's auto-derived from word count. Auto-derivation is simpler. | Low | #6 |
| 11 | **Per-player randomized board generation** | Each player's board is unique. Server-authoritative (not client-random) to prevent board-rerolling cheats. | Medium | #9, #10 |
| 12 | **Free space / blank slot insertion** | Classic bingo convention. Also fills boards when word count < grid^2. Blanks count toward wins per project spec. | Low | #11 |
| 13 | **Click-to-mark tile interaction** | Core gameplay loop. Tap/click toggles marked state. Needs clear visual feedback (strikethrough, color, checkmark). | Low | #11 |
| 14 | **Real-time mark propagation to server** | Mark events sent via WebSocket so server can detect wins authoritatively. | Medium | #13 |
| 15 | **Server-authoritative win detection** | Server checks rows/columns/diagonals on each mark event. Client-side-only detection is trivially cheatable. | Medium | #14 |
| 16 | **Win announcement broadcast** | All players see "Alice won!" within ~1s of the winning click. Freezes/ends the round. | Low | #15 |
| 17 | **Game end state** | After win, game is OVER. Show final boards, winner, option to play again. | Low | #16 |
| 18 | **Mobile-responsive board layout** | Project constraint: desktop AND mobile browser. 5x5 on a phone needs special care (tap targets >= 44px). | Medium | #13 |
| 19 | **Reconnection on disconnect** | Meeting context = flaky networks, tab suspends, laptop lid closes. Players MUST be able to rejoin with state intact. Session ID in URL/localStorage; server replays board state. | High | #5, #14 |
| 20 | **Host reassignment or host-less operation** | If host disconnects mid-game, game shouldn't die. Options: auto-promote next player, or design game to not need a host post-start. | Medium | #19 |

## Differentiators

Features that elevate the experience from "functional" to "delightful." Competitor games that skip these feel generic. Pick 2-3 for v1.

| # | Feature | Value Proposition | Complexity | Priority for v1 |
|---|---------|-------------------|------------|-----------------|
| D1 | **Confetti / celebration animation on win** | The payoff moment. Jackbox, Kahoot, BuzzwordBingoApp all do this. Free win (canvas-confetti lib = ~5KB, one line). | Low | **YES** — highest ROI |
| D2 | **"BINGO!" button with announcement** | Instead of silent win detection, let the winning player smash a button that triggers the broadcast. More satisfying. | Low | **YES** |
| D3 | **Word submission suggestions / starter pack** | Pre-populated buzzword lists ("Corporate Classics", "Agile/Scrum", "Sales Jargon") so lazy hosts can seed the pool. BuzzwordBingoApp has 25+ categories. | Low-Medium | **YES** (small curated list) |
| D4 | **Live mark count indicator per player** | Show "3/5 marked" next to each player in the sidebar — creates tension, visible competition. | Medium | Maybe |
| D5 | **Sound effects (mark click, win fanfare)** | Audio feedback on mark + win sound. Must be mute-toggleable (meetings!). | Low | Maybe (must default OFF) |
| D6 | **QR code alongside join link** | Remote meeting? Share link. In-person hybrid? QR code for phones. BuzzwordBingoApp does this. | Low | Nice-to-have |
| D7 | **Social validation for wins** | BuzzwordBingoApp: bingo only valid if other players also marked the same words — clever anti-cheat. Could be v2 (too restrictive for v1). | Medium | **NO** (v2) |
| D8 | **Persistent room code (friendly codes)** | 4-6 char codes like "BERT-9K" instead of UUIDs. Easier to say aloud on a call. Jackbox/Kahoot standard. | Low | **YES** — essential UX |
| D9 | **"Copy link" button with clipboard API** | One-click share. Expected in 2026. | Low | **YES** |
| D10 | **Play again / rematch flow** | After win, keep lobby alive so same players can play again without rejoining. Optionally preserve or re-submit word pool. | Medium | **YES** — keeps sessions alive |
| D11 | **Animated board reveal** | Cards flip in with a stagger on game start. Visual polish signal. | Low | Nice-to-have |
| D12 | **Emoji reactions in lobby/during game** | Google Meet/Zoom have normalized this. Lightweight way to add "feel" without chat complexity. | Medium | **NO** (v2) |
| D13 | **In-game chat** | Jackbox/Skribbl have it. For meeting context, this competes with the actual meeting chat — scope creep. | Medium | **NO** (v2) |
| D14 | **Dark mode / theme** | Zero-effort quality signal. Tailwind `dark:` classes make this nearly free. | Low | Maybe |
| D15 | **Spectator mode** | Explicitly out-of-scope per PROJECT.md | — | **NO** |
| D16 | **Near-miss indicator (1 away from bingo)** | "Alice is 1 square from bingo!" Creates tension in endgame. | Medium | Nice-to-have |

**Recommended v1 differentiator set:** D1, D2, D3, D8, D9, D10 — all low-complexity, together they transform the game from "works" to "feels like a product."

## Anti-Features

Features to **deliberately NOT build** for v1. Every one of these is a trap that looks reasonable but burns time or compromises the core value prop (zero-friction meeting game).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **User accounts / login** | Violates core constraint. Every signup step is friction. | Anonymous session IDs in localStorage. Displayname is per-game. |
| **Profile avatars / custom avatars** | Rabbit hole: avatar picker, upload, moderation, persistence. | Auto-generate a colored initial/emoji from name hash. |
| **Friends list / persistent multiplayer connections** | Requires accounts. Violates ephemeral-session model. | Games are one-shot. Share the link again next time. |
| **Persistent game history / stats** | Out of scope per PROJECT.md. | Session memory only. Clear on browser close. |
| **In-game text chat** | Competes with the actual meeting's chat/voice. Adds moderation surface. | Let the meeting be the chat. |
| **Voice chat** | Hard, unnecessary (meeting already has voice), privacy minefield. | N/A |
| **Custom board sizes beyond 3x3/4x4/5x5** | Out of scope per PROJECT.md. Each size adds UX edge cases. | Three fixed sizes, auto-selected from word count. |
| **Spectator mode** | Out of scope per PROJECT.md. | All present users are players. |
| **Tournaments / brackets / leaderboards** | Implies persistence, accounts, engagement mechanics. Wrong product shape. | Single-session winner only. |
| **Monetization / ads / premium tiers** | Premature. Validate engagement first. | None in v1. |
| **Native mobile apps** | Explicit project constraint: browser-only. | Responsive web. |
| **Moderation / profanity filters on submitted words** | Meeting contexts are trusted (coworkers). Moderation is a cost trap. | Trust the host. If abused, v2 problem. |
| **Word voting / word approval** | Complexifies lobby. Players already self-curate in private meetings. | Everyone's submissions go in; duplicates merge. |
| **Server-persisted game state across restarts** | Implies a database for game data. Overkill. | In-memory server state. Game dies if server restarts (rare, rejoin link fails gracefully). |
| **AI-generated buzzwords / smart suggestions** | Neat but scope creep. | Static curated starter lists (D3). |
| **Multiple simultaneous rounds / multi-stage games** | v1 is one round → winner → rematch. | Keep it simple. |
| **Detailed end-game analytics ("your most-marked word")** | Fun but requires tracking; adds noise to the win moment. | Just show boards + winner. |
| **Email/SMS invitations** | Link copy is enough. Adds backend services. | Clipboard API + share sheet on mobile. |

## Feature Dependencies

Critical paths for build order:

```
Session creation (1)
  ├─→ Join flow (2, 3)
  │     └─→ Lobby (4)
  │           ├─→ Presence (5)
  │           ├─→ Word submission (6, 7, 8)
  │           └─→ Start game (9)
  │                 ├─→ Grid sizing (10)
  │                 └─→ Board generation (11, 12)
  │                       └─→ Gameplay (13, 14)
  │                             └─→ Win detection (15)
  │                                   └─→ Win announcement (16)
  │                                         └─→ End state (17)
  │                                               └─→ Play again (D10)
  ├─→ Reconnection (19) ← cross-cuts everything after lobby
  └─→ Mobile layout (18) ← applies to all UI

Differentiators slot in:
  - D8 (friendly codes) bolts onto (1)
  - D9 (copy link) bolts onto (2)
  - D3 (starter words) bolts onto (6)
  - D2 (BINGO button) wraps (15)
  - D1 (confetti) wraps (16)
```

## MVP Recommendation

**v1 scope = all 20 table stakes + D1, D2, D3, D8, D9, D10.**

This delivers:
- A game that works end-to-end (table stakes)
- A game that feels polished in the one moment that matters most — the win (D1, D2)
- A game that onboards a meeting in under 60 seconds (D3, D8, D9)
- A game people keep playing once the first round ends (D10)

**Explicit v1 deferrals (document these as "v2" in PROJECT.md):**
- D4 (live mark count), D5 (sounds), D7 (social validation), D12 (reactions), D13 (chat), D14 (dark mode), D16 (near-miss)

**Explicit non-goals (document these as anti-features):** see Anti-Features table above.

## Build Order Guidance for Roadmap

Suggested phase decomposition (for the roadmap agent to consume):

1. **Foundation**: Session creation, join flow, naming, lobby shell, presence (features 1–5, D8, D9)
2. **Lobby gameplay**: Word submission, duplicates, starter packs, grid sizing, start game (features 6–10, D3)
3. **Board + core loop**: Board generation, blanks, click-to-mark, mark propagation (features 11–14, 18)
4. **Win + polish**: Server win detection, BINGO button, announcement, end state, confetti, play again (features 15–17, D1, D2, D10)
5. **Resilience**: Reconnection, host reassignment, mobile polish (features 19, 20, plus 18 refinement)

Phase 5 (resilience) is flagged as **likely needing deeper research** — WebSocket reconnection + server-authoritative state recovery is the most technically dense area and has known pitfalls (sequence numbers, message replay, heartbeats).

## Sources

- [BuzzwordBingoApp — modern multiplayer buzzword bingo reference](https://www.buzzwordbingoapp.com/) — closest direct competitor; observed: Socket.IO, QR codes, themes, word packs, social validation for wins
- [Buzzword bingo — Wikipedia](https://en.wikipedia.org/wiki/Buzzword_bingo) — canonical rules, cultural context
- [Jackbox Games — party game UX reference](https://www.jackboxgames.com/) — 4-letter room codes, host-as-player, phone-as-controller patterns
- [Games Like Gartic Phone — Jackbox Blog](https://www.jackboxgames.com/blog/games-like-gartic-phone) — survey of browser party game feature patterns
- [Skribbl / Gartic / Kahoot pattern analysis — Medium](https://kevinlinxc.medium.com/10-online-games-for-virtual-gatherings-dc243c1b5f3a) — common patterns across real-time browser party games
- [WebSocket reconnection guide — websocket.org](https://websocket.org/guides/reconnection/) — heartbeats, sequence numbers, state recovery (informs feature 19)
- [Multiplayer Bingo Game architecture — vulabs.dev](https://vulabs.dev/posts/multiuser_bingo_game/) — per-player unique board generation pattern
- [Client-Server Game Architecture — Gabriel Gambetta](https://www.gabrielgambetta.com/client-server-game-architecture.html) — server-authoritative model (informs feature 15)
- [RNG in online bingo — Wink Bingo](https://www.winkbingo.com/blog/the-random-number-generator-and-online-bingo-games) — fair board generation standards
- [Buzzword Bingo meeting play guide — Inc. Magazine](https://www.inc.com/geoffrey-james/how-to-play-buzzword-bingo.html) — cultural conventions (shout "Bingo!", word selection)

**Confidence caveats:**
- Feature lists for BuzzwordBingoApp (D3 categories, social validation, themes) derived from marketing copy — HIGH confidence they exist, MEDIUM confidence on exact implementation.
- "Jackbox/Kahoot/Skribbl use X pattern" claims are verified against multiple secondary sources; individual platform docs were not consulted directly for every claim.
- Reconnection complexity (feature 19) is well-documented pattern-wise but implementation choice is stack-dependent — flag for stack-aware research in that phase.
