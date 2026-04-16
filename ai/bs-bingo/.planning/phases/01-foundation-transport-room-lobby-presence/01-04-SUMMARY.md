---
phase: 01-foundation-transport-room-lobby-presence
plan: "04"
subsystem: lobby-presence
tags: [partysocket, svelte5-runes, websocket, lobby, error-page, tdd]
dependency_graph:
  requires:
    - src/lib/protocol/messages.ts (Plan 01 — ServerMessage, RoomState, PARTY_NAME)
    - src/lib/session.ts (Plan 01 — getOrCreatePlayer)
    - party/game-room.ts (Plan 02 — DO that sends roomState/playerJoined/playerLeft)
    - src/lib/components/* (Plan 03 — Button, PlayerRow, Banner, ErrorPage)
    - src/routes/api/rooms/[code]/exists/+server.ts (Plan 02 — existence guard endpoint)
  provides:
    - src/lib/stores/room.svelte.ts
    - src/routes/room/[code]/+page.svelte
    - src/routes/room/[code]/+page.ts
    - src/routes/join/[code]/+page.ts
    - src/routes/+error.svelte
  affects:
    - Plan 05 (e2e tests import createRoomStore and drive the lobby)
    - src/routes/+layout.svelte (updated to read connection.status)
    - src/routes/join/[code]/+page.svelte (updated to use data.code from load)
tech_stack:
  added: []
  patterns:
    - createRoomStore factory with $state runes in .svelte.ts module
    - Module-level connection $state for cross-component reconnect status
    - vi.hoisted() for mock classes that need pre-hoist access in vitest
    - $state<T>(initialValue) generic form to avoid Svelte 5 never inference
    - Explicit RoomStore interface (no readonly) to avoid $state proxy type issues
    - +page.ts client-only load with browser guard for existence check
key_files:
  created:
    - src/lib/stores/room.svelte.ts
    - src/routes/room/[code]/+page.svelte
    - src/routes/room/[code]/+page.ts
    - src/routes/join/[code]/+page.ts
    - src/routes/+error.svelte
    - tests/unit/room-store.test.ts
  modified:
    - src/routes/+layout.svelte (connection.status → Banner visibility)
    - src/routes/join/[code]/+page.svelte (data.code from load instead of page.params)
decisions:
  - "PartySocket host set to window.location.host for same-origin deploy; falls back to localhost:8787 for SSR guard"
  - "Explicit RoomStore interface without readonly used instead of ReturnType<typeof createRoomStore> to avoid Svelte 5 $state proxy narrowing to never"
  - "$state<T>(value) generic form used for store/label vars to prevent null→never inference"
  - "$derived<RoomState | null>(store ? store.state : null) pattern avoids store?.state never error"
  - "vi.hoisted() used to define MockPartySocket before vi.mock factory runs (vitest hoisting requirement)"
metrics:
  duration: "~18 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  files_created: 6
  files_modified: 2
  tests_passing: 70
---

# Phase 1 Plan 04: Room Store + Lobby + Error Page Summary

Svelte 5 rune store wrapping PartySocket with module-level reconnect status; lobby page with live presence roster, copy buttons, host badge, reconnecting banner; client-side existence guards on room and join routes; global error page with Room not found copy and Create a new game CTA.

## What Was Built

### Task 1: Room Store + Lobby Page (TDD)

**RED:** `tests/unit/room-store.test.ts` — 11 failing tests covering store initialization, hello-on-open, roomState/playerJoined/playerLeft message handling, close→reconnecting, bad-message drop, and disconnect.

**GREEN:** `src/lib/stores/room.svelte.ts` — factory function + module-level `connection` state; `src/routes/room/[code]/+page.svelte` — full lobby UI; `src/routes/room/[code]/+page.ts` — existence guard load; `src/routes/+layout.svelte` — Banner reads `connection.status`.

**Room Store (`src/lib/stores/room.svelte.ts`):**

| Feature | Implementation |
|---------|---------------|
| PartySocket host | `window.location.host` (same-origin deploy) |
| party name | `PARTY_NAME = "game-room"` re-exported from protocol |
| hello on open | JSON `{ type: "hello", playerId, displayName }` |
| message parsing | `v.safeParse(ServerMessage, ...)` — unknown shapes dropped |
| playerJoined | dedup guard: only appends if playerId not already in array |
| playerLeft | filters by playerId |
| global status | `export const connection = $state({ status })` for layout Banner |
| disconnect | `ws.close()` + sets `connection.status = "closed"` |

**Lobby page (`src/routes/room/[code]/+page.svelte`):**
- Room code in Display 40/56px accent color per UI-SPEC
- Copy-code and copy-link buttons with 2000ms "Copied" feedback
- `Players · {n}` roster heading; `PlayerRow` keyed by `playerId`
- "Waiting for players" hint when n<2
- Host-only disabled Start Game + helper; non-host waiting text
- `onMount`/`onDestroy` lifecycle for store create/disconnect

**Layout update (`src/routes/+layout.svelte`):**
- Imports `connection` from room store
- `$derived(connection.status === "reconnecting")` drives Banner visibility

### Task 2: Error Page + /join Existence Guard

**`src/routes/+error.svelte`:**
- `page.status === 404` → "Room not found" heading; else "Something went wrong"
- AlertTriangle icon in `--color-destructive`
- Body copy matching UI-SPEC exactly
- "Create a new game" CTA → `/`

**`src/routes/join/[code]/+page.ts`:**
- Mirrors `room/[code]/+page.ts` existence guard
- Browser-only fetch to `/api/rooms/[code]/exists`
- `error(404, { message: "Room not found" })` on !ok

**`src/routes/join/[code]/+page.svelte` (updated):**
- Now uses `data.code` from load instead of `page.params.code`
- Eliminates dependency on `page` store for the code value

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type Error] PartySocket host required — added window.location.host**
- **Found during:** Task 1 — `svelte-check` reported `host` is required in `PartySocketOptions`
- **Issue:** RESEARCH.md said "host defaults to window.location.host" but TS types in partysocket 1.1.16 require it explicitly
- **Fix:** Added `const host = typeof window !== "undefined" ? window.location.host : "localhost:8787"` and passed `{ host, party: PARTY_NAME, room: code }`
- **Files modified:** `src/lib/stores/room.svelte.ts`
- **Commit:** a5cd44e

**2. [Rule 1 - Type Error] Svelte 5 $state never inference — switched to generic form**
- **Found during:** Task 1 — `svelte-check` reported `Property 'state' does not exist on type 'never'` on `store?.state`
- **Issue:** `let store: RoomStore | null = $state(null)` with `readonly` properties causes Svelte 5's rune transformer to narrow `store` to `never`. Three-step fix: (a) removed `readonly` from interface, (b) switched to `$state<RoomStore | null>(null)` generic form, (c) used `store ? store.state : null` instead of `store?.state`
- **Files modified:** `src/routes/room/[code]/+page.svelte`
- **Commit:** a5cd44e

**3. [Rule 1 - Vitest Hoisting] vi.hoisted() for MockPartySocket class**
- **Found during:** Task 1 RED phase — vitest threw `Cannot access 'MockPartySocket' before initialization` because `vi.mock` factories are hoisted above class declarations
- **Fix:** Wrapped class definition in `vi.hoisted()` which runs before mock factory evaluation
- **Files modified:** `tests/unit/room-store.test.ts`
- **Commit:** 3569c50 (RED), a5cd44e (updated)

## Known Stubs

**`src/routes/room/[code]/+page.svelte` — Start Game button is disabled:**
- File: `src/routes/room/[code]/+page.svelte`, lines 107-112
- The `Start Game` button renders disabled with helper text "Coming in the next build — add words first."
- This is intentional per UI-SPEC Phase 1 scope: game start flow is Phase 2+
- The lobby goal (SESS-05/06/07) is fully achieved; the disabled button is correct Phase 1 end state

## Threat Flags

No new threat surface beyond the plan's `<threat_model>`. All T-01-04-* mitigations implemented:

| Threat ID | Status |
|-----------|--------|
| T-01-04-01 | MITIGATED — `v.safeParse(ServerMessage, ...)` before any state mutation |
| T-01-04-02 | MITIGATED — Svelte escapes by default; no `{@html}` used anywhere in lobby |
| T-01-04-03 | MITIGATED — Error page renders identical copy for all 404 states |
| T-01-04-04 | MITIGATED — Non-404 errors show "Something went wrong" with `page.error?.message` |
| T-01-04-05 | ACCEPTED — PartySocket exponential backoff handles reconnect loop |

## Self-Check: PASSED

Files verified present on disk:
- `src/lib/stores/room.svelte.ts` — FOUND
- `src/routes/room/[code]/+page.svelte` — FOUND
- `src/routes/room/[code]/+page.ts` — FOUND
- `src/routes/join/[code]/+page.ts` — FOUND
- `src/routes/+error.svelte` — FOUND
- `tests/unit/room-store.test.ts` — FOUND

Commits verified:
- `3569c50` — test(01-04): add failing tests for room store (RED)
- `a5cd44e` — feat(01-04): add room store + lobby page with live presence
- `0c9f6b5` — feat(01-04): add +error.svelte and /join existence guard

All 70 unit tests pass. svelte-check: 0 errors, 1 pre-existing warning (autofocus in TextInput.svelte from Plan 03).
