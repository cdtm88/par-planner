---
phase: 01-foundation-transport-room-lobby-presence
plan: "02"
subsystem: transport
tags: [partyserver, durable-objects, websocket, hibernation, worker-entry, api, tdd]
dependency_graph:
  requires:
    - src/lib/protocol/messages.ts (Plan 01)
    - src/lib/util/roomCode.ts (Plan 01)
  provides:
    - party/game-room.ts
    - src/worker.ts
    - src/routes/api/rooms/+server.ts
    - src/routes/api/rooms/[code]/exists/+server.ts
    - src/hooks.server.ts
  affects:
    - Plan 03 (home page calls POST /api/rooms)
    - Plan 04 (lobby opens PartySocket to /parties/game-room/{code})
    - Plan 05 (e2e tests assert exact request/response shapes produced here)
tech_stack:
  added: []
  patterns:
    - PartyServer Server subclass with static options = { hibernate: true }
    - Valibot v.safeParse on every inbound WS message
    - First-hello-is-host with #players.size === 0 && #hostId === null guard
    - onAlarm idle-reap pattern (deleteAll when empty, re-arm when players present)
    - Worker entry composing routePartykitRequest + SvelteKit fallthrough
    - onBeforeConnect room-existence 404 gate (SESS-07)
    - SvelteKit error() throws for collision exhaustion and missing platform env
    - handleError sanitizing server errors (ASVS V11)
key_files:
  created:
    - party/game-room.ts
    - src/worker.ts
    - src/routes/api/rooms/+server.ts
    - src/routes/api/rooms/[code]/exists/+server.ts
    - src/hooks.server.ts
    - tests/unit/game-room.test.ts
    - tests/unit/api-rooms.test.ts
  modified:
    - src/lib/protocol/messages.ts (added PARTY_NAME export)
    - wrangler.jsonc (main changed to src/worker.ts)
decisions:
  - "Approach A chosen for Worker composition: wrangler.main = src/worker.ts; src/worker.ts imports .svelte-kit/cloudflare/_worker.js at build-time. For wrangler dev, run vite build first to generate the SK handler. The adapter overwrites src/worker.ts during vite build — see Known Issue below."
  - "IDLE_TTL_MS = 30 * 60 * 1000 (30 min) — per RESEARCH.md Open Question 2, A1"
  - "Host-transfer deferred to Phase 5 (RESI-05) per CONTEXT.md D-14 — #hostId stays set after host leaves (orphaned room is acceptable in Phase 1)"
  - "Cloudflare workers-types / Web API Response type collision resolved with cast through unknown in GET /api/rooms/[code]/exists/+server.ts"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  files_created: 7
  files_modified: 2
  tests_passing: 59
---

# Phase 1 Plan 02: GameRoom DO + Worker Entry + API Endpoints Summary

