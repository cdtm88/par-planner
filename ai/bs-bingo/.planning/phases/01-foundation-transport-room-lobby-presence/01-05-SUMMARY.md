---
phase: 01-foundation-transport-room-lobby-presence
plan: "05"
subsystem: e2e-testing
tags: [playwright, e2e, acceptance-gate, partyserver, durable-objects, websocket]
dependency_graph:
  requires:
    - party/game-room.ts (Plan 02 — GameRoom DO, now with POST /create + guarded /exists)
    - src/routes/api/rooms/+server.ts (Plan 02 — POST /api/rooms, updated to use /create)
    - src/routes/api/rooms/[code]/exists/+server.ts (Plan 02 — GET exists)
    - src/routes/+page.svelte (Plan 03 — home page)
    - src/routes/room/[code]/+page.svelte (Plan 04 — lobby)
    - src/routes/join/[code]/+page.svelte (Plan 03 — join flow)
    - src/routes/+error.svelte (Plan 04 — error page)
  provides:
    - e2e/join-by-code.spec.ts (SESS-02)
    - e2e/join-by-link.spec.ts (SESS-03)
    - e2e/presence.spec.ts (SESS-05)
    - e2e/host-designation.spec.ts (SESS-06)
    - e2e/error-page.spec.ts (SESS-07)
    - scripts/patch-worker.mjs (build pipeline fix deferred from Plan 02)
  affects:
    - All future plans — Phase 1 acceptance gate is GREEN
tech_stack:
  added:
    - Playwright 1.59.1 (chromium project, webServer on wrangler dev)
  patterns:
    - Post-build patch-worker.mjs to re-inject GameRoom export after adapter overwrites src/worker.ts
    - POST /create + guarded GET /exists pattern for DO room lifecycle (replaces exists-check creation)
    - x-partykit-room header required on all direct DO stub.fetch() calls
    - Two-browser-context Playwright pattern for multi-player presence tests
