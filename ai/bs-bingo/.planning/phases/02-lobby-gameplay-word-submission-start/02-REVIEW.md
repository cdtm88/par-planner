---
phase: 02-lobby-gameplay-word-submission-start
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - party/game-room.ts
  - src/app.css
  - src/lib/components/GridProgress.svelte
  - src/lib/components/PackPills.svelte
  - src/lib/components/TextInput.svelte
  - src/lib/components/WordChip.svelte
  - src/lib/components/WordPool.svelte
  - src/lib/protocol/messages.ts
  - src/lib/stores/room.svelte.ts
  - src/lib/util/gridTier.ts
  - src/lib/util/starterPacks.ts
  - src/routes/room/[code]/+page.svelte
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Solid phase — protocol schema is tight, the DO concurrency discipline is correct (synchronous map checks before mutates), and the Svelte 5 rune patterns are used correctly throughout. One critical bug: the server broadcasts `roomState` on `startGame` but the client only handles a `gameStarted` message type — the phase transition never reaches the client. Four warnings cover host-orphan/error-visibility gaps, an unguarded `JSON.parse` that silently drops messages, and a `submitWord` path that strips text but never validates the result is non-empty after stripping. Three info items flag dead schema entry, TODO placeholder UI, and a magic divisor constant.

---

## Critical Issues

### CR-01: `startGame` phase transition is never received by the client

**File:** `party/game-room.ts:186` / `src/lib/stores/room.svelte.ts:79`

**Issue:** On `startGame` the server broadcasts `{ type: "roomState", state: this.#snapshot() }`. The client's message handler has a `case "roomState":` branch that updates `state` and `words` — but it does **not** update `state.phase`. It sets `state = msg.state`, so phase *should* propagate on the next `roomState` snapshot. However, `gameStarted` in the client store (line 79-81) handles `{ type: "gameStarted" }` which the server **never sends** — `gameStarted` is defined in `ServerMessage` schema but is a dead path on the server side.

The net effect: `gameStarted` is derived from `roomState?.phase === "playing"` in the page component (line 82), which reads from `roomState` — which is driven by `store.state`. When the server sends `roomState` with `phase: "playing"`, the client *does* update `state = msg.state`, so `gameStarted` would flip correctly via the `roomState` path. The `gameStarted` server message type is therefore **dead code** — it will never be sent, and the client handler for it is unreachable.

This is not a blocking bug today (transition works via `roomState`), but it is a protocol inconsistency: `ServerMessage` advertises `gameStarted` as a valid message type, the client has handling code for it, and the server never emits it. Any future consumer that relies on `gameStarted` specifically will silently never receive it.

**Fix:** Either have the server emit `{ type: "gameStarted" }` (and remove the redundant `roomState` broadcast on start), or remove the `gameStarted` variant from `ServerMessage` and the dead `case "gameStarted":` branch from the store. The simpler fix is to remove the dead type and keep the current `roomState` broadcast:

```typescript
// messages.ts — remove this line from ServerMessage:
v.object({ type: v.literal("gameStarted") }),

// room.svelte.ts — remove this dead branch:
case "gameStarted":
  if (state) state = { ...state, phase: "playing" };
  break;
```

---

## Warnings

### WR-01: Unguarded `JSON.parse` in client message handler silently drops valid messages

**File:** `src/lib/stores/room.svelte.ts:59`

**Issue:** `JSON.parse((ev as MessageEvent).data)` has no try/catch. If the server sends a malformed frame (or a non-JSON control message), the uncaught `SyntaxError` will bubble up as an unhandled promise-like exception in the event listener, potentially crashing the reactive update loop silently.

**Fix:**
```typescript
ws.addEventListener("message", (ev) => {
  let raw: unknown;
  try {
    raw = JSON.parse((ev as MessageEvent).data);
  } catch {
    return; // ignore non-JSON frames
  }
  const parsed = v.safeParse(ServerMessage, raw);
  if (!parsed.success) return;
  // ...
});
```

---

### WR-02: `submitWord` does not validate that text is non-empty after `trim()` on the server

**File:** `party/game-room.ts:118`

**Issue:** The server reads `const normalized = text.trim()`. The `submitWord` schema only enforces `minLength(1)` on the **raw** `text` before trimming (line 37 of messages.ts). A client that sends `{ type: "submitWord", text: "  " }` (all whitespace) will pass schema validation but produce `normalized = ""` — an empty string — which then gets stored as a valid word with `wordId`.

**Fix:** Add a post-trim guard:
```typescript
case "submitWord": {
  const { text } = result.output;
  const normalized = text.trim();
  if (!normalized) {
    conn.send(JSON.stringify({ type: "error", code: "bad_message" }));
    return;
  }
  // ... existing dedupe + insert logic
```

