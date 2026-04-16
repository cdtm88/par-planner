---
phase: 01-foundation-transport-room-lobby-presence
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 49
files_reviewed_list:
  - .gitignore
  - e2e/error-page.spec.ts
  - e2e/host-designation.spec.ts
  - e2e/join-by-code.spec.ts
  - e2e/join-by-link.spec.ts
  - e2e/presence.spec.ts
  - package.json
  - party/game-room.ts
  - playwright.config.ts
  - scripts/patch-worker.mjs
  - src/app.css
  - src/app.d.ts
  - src/hooks.server.ts
  - src/lib/components/Badge.svelte
  - src/lib/components/Banner.svelte
  - src/lib/components/Button.svelte
  - src/lib/components/ErrorPage.svelte
  - src/lib/components/Modal.svelte
  - src/lib/components/PlayerRow.svelte
  - src/lib/components/TextInput.svelte
  - src/lib/protocol/messages.ts
  - src/lib/session.ts
  - src/lib/stores/room.svelte.ts
  - src/lib/util/initials.ts
  - src/lib/util/playerColor.ts
  - src/lib/util/roomCode.ts
  - src/routes/+error.svelte
  - src/routes/+layout.svelte
  - src/routes/+layout.ts
  - src/routes/+page.svelte
  - src/routes/api/rooms/+server.ts
  - src/routes/api/rooms/[code]/exists/+server.ts
  - src/routes/join/[code]/+page.svelte
  - src/routes/join/[code]/+page.ts
  - src/routes/room/[code]/+page.svelte
  - src/routes/room/[code]/+page.ts
  - src/worker.ts
  - svelte.config.js
  - tests/unit/api-rooms.test.ts
  - tests/unit/game-room.test.ts
  - tests/unit/initials.test.ts
  - tests/unit/playerColor.test.ts
  - tests/unit/protocol.test.ts
  - tests/unit/room-store.test.ts
  - tests/unit/roomCode.test.ts
  - tests/unit/session.test.ts
  - tsconfig.json
  - vitest.config.ts
  - wrangler.jsonc
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 49
**Status:** issues_found

## Summary

This phase lays the entire foundation: Durable Object per room, WebSocket transport via PartyServer, SvelteKit SPA on Cloudflare, Valibot protocol validation, session persistence via `sessionStorage`, and a lobby UI with real-time presence. The architecture is sound and the code is well-structured overall. Test coverage is meaningful — unit tests exercise the DO state machine, room store, and API handlers; e2e tests cover the critical join and presence flows.

One critical security issue was found in the `session.ts` module: `JSON.parse` is called on untrusted `sessionStorage` data without a try/catch, making the application crash-prone if the stored value is malformed. Five warnings address logic gaps (unsafe array access, unhandled async errors, a reconnection status that never transitions to "closed", alarm not awaited, and a missing `displayName` guard before the player attempts to connect). Five informational items cover dead-code paths, a magic-number timeout, a console.warn left in production code, a missing `postbuild` script entry, and an unvalidated `params.code` path parameter.

---

## Critical Issues

### CR-01: `JSON.parse` on sessionStorage value without error handling — crashes on malformed data

**File:** `src/lib/session.ts:8`
**Issue:** `getOrCreatePlayer` reads from `sessionStorage` and calls `JSON.parse` directly on the result with no try/catch. If the stored string is not valid JSON (e.g., corrupted by a browser extension, a partial write, or a future code change that stores a non-JSON value), this throws a `SyntaxError` that propagates uncaught through the call stack. `getOrCreatePlayer` is called from `createRoomStore` (during page mount) and from the room page's `$derived` block, so the crash would be visible to the user as a blank page with no recovery path.

**Fix:**
```typescript
export function getOrCreatePlayer(code: string): PlayerSession {
  const key = `bsbingo_player_${code}`;
  const existing = sessionStorage.getItem(key);
  if (existing) {
    try {
      return JSON.parse(existing) as PlayerSession;
    } catch {
      // Corrupted entry — fall through to create a fresh one.
      sessionStorage.removeItem(key);
    }
  }
  const p: PlayerSession = { playerId: nanoid(), displayName: "" };
  sessionStorage.setItem(key, JSON.stringify(p));
  return p;
}
```

The same pattern applies to the inline `JSON.parse(raw)` in `src/routes/room/[code]/+page.svelte:47` where `sessionStorage` is read directly for `myPlayerId`.

---

## Warnings

### WR-01: `onStart` schedules alarm without `await` — alarm may not be set before first request is handled

