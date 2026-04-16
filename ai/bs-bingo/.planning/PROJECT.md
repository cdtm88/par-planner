# Bullshit Bingo

## What This Is

Bullshit Bingo is a fun multiplayer online mini-game designed to be played during meetings. Players join a shared game session, submit words they expect to hear, and receive a randomly generated bingo board. As buzzwords are spoken during the meeting, players click to mark them off — first to complete a full line wins.

## Core Value

Players can join a live game, mark off buzzwords as they're said, and race to be the first to call "Bingo" — the real-time competitive element is what makes it fun.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Users can create a new game session and share a join code/link
- [ ] Users can join an existing game session via code or link
- [ ] Players can submit words they expect to hear before the game starts
- [ ] Host can start the game when ready
- [ ] Each player receives a uniquely generated bingo board with submitted words in random positions plus blank spaces
- [ ] Players can click words on their board to mark them off
- [ ] First player to complete a full line (row, column, or diagonal — including blanks) wins
- [ ] Win is detected and announced to all players in real time

### Out of Scope

- Persistent user accounts — anonymous/session-based play only (keeps it frictionless)
- Spectator mode — v2 addition
- Custom board sizes beyond standard options — v2
- Game history / statistics — v2

## Context

- Designed for use during video calls / remote meetings
- Should be lightweight and fast to start — no signup friction
- Real-time multiplayer requires WebSockets or similar push mechanism
- Board generation must ensure fair distribution of words and blanks across all players
- Grid size options (e.g. 3x3, 4x4, 5x5) depend on how many words are submitted

## Constraints

- **Performance**: Must feel instant — marking a word should reflect across all players within ~1 second
- **Accessibility**: No native app — browser-only, works on desktop and mobile
- **Simplicity**: Zero-signup flow — join by link or code, start playing immediately

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Browser-only, no native app | Minimizes friction — open a link during a meeting and play | — Pending |
| Anonymous sessions, no auth | No signup barrier; games are ephemeral | — Pending |
| Real-time via WebSockets | Words marked off must propagate to all players live | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-16 after initialization*