key_files:
  created:
    - e2e/join-by-code.spec.ts
    - e2e/join-by-link.spec.ts
    - e2e/presence.spec.ts
    - e2e/host-designation.spec.ts
    - e2e/error-page.spec.ts
    - scripts/patch-worker.mjs
  modified:
    - party/game-room.ts (POST /create endpoint + #active guard on /exists)
    - src/routes/api/rooms/+server.ts (uses POST /create not exists-check)
    - src/routes/api/rooms/[code]/exists/+server.ts (adds x-partykit-room header)
    - src/lib/components/TextInput.svelte (fix id/for mismatch: id={id} → id={inputId})
    - src/worker.ts (patched by scripts/patch-worker.mjs post-build)
    - package.json (build script includes patch-worker.mjs)
    - tests/unit/api-rooms.test.ts (updated for new create semantics)
    - tests/unit/game-room.test.ts (added 3 tests for POST /create + guarded /exists)
decisions:
  - "POST /create + guarded /exists pattern chosen to distinguish formally-created rooms from uninitialised DOs. PartyServer wraps all stub.fetch() calls, so every direct DO access now triggers onRequest — meaning /exists would always return 200 without an explicit #active guard."
  - "scripts/patch-worker.mjs post-build approach: injects GameRoom re-export and routePartykitRequest wrapper after the adapter overwrites src/worker.ts. Runs as part of pnpm build via package.json build script."
  - "x-partykit-room header required on all direct stub.fetch() calls: PartyServer's Wrapper.fetch() reads this header to set the DO name if not already hydrated from storage."
metrics:
  duration: "~45 minutes"
  completed: "2026-04-16"
  tasks_completed: 1
  files_created: 6
  files_modified: 8
  tests_passing: 79
---

# Phase 1 Plan 05: Playwright E2E Suite Summary

5 Playwright specs covering SESS-02 through SESS-07 — all green against wrangler dev in 3.1s. Phase 1 acceptance gate is GREEN for all automated SESS requirements. Includes 4 supporting bug fixes discovered during test execution.

## What Was Built

### Task 1: 5 Playwright Specs (SESS-02, 03, 05, 06, 07)

| Spec | SESS | What it proves |
|------|------|----------------|
| `e2e/join-by-code.spec.ts` | SESS-02 | Enter 6-char code on home page, arrive at `/room/{code}` with self in roster |
| `e2e/join-by-link.spec.ts` | SESS-03 | Visit `/join/{code}`, enter name, navigate to room |
| `e2e/presence.spec.ts` | SESS-05 | Two browser contexts; both see each other within 2s guardband; roster shrinks on close |
| `e2e/host-designation.spec.ts` | SESS-06 | First player is Host (badge visible, Start Game disabled); second player sees non-host UI |
| `e2e/error-page.spec.ts` | SESS-07 | `/join/ZZZZZZ` and `/room/ZZZZZZ` render "Room not found" heading + "Create a new game" CTA |

**Playwright run stats:** 6 tests, 6 passed, 0 failed — duration 3.1s (chromium, webServer: wrangler dev)

**Build pipeline fix (`scripts/patch-worker.mjs`):** The `@sveltejs/adapter-cloudflare` overwrites `src/worker.ts` with the SvelteKit worker on every `vite build`. This script runs as a post-build step and injects the GameRoom re-export plus routePartykitRequest wrapper back into the generated file. Added to `package.json` build script.

### Task 2: Human Checkpoint (mobile verification)

This checkpoint requires human verification on a real mobile device. It is **not automated** and is documented here for the verifier.

**What to verify:**
1. Start server: `pnpm build && pnpm exec wrangler dev --port 5173`
2. Create a tunnel (cloudflared or similar) for HTTPS (required for Clipboard API)
3. On a real phone (iPhone preferred for 44px HIG check):
   - Open tunnel URL in mobile Safari
   - Verify home page renders centered, tap targets feel natural
   - Tap "Create a game", enter name, submit → lobby loads
   - Verify room code is large/readable; tap "Copy code" → label changes to "Copied" for 2s
   - Tap "Copy link" → same verification
   - Open copied link in second tab/device; both see each other's roster update within ~1s
   - Verify no horizontal overflow in portrait
   - Kill first tab → second tab's roster shrinks within ~1s

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TextInput `id`/`for` mismatch — `getByLabel()` was failing**
- **Found during:** Task 1 — all tests using `getByLabel("Your name")` timed out
- **Issue:** `TextInput.svelte` set `for={inputId}` on the label (computed: `input-your-name`) but `id={id}` on the input (the prop, which was `undefined`). The label and input were not associated, so Playwright's accessibility-based `getByLabel` couldn't locate the input.
- **Fix:** Changed `<input id={id} ...>` to `<input id={inputId} ...>` to use the computed ID consistently
- **Files modified:** `src/lib/components/TextInput.svelte`
- **Commit:** 42faa3c

**2. [Rule 1 - Bug] src/worker.ts overwritten by adapter — added post-build patch script**
- **Found during:** Task 1 — `wrangler dev` failed with "GameRoom class not exported"
- **Issue:** `@sveltejs/adapter-cloudflare` reads `wrangler.jsonc main` and overwrites that file with its generated SvelteKit handler (no GameRoom export). This was flagged as a deferred item in Plan 02.
- **Fix:** `scripts/patch-worker.mjs` — reads the adapter-generated file, strips the original default export, injects `export { GameRoom }` + `routePartykitRequest` wrapper, re-exports a new default handler that routes `/parties/*` to PartyServer and falls through to SvelteKit.
- **Files modified:** `package.json` (build script), `scripts/patch-worker.mjs` (new), `src/worker.ts` (generated + patched)
- **Commit:** 42faa3c

**3. [Rule 1 - Bug] Missing `x-partykit-room` header on direct DO stub.fetch() calls**
- **Found during:** Task 1 — server logs showed "Missing namespace or room headers when connecting to GameRoom" on every `/api/rooms` request
- **Issue:** PartyServer's `Wrapper.fetch()` requires `x-partykit-room` header to hydrate the DO name. Direct `stub.fetch()` calls in the API handlers omitted this header.
- **Fix:** Added `{ headers: { "x-partykit-room": code } }` to all direct DO fetches in `+server.ts` files and in the `onBeforeConnect` handler in `patch-worker.mjs`
- **Files modified:** `src/routes/api/rooms/+server.ts`, `src/routes/api/rooms/[code]/exists/+server.ts`, `scripts/patch-worker.mjs`
- **Commit:** 42faa3c

**4. [Rule 1 - Bug] `/exists` always returned 200 — replaced with POST /create + guarded /exists**
- **Found during:** Task 1 — after fixing header, error-page tests failed (ZZZZZZ returned 200), and create-room tests failed (POST /api/rooms exhausted all 5 retries)
- **Issue:** PartyServer initialises a DO instance on every `stub.fetch()` call. The DO's `onRequest(/exists)` always returned `{ exists: true }` since `onStart` had been called. New rooms could never be created (every code appeared "taken"), and bad codes never triggered the error page (every code appeared "live").
- **Fix:** Added `#active` flag to `GameRoom`. New `POST /create` endpoint sets `#active = true` (first call: 200, subsequent: 409). `GET /exists` returns 404 until `#active` is true. Updated `POST /api/rooms` to use `POST /create` instead of exists-check. Updated unit tests (73 passing, +3 new tests for create/exists lifecycle).
- **Files modified:** `party/game-room.ts`, `src/routes/api/rooms/+server.ts`, `tests/unit/api-rooms.test.ts`, `tests/unit/game-room.test.ts`
- **Commit:** 42faa3c

**5. [Rule 1 - Bug] `getByText("Joining room")` exact-match failed**
- **Found during:** Task 1 — `join-by-link.spec.ts` timed out on `getByText("Joining room")`
- **Issue:** The join page renders `Joining room <span>{code}</span>` — Playwright's default `getByText` requires the full text content to match when the element has child elements. The partial string "Joining room" wasn't matched exactly.
- **Fix:** Changed to `getByText(/Joining room/)` (regex partial match)
- **Files modified:** `e2e/join-by-link.spec.ts`
- **Commit:** 42faa3c

## Checkpoint: Human Mobile Verification (Task 2)

**Status:** AWAITING HUMAN VERIFICATION

This is a `checkpoint:human-verify` task that cannot be automated. The mobile ergonomics check (44px tap targets, Clipboard API over HTTPS, portrait layout) requires a real device.

**Setup:**
```bash
pnpm build
pnpm exec wrangler dev --port 5173
# in a second terminal:
cloudflared tunnel --url http://localhost:5173
```

**Verification steps:** See Task 2 in `01-05-PLAN.md` for the full 7-step mobile flow.

**Resume signal:** Type `approved` after completing mobile verification, or describe a specific defect (e.g., "Copy button overlaps roster on iPhone SE") to trigger a revision.

## Known Stubs

**`src/routes/room/[code]/+page.svelte` — Start Game button disabled:**
- Inherited from Plan 04; intentional per UI-SPEC Phase 1 scope
- The disabled button is correct Phase 1 end-state; game start is Phase 2+

## Threat Flags

No new threat surface. All changes are within the existing trust boundaries established by Plans 02–04. The `POST /create` endpoint is internal (DO-to-DO, not client-facing) and cannot be reached from the public internet (only via `stub.fetch()` from the Worker, not from `/parties/*` routing).

## Self-Check: PASSED

Files verified present on disk:
- `e2e/join-by-code.spec.ts` — FOUND, contains SESS-02
- `e2e/join-by-link.spec.ts` — FOUND, contains SESS-03
- `e2e/presence.spec.ts` — FOUND, contains SESS-05 + browser.newContext + Players · 2
- `e2e/host-designation.spec.ts` — FOUND, contains SESS-06
- `e2e/error-page.spec.ts` — FOUND, contains SESS-07 + Room not found
- `scripts/patch-worker.mjs` — FOUND

Commit verified: `42faa3c` — test(01-05): add Phase 1 Playwright e2e suite

Test suite results:
- Unit tests: 73 passing (8 test files)
- E2E tests: 6 passing (5 spec files, chromium)
- Total: 79 tests green
