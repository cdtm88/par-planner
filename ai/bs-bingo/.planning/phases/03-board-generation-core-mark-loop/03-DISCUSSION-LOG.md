# Phase 3: Board Generation & Core Mark Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 03-board-generation-core-mark-loop
**Areas discussed:** Game Transition UX, Mark Visibility for Peers, Blank Cell Behavior, Board Cell Visual Design

---

## Game Transition UX

| Option | Description | Selected |
|--------|-------------|----------|
| Conditional render, same route | Board replaces lobby UI in /room/[code] when state.phase === 'playing'. WS stays open, no reconnect gap, Phase 5 resume is automatic. | ✓ |
| Navigate to new /game route | SvelteKit goto() to /room/[code]/game. Clean URL but triggers WS disconnect + reconnect race at the exact moment board data arrives. | |

**User's choice:** Conditional render, same route
**Notes:** Existing codebase already stubs this pattern. Phase 5 reconnect will work automatically from state.phase restoration.

---

## Mark Visibility for Peers

| Option | Description | Selected |
|--------|-------------|----------|
| Counter on player list | Add a live mark count to each PlayerRow in the existing player list. No new layout surface, reuses Phase 1 component, works on mobile. | ✓ |
| Scoreboard sidebar | Dedicated standings panel showing each player's mark count. Cleaner competitive read but adds layout surface competing with board on small screens. | |
| Toast notification | "Alex marked a word" toast on each mark. Social/meeting feel but risks becoming noisy in fast-marking games. | |

**User's choice:** Counter on player list
**Notes:** Reuses Phase 1 PlayerRow.svelte. Lowest complexity. Board space on mobile (BOAR-07) was a key constraint.

---

## Blank Cell Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-pre-marked at game start | Blanks appear already filled/checked from game load. Classic bingo FREE-space convention. Simpler win detection. | |
| Inert / passive | Blanks are visually distinct empty cells. Win detection counts them automatically. Tapping does nothing — requires clear visual design. | ✓ |

**User's choice:** Inert / passive
**Notes:** Semantically cleaner — blanks aren't words that were "said." Phase 4 win detection must treat blank === true as pre-satisfied without requiring a mark.

---

## Board Cell Visual Design

| Option | Description | Selected |
|--------|-------------|----------|
| Accent fill #F5D547 for marked | Yellow fill + dark text when marked. Instantly scannable, reuses existing accent token, WCAG AA (5.9:1). Blank cells: surface bg + faint border, clearly inert. | ✓ |
| Checkmark overlay | Mark icon on top of surface-colored cell. Preserves word legibility but tricky at 44px minimum cell size and with long phrases. | |
| Strikethrough + dim | Opacity reduction + line-through on marked cells. Minimal aesthetic but low contrast and passive feel for a party game. | |

**User's choice:** Accent fill #F5D547 for marked
**Notes:** Three-state visual: unmarked (#1A1A23 surface), marked (#F5D547 accent fill), blank (surface + faint border, no content).

---

## Claude's Discretion

- Grid sizing algorithm (shrink text vs truncate at 5×5)
- Player list placement during game (above board or collapsible)
- Mark transition animation style
- Exact blank cell border treatment

## Deferred Ideas

- Win-line highlight (Phase 4) — must differentiate from #F5D547 marked state
- Near-miss indicator — v2 (SOCL-02)
- Sound effects on mark — v2 (SOCL-03)
- Social-validation anti-cheat — v2 (SOCL-04)
