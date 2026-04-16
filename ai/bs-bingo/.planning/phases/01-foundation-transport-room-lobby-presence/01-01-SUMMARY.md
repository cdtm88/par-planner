---
phase: 01-foundation-transport-room-lobby-presence
plan: "01"
subsystem: scaffold
tags: [scaffold, sveltekit, cloudflare, tailwind, valibot, nanoid, partyserver, tdd]
dependency_graph:
  requires: []
  provides:
    - src/lib/protocol/messages.ts
    - src/lib/util/roomCode.ts
    - src/lib/session.ts
    - src/lib/util/playerColor.ts
    - src/lib/util/initials.ts
    - package.json
    - wrangler.jsonc
  affects:
    - All subsequent plans (02-05) import from protocol/messages.ts, session.ts, util/roomCode.ts
tech_stack:
  added:
    - svelte@5.55.4
    - "@sveltejs/kit@2.57.1"
    - "@sveltejs/adapter-cloudflare@7.2.8"
    - partyserver@0.4.1
    - partysocket@1.1.16
    - valibot@1.3.1
    - nanoid@5.1.9
    - lucide-svelte@1.0.1
    - tailwindcss@4.2.2
    - "@tailwindcss/vite@4.2.2"
    - wrangler@4.83.0
    - vitest@2.1.9
    - "@playwright/test@1.59.1"
  patterns:
    - SvelteKit SPA mode (ssr=false in +layout.ts)
    - Tailwind v4 @theme tokens in app.css (no config file)
    - Valibot discriminated-union schemas for wire protocol
    - nanoid customAlphabet for CSPRNG room codes
    - sessionStorage-keyed player identity (bsbingo_player_{code})
    - TDD: RED commit then GREEN commit
key_files:
  created:
    - package.json
    - pnpm-lock.yaml
    - svelte.config.js
    - vite.config.ts
    - wrangler.jsonc
    - tsconfig.json
    - vitest.config.ts
    - playwright.config.ts
    - src/app.html
    - src/app.d.ts
    - src/app.css
    - src/routes/+layout.ts
    - src/routes/+layout.svelte
    - src/routes/+page.svelte
    - src/lib/protocol/messages.ts
    - src/lib/util/roomCode.ts
    - src/lib/util/playerColor.ts
    - src/lib/util/initials.ts
    - src/lib/session.ts
    - tests/unit/roomCode.test.ts
    - tests/unit/session.test.ts
    - tests/unit/protocol.test.ts
    - tests/unit/playerColor.test.ts
    - tests/unit/initials.test.ts
    - .gitignore
    - .npmrc
  modified: []
decisions:
  - "Used lucide-svelte@^1.0.1 (current stable) instead of ^0.454.0 referenced in UI-SPEC (per RESEARCH.md Pitfall 10)"
  - "Added pnpm.onlyBuiltDependencies to package.json for esbuild/workerd/sharp native builds (pnpm 10 sandbox requirement)"
  - "Added src/app.html (SvelteKit HTML template) and minimal +layout.svelte / +page.svelte to satisfy svelte-check (no .svelte files = warning)"
  - "normalizeCode('ab c-0o1-iL-23') returns 'ABC23' not '23' — plan behavior description had an error; PATTERNS.md implementation is correct and tests match it"
metrics:
  duration: "~5 minutes (321 seconds)"
  completed: "2026-04-16"
  tasks_completed: 2
  files_created: 26
  tests_passing: 41
---

# Phase 1 Plan 01: Scaffold + Shared Contracts Summary

SvelteKit 2.57 + Svelte 5 + Tailwind 4 + wrangler.jsonc scaffold with Valibot wire protocol, nanoid room-code utilities, sessionStorage identity, and 41 green unit tests covering all Wave-0 contracts.

## What Was Built

### Task 1: SvelteKit Scaffold

Full project scaffold from scratch:

