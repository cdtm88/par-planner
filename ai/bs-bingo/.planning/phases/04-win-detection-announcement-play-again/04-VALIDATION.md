---
phase: 4
slug: win-detection-announcement-play-again
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.0 (unit) + Playwright 1.49.0 (e2e) — inherited from Phase 3 |
| **Config file** | Implicit Vitest config via SvelteKit; `playwright.config.ts` |
| **Quick run command** | `npm run test:unit -- tests/unit/<file>.test.ts -t "<name>"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (unit) / ~60 seconds (full with e2e) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit -- tests/unit/<touched>.test.ts`
- **After every plan wave:** Run `npm run test:unit`
- **Before `/gsd-verify-work`:** Full suite must be green (`npm test`)
- **Max feedback latency:** ~30 seconds (unit)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | WIN-01 | T-4-03 | Forged win claim rejected by Valibot (winDeclared is ServerMessage only) | unit | `npm run test:unit tests/unit/winLine.test.ts` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | WIN-01 | — | N/A | unit | `npm run test:unit tests/unit/game-room.test.ts -t "Phase 4"` | ❌ W0 | ⬜ pending |
| 4-02-01 | 01 | 1 | WIN-02 | — | N/A | unit | `npm run test:unit tests/unit/protocol.test.ts -t "winDeclared"` | ❌ W0 | ⬜ pending |
| 4-03-01 | 01 | 1 | WIN-03 | — | N/A | unit | `npm run test:unit tests/unit/EndScreen.test.ts` | ❌ W0 | ⬜ pending |
| 4-03-02 | 01 | 1 | WIN-03 | — | N/A | unit | `npm run test:unit tests/unit/room-store.test.ts -t "winDeclared"` | ❌ W0 | ⬜ pending |
| 4-04-01 | 01 | 1 | WIN-04 | — | N/A | unit | `npm run test:unit tests/unit/WinLineIcon.test.ts` | ❌ W0 | ⬜ pending |
| 4-04-02 | 01 | 2 | WIN-04 | — | N/A | e2e | `npm run test:e2e tests/e2e/win-and-reset.spec.ts -t "both players see EndScreen"` | ❌ W0 | ⬜ pending |
| 4-05-01 | 01 | 1 | WIN-05 | T-4-02 | Host-only guard: non-host startNewGame silently dropped | unit | `npm run test:unit tests/unit/game-room.test.ts -t "startNewGame"` | ❌ W0 | ⬜ pending |
| 4-05-02 | 01 | 1 | WIN-05 | — | N/A | unit | `npm run test:unit tests/unit/room-store.test.ts -t "gameReset"` | ❌ W0 | ⬜ pending |
| 4-05-03 | 01 | 2 | WIN-05 | — | N/A | e2e | `npm run test:e2e tests/e2e/win-and-reset.spec.ts -t "host starts new game"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/winLine.test.ts` — NEW — covers WIN-01 detection for every line type, all three grid sizes, blank-satisfaction, negative cases, edge cases (empty marks, all-blanks line)
- [ ] `tests/unit/EndScreen.test.ts` — NEW — winner vs non-winner vs host render paths, aria-live, "Start new game" CTA visibility
- [ ] `tests/unit/WinLineIcon.test.ts` — NEW — cell-highlight correctness for every (type, index, gridSize) combination
- [ ] `tests/unit/game-room.test.ts` — EXTENDED — new describe block "GameRoom — win & reset (Phase 4)": win detection on completing mark, no winDeclared on non-completing mark, host-only startNewGame, gameReset clears boards/marks/phase, hibernation-safe rehydration of `phase: "ended"`
- [ ] `tests/unit/protocol.test.ts` — EXTENDED — parse tests for `startNewGame`, `winDeclared`, `gameReset`, the expanded `RoomState.phase` union, and the `WinningLine` object
- [ ] `tests/unit/room-store.test.ts` — EXTENDED — handler tests for `winDeclared` (fields set, phase flipped, confetti fired via mock), `gameReset` (all fields cleared, phase back to lobby), `startNewGame` sender
- [ ] `tests/e2e/win-and-reset.spec.ts` — NEW — two-browser flow: host + peer, seed 5+ words (3×3), host starts, host marks row to completion, both browsers see EndScreen (winner's BINGO vs peer's mini-grid), host clicks Start New Game, both browsers return to lobby with words retained

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confetti animation fires and looks correct | WIN-02 | Canvas animation; browser-only | Open app as winner, trigger win, confirm confetti burst fires once and is visually exuberant |
| Mobile Safari confetti renders without stutter | WIN-02 | Device-specific rendering | Test on iOS Safari; confirm `requestAnimationFrame` runs smoothly at 60fps |
| EndScreen is visually identical across all connected browsers | WIN-03 | Cross-browser layout | Open two browser tabs, trigger win, screenshot both EndScreens and compare |
| Host-leaves limitation during EndScreen | WIN-05 | Phase 5 scope | Document in HUMAN-UAT: if host disconnects on EndScreen, no play-again available until Phase 5 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