**File:** `party/game-room.ts:42`
**Issue:** `this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS)` is called without `await` inside `onStart`. `setAlarm` returns a `Promise<void>`; if it is not awaited, the alarm may not be persisted before the DO begins handling requests. A DO that starts up and immediately receives a `/create` then disconnects could be reaped at the platform's default eviction window rather than the intended 30-minute TTL.

**Fix:**
```typescript
async onStart() {
  this.#active = (await this.ctx.storage.get<boolean>("active")) ?? false;
  this.#createdAt = Date.now();
  await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
}
```

### WR-02: `connection.status` never transitions to `"closed"` on WebSocket error

**File:** `src/lib/stores/room.svelte.ts:44-47`
**Issue:** The `error` event handler sets both the local `status` and the global `connection.status` to `"reconnecting"`. There is no path where `connection.status` transitions to `"closed"` unless `disconnect()` is called explicitly. If PartySocket exhausts its retry budget and emits a terminal close, the banner will remain stuck in "Reconnecting…" forever because the `close` listener also sets status to `"reconnecting"`. Users would see a perpetual spinner with no signal that the connection is truly lost.

**Fix:** Distinguish between PartySocket's internal reconnecting close and a terminal close. PartySocket exposes a `closeCode` or you can track retry attempts:
```typescript
ws.addEventListener("close", (ev) => {
  // PartySocket sets wasClean=false while actively reconnecting.
  // A clean close (code 1000/1001) means the server intentionally closed.
  const terminal = (ev as CloseEvent).wasClean || (ev as CloseEvent).code === 1000;
  const next = terminal ? "closed" : "reconnecting";
  status = next;
  connection.status = next;
});
```
At minimum, expose `"closed"` as a reachable state so the UI can show "Connection lost — reload to rejoin" instead of a spinner.

### WR-03: `submitModal` in `+page.svelte` does not validate `displayName` against empty string after `trim()` when `join` path is taken without prior existence check

**File:** `src/routes/+page.svelte:61-64`
**Issue:** In the `"join"` branch of `submitModal`, the code calls `setDisplayName(code, trimmed)` then immediately navigates to `/room/${code}` without first verifying the room exists. A user who manually types a non-existent code into the join field and submits will be taken directly to the room page, where the WebSocket upgrade will be blocked with a 404 by `onBeforeConnect`, and the user lands on a broken room page rather than the descriptive error page. The `/join/[code]` route path correctly calls `/api/rooms/[code]/exists` first; the home-page join flow skips this check.

**Fix:** Add a room-existence check in the `"join"` branch:
```typescript
if (modalMode === "join") {
  const check = await fetch(`/api/rooms/${pendingJoinCode}/exists`);
  if (!check.ok) throw new Error("Room not found");
  code = pendingJoinCode!;
}
```

### WR-04: `getInitials` does not guard against an empty string after `trim()` — throws on empty name

**File:** `src/lib/util/initials.ts:4`
**Issue:** If `displayName` is an empty string (or a whitespace-only string), `displayName.trim().split(/\s+/)` yields `[""]`, and `parts[0].slice(0, 2)` returns `""`. This is not a crash, but `parts[0][0]` on line 5 is `undefined` for an empty string, meaning the two-word branch would produce `"undefined".toUpperCase()` as a concatenation artifact if somehow called with a one-character empty `parts[0]`. More practically: a player who somehow has an empty `displayName` in storage will display two empty initials in the avatar circle — the circle renders with no text and the aria-hidden attribute means screen readers also get nothing.

The real exposure point is that a player can reach `/room/[code]` with `displayName: ""` (the `getOrCreatePlayer` default) if they navigate directly without going through the join flow. The server accepts the `hello` message with an empty `displayName` because Valibot requires `minLength(1)` on `displayName` in `ClientMessage.hello`, so the server will reject it with `bad_message` — but the client silently drops unrecognised server messages only; `error` messages are `console.warn`'d and state is not rolled back, leaving the local player in a bad state.

**Fix:** Guard `getInitials` and also enforce `displayName.length > 0` before sending `hello`:
```typescript
export function getInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
```

### WR-05: `onAlarm` in `game-room.ts` re-arms alarm without `await`

**File:** `party/game-room.ts:144`
**Issue:** The `else` branch in `onAlarm` calls `this.ctx.storage.setAlarm(...)` without `await`. Since `onAlarm` is `async`, the un-awaited promise result is discarded. If the Cloudflare runtime doesn't complete the storage write before the DO is evicted, the room loses its reaper and lives indefinitely, accumulating unbounded memory on the platform. This mirrors the same issue in WR-01 but in a different branch.

**Fix:**
```typescript
async onAlarm() {
  if (this.#players.size === 0) {
    await this.ctx.storage.deleteAll();
    return;
  }
  await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
}
```