- **`package.json`** — all Phase 1 deps pinned: partyserver 0.4.1, partysocket 1.1.16, valibot 1.3.1, nanoid 5.1.9, lucide-svelte 1.0.1, tailwindcss 4.2.2, wrangler 4.83.0, vitest 2.1.9, @playwright/test 1.59.1
- **`wrangler.jsonc`** — `new_sqlite_classes: ["GameRoom"]` migration (not `new_classes` per Pitfall 1), `nodejs_als` compatibility flag
- **`svelte.config.js`** — `@sveltejs/adapter-cloudflare` with `/parties/*` route exclusion
- **`vite.config.ts`** — `tailwindcss()` + `sveltekit()` plugins (Tailwind v4 Vite plugin)
- **`src/app.css`** — `@import "tailwindcss"` + full `@theme` design tokens (bg, surface, divider, accent, destructive, ink-primary/secondary/disabled/inverse, font-sans/display)
- **`src/app.d.ts`** — `App.Platform.env.GameRoom: DurableObjectNamespace` ambient type
- **`src/routes/+layout.ts`** — `ssr = false; prerender = false; csr = true` (SPA mode, RESEARCH Pitfall 3)
- **`src/routes/+layout.svelte`** — imports app.css + Inter + Space Grotesk fonts
- **`src/routes/+page.svelte`** — minimal home page stub (Plan 03 will implement)

`pnpm install`: 232 packages installed. `pnpm exec svelte-check`: 0 errors, 0 warnings.

### Task 2: Test Infrastructure + Shared Utilities (TDD)

**RED commit:** `test(01-01)` — 5 failing test files authored before implementations.

**GREEN commit:** `feat(01-01)` — 5 implementations written; 41 tests pass.

**Implementations:**

| File | Key Contract |
|------|-------------|
| `src/lib/protocol/messages.ts` | `v.variant("type", [...])` schemas for `ClientMessage`, `ServerMessage`, `RoomState`, `Player`; `displayName` capped at 20 chars; `playerId` minLength(1) |
| `src/lib/util/roomCode.ts` | `ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"`; `makeRoomCode = customAlphabet(ROOM_CODE_ALPHABET, 6)`; `normalizeCode` strips non-alphabet chars |
| `src/lib/util/playerColor.ts` | djb2-style hash mapping `playerId` → 1 of 8 palette hex strings; deterministic across all clients |
| `src/lib/util/initials.ts` | First 2 chars for single word; first+last word initials for multi-word; uppercase |
| `src/lib/session.ts` | `getOrCreatePlayer(code)` mints a nanoid `playerId` once and persists to `sessionStorage.bsbingo_player_{code}`; `setDisplayName` preserves `playerId` |

**Test infrastructure:**
- `vitest.config.ts`: jsdom environment, `tests/unit/**/*.test.ts` pattern, browser conditions
- `playwright.config.ts`: `wrangler dev --port 5173` webServer, `retain-on-failure` tracing, chromium project

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing file] Added src/app.html**
- **Found during:** Task 2 — vitest printed `src/app.html does not exist` warning
- **Fix:** Created standard SvelteKit HTML template (`src/app.html`)
- **Files modified:** `src/app.html`
- **Commit:** 4a6038f

**2. [Rule 2 - Missing file] Added minimal +layout.svelte and +page.svelte in Task 1**
- **Found during:** Task 1 — `pnpm exec svelte-check` reported 1 warning (no svelte input files found)
- **Fix:** Created `src/routes/+layout.svelte` (imports fonts + css) and `src/routes/+page.svelte` (minimal stub)
- **Files modified:** `src/routes/+layout.svelte`, `src/routes/+page.svelte`
- **Commit:** 94941fb

**3. [Rule 2 - Build scripts] Added pnpm.onlyBuiltDependencies to package.json**
- **Found during:** Task 1 — pnpm 10's sandbox mode blocked native builds for esbuild/workerd/sharp
- **Fix:** Added `"pnpm": { "onlyBuiltDependencies": ["esbuild", "workerd", "sharp"] }` to package.json
- **Files modified:** `package.json`
- **Commit:** 94941fb

### Plan Correction

**normalizeCode expected value:** The plan's `<behavior>` section stated `normalizeCode("ab c-0o1-iL-23")` === `"23"`, but the PATTERNS.md implementation (`raw.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, "")`) correctly produces `"ABC23"` (a, b, c uppercase to A, B, C which are in the alphabet). The tests match the correct PATTERNS.md implementation. This was a documentation error in the plan's behavior section, not an implementation deviation.

## Known Stubs

- `src/routes/+page.svelte` — minimal home page stub. Full implementation is Plan 03 scope.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced beyond what is declared in the plan's `<threat_model>`.

## Self-Check: PASSED

All created files verified present on disk. Commits verified in git log:
- `94941fb` — chore(01-01): scaffold
- `db13975` — test(01-01): RED tests
- `4a6038f` — feat(01-01): GREEN implementations

All 41 unit tests pass. svelte-check: 0 errors, 0 warnings. pnpm install --frozen-lockfile: clean.