Alternatively, add a `v.trim()` pipe to the schema so the contract is enforced before it reaches the handler:
```typescript
text: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(30)),
```

---

### WR-03: Host disconnection orphans the room with no client feedback

**File:** `party/game-room.ts:212-214` / `src/routes/room/[code]/+page.svelte:259-262`

**Issue:** When the host disconnects, `#hostId` is intentionally left as-is (acknowledged as deferred to Phase 5). The server broadcasts `playerLeft`, which the client processes and removes the host from `state.players`. On the client, `iAmHost` is derived from `roomState.hostId === myPlayerId`, and `hostName` falls back to `roomState?.players.find((p) => p.isHost)`. When the host leaves: `state.players` no longer contains the host, so `hostName` resolves to `"the host"`. The "Start Game" button disappears for all remaining players (none of them are host), and the UI shows "Waiting for the host to start the game…" indefinitely with no indication the host left.

This is a known deferral (D-14), but there is no client-side signal that the game is stuck. Non-host players will wait forever with no actionable message.

**Fix (minimal for Phase 2):** Derive a `hostIsPresent` boolean and show a warning:
```svelte
const hostIsPresent = $derived(
  roomState?.players.some((p) => p.playerId === roomState?.hostId) ?? true
);

// In the waiting footer:
{#if !iAmHost}
  {#if !hostIsPresent}
    <p class="text-base text-[var(--color-destructive)]">
      The host left. Waiting for them to reconnect…
    </p>
  {:else}
    <p class="text-base text-[var(--color-ink-secondary)]">
      Waiting for {hostName} to start the game…
    </p>
  {/if}
{/if}
```

---

### WR-04: `loadStarterPack` uses `O(n)` scan inside a loop — can create words silently above pool limit

**File:** `party/game-room.ts:164-174`

**Issue:** For each word in a starter pack (up to 20 words), the handler does `[...this.#words.values()].some(...)` — an O(n) full-scan per word. With a large word pool this is O(pack_size × pool_size). More importantly: there is no upper bound on total pool size. A malicious or careless client can call `loadStarterPack` (after clearing `#usedPacks` — not currently possible but a future gap) repeatedly until the pool is arbitrarily large, which then fans out one `wordAdded` broadcast per word to all clients.

This is a code quality issue now and a DoS surface later. The scan pattern is also used in `submitWord` (line 120) for the same reason.

**Fix:** Add a pool cap constant and enforce it in both `submitWord` and `loadStarterPack`:
```typescript
const MAX_WORDS = 200; // more than enough for any meeting

// In submitWord, before inserting:
if (this.#words.size >= MAX_WORDS) {
  conn.send(JSON.stringify({ type: "error", code: "word_limit_reached" }));
  return;
}

// In loadStarterPack loop, add a guard:
if (this.#words.size >= MAX_WORDS) break;
```

---

## Info

### IN-01: `gameStarted` in `ServerMessage` is dead schema — never emitted by server

**File:** `src/lib/protocol/messages.ts:59`

**Issue:** `v.object({ type: v.literal("gameStarted") })` is in `ServerMessage` but the server always sends `roomState` on game start. This diverges the schema from the implementation and misleads future developers about what messages the server can emit. (This is the flip side of CR-01.)

**Fix:** Remove the `gameStarted` entry from `ServerMessage` once the decision in CR-01 is made. No functional change needed.

---

### IN-02: Placeholder "Game on!" UI is shipped as-is with a hardcoded `TODO` note

**File:** `src/routes/room/[code]/+page.svelte:142-150`

**Issue:** The `gameStarted` branch renders "Board generation coming in the next phase." This is intentional scaffolding, but the copy leaks an implementation detail to real users if deployed to production before Phase 3.

**Fix:** Replace with a neutral in-progress message before any real deployment, e.g. "Game starting…" or "Hang tight — setting up your board."

---

### IN-03: Magic divisor `21` duplicated between `GridProgress` and `gridTier.ts`

**File:** `src/lib/components/GridProgress.svelte:15` / `src/lib/util/gridTier.ts:9`

**Issue:** `(wordCount / 21) * 100` in `GridProgress` hardcodes the 5x5 threshold. The canonical value already lives in `TIER_THRESHOLDS["5x5"]` in `gridTier.ts`. If the threshold ever changes, the progress bar calculation will silently diverge.

**Fix:**
```svelte
import { deriveGridTier, wordsNeededToStart, TIER_THRESHOLDS } from "$lib/util/gridTier";
// ...
const fillPct = $derived(Math.min(100, (wordCount / TIER_THRESHOLDS["5x5"]) * 100));
```

---

_Reviewed: 2026-04-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