---

## Info

### IN-01: `console.warn` in production client-side message handler

**File:** `src/lib/stores/room.svelte.ts:66`
**Issue:** `console.warn("Server error:", msg.code, msg.message)` is emitted in production for every server-side `error` message. Until Sentry/PostHog are added (called out as later additions in CLAUDE.md), this is fine for dev, but it leaks server error codes to the browser console in production. It is low risk here (the codes are generic strings like `"bad_message"`) but worth converting to a no-op or scoping behind a `dev` flag before first release.

**Fix:** Gate behind Vite's `import.meta.env.DEV` or remove in favour of a future observability integration:
```typescript
case "error":
  if (import.meta.env.DEV) console.warn("Server error:", msg.code, msg.message);
  break;
```

### IN-02: Magic number `2000` ms in `copyCode` / `copyLink` reset timeouts

**File:** `src/routes/room/[code]/+page.svelte:57-59`, `src/routes/room/[code]/+page.svelte:63-65`
**Issue:** The timeout to reset clipboard button labels is hard-coded to `2000` ms in two places. A named constant would clarify intent and make future changes a one-line edit.

**Fix:**
```typescript
const COPY_FEEDBACK_MS = 2000;
// ...
setTimeout(() => (copyCodeLabel = "Copy code"), COPY_FEEDBACK_MS);
setTimeout(() => (copyLinkLabel = "Copy link"), COPY_FEEDBACK_MS);
```

### IN-03: `scripts/patch-worker.mjs` is not listed as `postbuild` in `package.json`

**File:** `package.json:8`
**Issue:** The `build` script is `"svelte-kit sync && vite build && node scripts/patch-worker.mjs"`. This is functional but unconventional — npm/pnpm lifecycle hooks (`postbuild`) exist precisely for post-build steps. This is purely cosmetic but the comment in `patch-worker.mjs` itself says "runs after `vite build`" and references a `"postbuild"` hook that does not actually exist. The current inline form also means the patch step runs even if `vite build` exits with a non-zero code only if `&&` stops the chain — which is actually correct behaviour. No functional issue but the comment is misleading.

**Fix:** Either update the comment in `patch-worker.mjs` to say "runs as part of the `build` script" or move it to a real `postbuild` hook for consistency with the documented intent.

### IN-04: `params.code` is passed to the DO without length/alphabet validation in the API routes

**File:** `src/routes/api/rooms/[code]/exists/+server.ts:15`, `src/routes/api/rooms/+server.ts` (indirectly)
**Issue:** `params.code` from the SvelteKit route parameter is passed directly to `env.GameRoom.idFromName(params.code)` without validating that it is 6 characters and from the unambiguous alphabet. A caller with a crafted path (e.g., `/api/rooms/../../secret/exists` or a 200-character string) causes `idFromName` to create or look up a DO with an arbitrary name. In the Cloudflare DO model, `idFromName` on an unexpected name is harmless (it just returns a stub for a non-existent room that will correctly return 404 from `/exists`), but it means a malicious caller can probe or create stubs for arbitrary strings, and there is no early-rejection boundary.

**Fix:** Add a guard at the top of the `GET` handler:
```typescript
if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(params.code)) {
  error(404, { message: "Room not found" });
}
```

### IN-05: `TextInput` uses both `bind:value` and an external `oninput` handler — double update risk

**File:** `src/lib/components/TextInput.svelte:55-59`
**Issue:** The component uses `bind:value` (two-way binding) alongside a caller-supplied `oninput` handler. The parent pages (e.g., `+page.svelte`) pass `oninput` handlers that update their own state variables. In Svelte 5, `bind:value` synchronises the prop with the input's value through the component's own reactive update; a parent-side `oninput` that also sets a separate `$state` variable on the same input event fires at the same time. For the join code input in particular, the `oninput` handler applies `normalizeCode(...).slice(0, 6)` and assigns to `joinCodeInput`, while `bind:value` binds to the same prop — this creates a loop where the parent value drives the input, but the input also drives the parent value back through `bind:value`. In practice, Svelte 5 handles this correctly because the binding is to `value` (a prop, not a DOM property), but the pattern is fragile and could produce subtle double-update issues as the component is reused.

**Fix:** Choose one mechanism. Since the parents need custom transformation (uppercasing, truncation), prefer a controlled pattern where the component emits an `oninput` event and the parent manages all state, removing `bind:value` from the component:
```svelte
<input
  id={inputId}
  class={inputClasses}
  value={value}
  {maxlength}
  {placeholder}
  {autofocus}
  {oninput}
  ...
/>
```

---

_Reviewed: 2026-04-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
