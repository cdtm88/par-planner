---
phase: 2
slug: lobby-gameplay-word-submission-start
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (confirmed in package.json) |
| **Config file** | `vite.config.ts` (vitest config inline) |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-W0-01 | W0 | 0 | LOBB-01–07 | — | N/A | unit | `npm run test:unit -- game-room` | ❌ W0 | ⬜ pending |
| 2-W0-02 | W0 | 0 | LOBB-05 | — | N/A | unit | `npm run test:unit -- gridTier` | ❌ W0 | ⬜ pending |
| 2-W0-03 | W0 | 0 | Protocol | — | N/A | unit | `npm run test:unit -- protocol` | ❌ W0 | ⬜ pending |
| 2-01-01 | 01 | 1 | LOBB-01 | — | Word submitted appears in pool for all players | unit (DO) | `npm run test:unit -- game-room` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | LOBB-02 | — | Duplicate word rejected before broadcast | unit (DO) | `npm run test:unit -- game-room` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | LOBB-03 | — | Only word owner can remove; non-owner receives error | unit (DO) | `npm run test:unit -- game-room` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | LOBB-04 | — | Pack load idempotent; non-host ignored | unit (DO) | `npm run test:unit -- game-room` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | LOBB-05 | — | Grid tier threshold boundaries correct | unit (util) | `npm run test:unit -- gridTier` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 3 | LOBB-06 | — | startGame blocked below minimum word threshold | unit (DO) | `npm run test:unit -- game-room` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 3 | LOBB-07 | — | startGame transitions phase to "playing" and broadcasts | unit (DO) | `npm run test:unit -- game-room` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/game-room.test.ts` — extend with stubs for LOBB-01 through LOBB-07 DO behaviors
- [ ] `tests/unit/gridTier.test.ts` — new file, boundary tests for LOBB-05
- [ ] `tests/unit/protocol.test.ts` — extend with stubs for new Valibot message schemas

*Existing infrastructure covers all test running — no new framework installs required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Word appears in real-time for all players in lobby | LOBB-01 | Multi-client WS sync requires live browser | Open two tabs, submit word in one, verify appears in both |
| Start Game button state reflects pool viability | LOBB-06 | Visual state feedback requires rendered UI | Add < 5 words, confirm button disabled with hint; add 5th, confirm enabled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
