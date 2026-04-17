---
phase: 3
slug: board-generation-core-mark-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.0 (unit) + Playwright 1.49.0 (e2e) |
| **Config file** | `vitest.config.ts` (implicit via SvelteKit), `playwright.config.ts` |
| **Quick run command** | `npm run test:unit -- tests/unit/<file>.test.ts -t "<name>"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (unit) + ~60 seconds (e2e) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit -- tests/unit/<touched file>`
- **After every plan wave:** Run `npm run test:unit`
- **Before `/gsd-verify-work`:** Full suite (`npm test`) must be green
- **Max feedback latency:** ~30 seconds (unit only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | BOAR-02 | T-3-01 / — | `crypto.getRandomValues()` — no Math.random | unit | `npm run test:unit tests/unit/shuffle.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | BOAR-01/03/04 | T-3-02 / T-3-05 | Per-conn send, unique boards, correct blank fill | unit | `npm run test:unit tests/unit/game-room.test.ts -t "Phase 3"` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | BOAR-06 | T-3-03 / — | wordMarked contains only playerId + markCount | unit | `npm run test:unit tests/unit/game-room.test.ts -t "wordMarked"` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | BOAR-05 | — / — | Mark toggle updates class; blank is not a button | unit | `npm run test:unit tests/unit/BoardCell.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | BOAR-07 | — / — | min-h-11 min-w-11 on all cells | unit | `npm run test:unit tests/unit/Board.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 2 | BOAR-05/06 | — / — | End-to-end mark round-trip; peer badge updates ≤1s | e2e | `npm run test:e2e tests/e2e/board-mark.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/shuffle.test.ts` — NEW — property test (all elements retained) + statistical unbiasedness (1000 runs). Covers BOAR-02.
- [ ] `tests/unit/Board.test.ts` — NEW — grid structure, `min-h-11 min-w-11`, `aspect-square` present on all cells. Covers BOAR-07.
- [ ] `tests/unit/BoardCell.test.ts` — NEW — marked/unmarked/blank render paths; click handler; no button element on blank cells. Covers BOAR-05.
- [ ] `tests/unit/game-room.test.ts` — EXTENDED — new describe block "GameRoom — board & marks (Phase 3)": unique boards per player, boardAssigned per-connection (not broadcast), correct blank fill, wordMarked broadcast format, markWord rejects blank cellIds, markWord rejects unknown cellIds. Covers BOAR-01/03/04/06.
- [ ] `tests/unit/protocol.test.ts` — EXTENDED — parse tests for `markWord`, `boardAssigned`, `wordMarked` schemas. Covers message contract.
- [ ] `tests/unit/room-store.test.ts` — EXTENDED — handler tests for `boardAssigned` (board state set, markedCellIds reset) and `wordMarked` (playerMarks updated). Covers store wiring.
- [ ] `tests/e2e/board-mark.spec.ts` — NEW — two players, host starts, first player marks a cell, second player's badge shows 1 within 1s. Covers BOAR-05/06 end-to-end.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blank cells visually distinct (dashed border, faint opacity) | BOAR-04/D-09 | CSS visual appearance not reliably tested by Vitest | Open game, submit ≤5 words to get blanks, confirm blank cells have no text, no cursor-pointer, faint dashed border |
| Mark transition animation (120ms) | BOAR-05/D-06 | Animation timing subjective | Tap a word cell on mobile; confirm near-instant visual feedback; no flicker |
| Portrait mobile layout (44px+, no overflow) | BOAR-07 | Viewport sizing requires real device or Playwright resize | Open in DevTools mobile preview (375px wide), confirm no cell is clipped, all cells fully tappable |
| Sub-1s peer mark visibility on real network | BOAR-06 | Real latency only testable on real hardware | Two tabs on separate devices (or separate browsers), mark a cell, confirm peer badge updates before 1s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
