---
phase: 1
slug: foundation-transport-room-lobby-presence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` (unit) + `@playwright/test` (e2e) |
| **Config file** | `vitest.config.ts` / `playwright.config.ts` — Wave 0 installs |
| **Quick run command** | `pnpm exec vitest run --changed` |
| **Full suite command** | `pnpm exec vitest run && pnpm exec playwright test` |
| **Estimated runtime** | ~60–90 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run --changed`
- **After every plan wave:** Run `pnpm exec vitest run && pnpm exec playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | SESS-01 | T-room-code | `makeRoomCode()` only produces chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, length 6 | unit | `pnpm exec vitest run tests/unit/roomCode.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | SESS-01 | T-api | POST /api/rooms returns 6-char code + shareURL | unit (server) | `pnpm exec vitest run tests/unit/api-rooms.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | SESS-04 | T-session | Display name trims, enforces 1–20 chars, persists to `sessionStorage.bsbingo_player_{code}` | unit (browser) | `pnpm exec vitest run tests/unit/session.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 0 | — | T-protocol | Valibot `ClientMessage` schema rejects malformed hello payloads | unit | `pnpm exec vitest run tests/unit/protocol.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | SESS-02 | — | N/A | e2e | `pnpm exec playwright test e2e/join-by-code.spec.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | SESS-03 | — | N/A | e2e | `pnpm exec playwright test e2e/join-by-link.spec.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | SESS-05 | — | N/A | e2e (2 contexts) | `pnpm exec playwright test e2e/presence.spec.ts` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | SESS-06 | T-host | Server enforces `hostId`; client cannot self-grant host | e2e | `pnpm exec playwright test e2e/host-designation.spec.ts` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 3 | SESS-07 | T-404 | `/join/NOTREAL` renders error page with "Create a new game" CTA | e2e | `pnpm exec playwright test e2e/error-page.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest + jsdom/browser env for SvelteKit
- [ ] `playwright.config.ts` — two browser contexts, base URL from `wrangler dev`
- [ ] `tests/unit/roomCode.test.ts` — covers SESS-01 alphabet check
- [ ] `tests/unit/session.test.ts` — covers SESS-04 sessionStorage behavior
- [ ] `tests/unit/protocol.test.ts` — covers Valibot schemas
- [ ] `tests/unit/api-rooms.test.ts` — covers POST /api/rooms handler
- [ ] `e2e/join-by-code.spec.ts` — SESS-02
- [ ] `e2e/join-by-link.spec.ts` — SESS-03
- [ ] `e2e/presence.spec.ts` — SESS-05 (two contexts)
- [ ] `e2e/host-designation.spec.ts` — SESS-06
- [ ] `e2e/error-page.spec.ts` — SESS-07
- [ ] Framework install: `pnpm add -D vitest @vitest/ui @playwright/test jsdom` + `pnpm exec playwright install --with-deps`
- [ ] `package.json` scripts: `"test:unit": "vitest run"`, `"test:e2e": "playwright test"`, `"test": "vitest run && playwright test"`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile tap-target ergonomics (44px subjective feel) | BOAR-07 (Phase 3) | Physical iPhone ergonomic check is subjective | Load lobby on real iOS device, tap each cell with one thumb — all reachable without repositioning |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