GameRoom Durable Object with WebSocket Hibernation, first-hello-is-host, presence broadcast, and alarm-based idle reaper; Worker entry routing /parties/* to PartyServer with a room-existence 404 gate; POST /api/rooms and GET /api/rooms/[code]/exists HTTP endpoints; server error sanitization hook. 18 new unit tests, all green.

## What Was Built

### Task 1: GameRoom Durable Object + Worker Entry (TDD)

**RED:** `tests/unit/game-room.test.ts` — 11 failing tests covering all behaviors.

**GREEN:** `party/game-room.ts` + `src/worker.ts` — implementations passing all 11 tests.

**GameRoom DO (`party/game-room.ts`):**

| Feature | Implementation |
|---------|---------------|
| Hibernation | `static options = { hibernate: true }` — opt-in from day one |
| In-memory state | `#hostId`, `#players: Map<playerId, Player>`, `#createdAt` |
| Host assignment | `isFirst = #players.size === 0 && #hostId === null` (Pitfall 8) |
| onMessage | `v.safeParse(ClientMessage, JSON.parse(raw))` → bad_message error on failure |
| hello flow | setState({playerId}) on conn, send roomState to newcomer, broadcast playerJoined to others |
| ping | pong response |
| onClose | read conn.state.playerId, delete from map, broadcast playerLeft |
| onRequest | endsWith('/exists') → 200 `{ exists: true, playerCount }`; else 404 |
| onAlarm | empty: `ctx.storage.deleteAll()`; players present: re-arm alarm |
| IDLE_TTL_MS | 30 * 60 * 1000 (30 minutes) |

**Worker entry (`src/worker.ts`):**

- Re-exports `GameRoom` for wrangler DO registration
- `routePartykitRequest` with `onBeforeConnect` existence gate (SESS-07)
- Falls through to SvelteKit handler for all other routes
- `wrangler.jsonc main` updated to `src/worker.ts`

**PARTY_NAME export added to `src/lib/protocol/messages.ts`:**
```ts
export const PARTY_NAME = "game-room";
```

### Task 2: POST /api/rooms + GET /api/rooms/[code]/exists + hooks (TDD)

**RED:** `tests/unit/api-rooms.test.ts` — 7 failing tests.

**GREEN:** 3 files implemented, all 7 tests pass.

**POST /api/rooms (`src/routes/api/rooms/+server.ts`):**
- Imports `makeRoomCode` from `$lib/util/roomCode` (canonical alphabet, no duplication)
- 5-attempt collision-retry: pings DO via `stub.fetch("https://do/exists")`, returns code on `!ok`
- Returns `{ code, shareUrl: "${url.origin}/join/${code}" }`
- `error(500)` on platform unavailable or 5 collisions

**GET /api/rooms/[code]/exists (`src/routes/api/rooms/[code]/exists/+server.ts`):**
- Proxies DO liveness ping
- `error(404, { message: "Room not found" })` if DO returns !ok or throws

**`src/hooks.server.ts`:**
- `handleError` logs full details server-side; returns generic `"An unexpected error occurred."` to client (ASVS V11 / T-01-02-09)

## Adapter Composition Approach: Approach A (chosen)

Per plan Approach A: `wrangler.main = "src/worker.ts"`. The `@sveltejs/adapter-cloudflare` reads `wrangler.main` and writes the SvelteKit bundle to that path during `vite build`. This means `src/worker.ts` is **overwritten by the adapter on every production build**.

**Dev workflow workaround:** For `wrangler dev`, run `pnpm build` first to generate `.svelte-kit/cloudflare/_worker.js`, then either:
1. Restore `src/worker.ts` from git before running `wrangler dev`
2. Or use a post-build Vite plugin that renames the SK output and regenerates the wrapper

**Phase 1 impact:** Unit tests (vitest) and `svelte-check` are unaffected — they don't require wrangler dev. Full end-to-end integration is Plan 05's scope. A build pipeline fix (Vite closeBundle plugin) is tracked in deferred items.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type Error] Fixed Response type collision in exists endpoint**
- **Found during:** Task 2 — `svelte-check` reported `@cloudflare/workers-types` `Response.headers` missing `getSetCookie` vs Web API `Headers`
- **Issue:** `stub.fetch()` returns a Cloudflare `Response` type; SvelteKit's `RequestHandler` expects a Web API `Response`. Both are structurally compatible at runtime.
- **Fix:** Added `as unknown as Response` cast with explanatory comment
- **Files modified:** `src/routes/api/rooms/[code]/exists/+server.ts`
- **Commit:** 7ada008

**2. [Rule 1 - Lint Error] Removed unused @ts-expect-error directive in test**
- **Found during:** Task 1 — `svelte-check` flagged unused directive (the `as never` cast already suppresses the error without the directive)
- **Fix:** Removed the `@ts-expect-error` comment; kept `as never` cast
- **Files modified:** `tests/unit/game-room.test.ts`
- **Commit:** 92a9543

## Known Stubs

None — no placeholder values or hardcoded empty data flow to UI rendering. The `src/routes/+page.svelte` stub from Plan 01 remains unchanged (Plan 03 scope).

## Deferred Items

- **Build pipeline:** `src/worker.ts` is overwritten by the adapter during `vite build`. A Vite `closeBundle` plugin is needed to: (1) move the SK-generated worker to `_sk_worker.js`, (2) restore the custom wrapper. Deferred to Plan 05 or a dedicated config plan.

## Threat Flags

No new threat surface beyond what is declared in the plan's `<threat_model>`. All T-01-02-* mitigations are implemented:

| Threat ID | Status |
|-----------|--------|
| T-01-02-02 | MITIGATED — `v.safeParse(ClientMessage, ...)` in `onMessage` |
| T-01-02-04 | MITIGATED — `onRequest /exists` and WS upgrade return identical 404 for reaped/missing rooms |
| T-01-02-06 | MITIGATED — `#hostId` owned by server; no `isHost` field in hello schema |
| T-01-02-08 | PARTIAL — `onBeforeConnect` existence gate present; origin allowlist deferred to Phase 5/6 |
| T-01-02-09 | MITIGATED — `handleError` returns generic message, logs server-side |

## Self-Check: PASSED

All created files verified present on disk:
- `party/game-room.ts` — FOUND
- `src/worker.ts` — FOUND
- `src/routes/api/rooms/+server.ts` — FOUND
- `src/routes/api/rooms/[code]/exists/+server.ts` — FOUND
- `src/hooks.server.ts` — FOUND
- `tests/unit/game-room.test.ts` — FOUND
- `tests/unit/api-rooms.test.ts` — FOUND

Commits verified in git log:
- `92a9543` — feat(01-02): add GameRoom Durable Object + Worker entry routing
- `7ada008` — feat(01-02): add /api/rooms endpoints + server error hook

All 59 unit tests pass. svelte-check: 0 errors, 0 warnings.
