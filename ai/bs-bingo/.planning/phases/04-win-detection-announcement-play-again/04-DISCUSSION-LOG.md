# Phase 4: Win Detection, Announcement & Play-Again - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 04-win-detection-announcement-play-again
**Areas discussed:** End-screen presentation, Win line reveal to non-winners, Play-again reset scope

---

## End-Screen Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Phase swap — EndScreen component | `phase === 'ended'` renders a new `EndScreen.svelte`, mirrors lobby→playing pattern. Full-bleed confetti, no z-index risk, clean layout. | ✓ |
| Full-screen overlay | Win overlay on top of existing Board. Board DOM stays mounted. `Modal.svelte` already exists. | |
| Inline board freeze | Board cells freeze, win banner within board surface. Minimum DOM change. | |

**User's choice:** Phase swap — EndScreen component
**Notes:** Mirrors the established lobby→playing conditional render pattern exactly.

---

## Win Line Reveal to Non-Winners

| Option | Description | Selected |
|--------|-------------|----------|
| Mini grid icon — CSS/SVG visual | Small grid diagram with winning row/col/diagonal highlighted. Server sends `{ type, index }`. ~30 lines, no extra deps. | ✓ |
| Text label only | "Row 2", "Column 3", "Diagonal" as text in win announcement. Zero new UI complexity. | |
| Winner's full board shown to all | Winner's board broadcast to everyone so all can see the exact winning cells. | |

**User's choice:** Mini grid icon — CSS/SVG visual
**Notes:** Server encodes line as `{ type: 'row' | 'col' | 'diagonal', index: number }` to drive the icon for all players.

---

## Play-Again Reset Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Carry words + usedPacks, reset boards+marks+phase | Phase → lobby. Words retained + editable. Pack buttons stay marked used. Boards + marks cleared. Players + host unchanged. Host starts manually. | ✓ |
| Carry words, reset boards+marks+phase+usedPacks | Words kept, packs reset (can reload again). | |
| Full reset — everything clears | Word pool empties too. Players must re-submit. | |

**User's choice:** Carry words + usedPacks, reset boards+marks+phase
**Notes:** User clarified: after New Game, everyone lands in lobby where words are fully editable/removable as normal. Packs stay marked used (words already in pool). Host hits Start Game manually when ready — identical to first-run lobby experience.

---

## Claude's Discretion

- Confetti library: canvas-confetti (~10KB gzipped) — selected without asking per pragmatic-fast vendor profile
- Exact EndScreen layout (heading, winner name, mini grid icon, Play-Again CTA composition)
- Confetti particle config (colors, count, spread)
- Animation for Board → EndScreen transition
- Non-winner copy ("Better luck next time!", etc.)
- WinLineIcon cell sizing and highlight style

## Deferred Ideas

- Near-miss indicator → v2 (SOCL-02)
- Sound effects on win → v2 (SOCL-03)
- Social-validation anti-cheat → v2 (SOCL-04)
- Reconnection after win screen → Phase 5
- Post-game history → v2
