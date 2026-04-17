---
phase: 03-board-generation-core-mark-loop
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - e2e/board-mark.spec.ts
  - party/game-room.ts
  - src/lib/components/Board.svelte
  - src/lib/components/BoardCell.svelte
  - src/lib/components/PlayerRow.svelte
  - src/lib/protocol/messages.ts
  - src/lib/stores/room.svelte.ts
  - src/lib/util/shuffle.ts
  - src/routes/room/[code]/+page.svelte
  - tests/unit/Board.test.ts
  - tests/unit/BoardCell.test.ts
  - tests/unit/game-room.test.ts
  - tests/unit/PlayerRow.test.ts
  - tests/unit/protocol.test.ts
  - tests/unit/room-store.test.ts
  - tests/unit/shuffle.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 3 (board generation + mark loop) is well-structured. The server authorization model is correct — cellId ownership is verified before any toggle, the broadcast payload is intentionally minimal, and the per-player board isolation is sound. No critical security issues.

Three warnings: an optimistic-vs-server divergence on mark toggle that can corrupt displayed mark counts, a missing JSON parse guard in the room store's message handler, and an off-by-one possibility in `randomIntBelow` when `n = 1`. Three info items follow.

---

## Warnings

### WR-01: Optimistic toggle can permanently desync `markedCellIds` from server state

**File:** `src/lib/stores/room.svelte.ts:141-147`

**Issue:** `toggleMark` flips `markedCellIds` locally before the server confirms. The server is the source of truth for the toggle (it holds `#marks`). If the WebSocket send fails silently, or the server drops the message (phase guard, pre-hello guard, non-owner cell), the client's `markedCellIds` stays flipped while the server's mark count stays unchanged. The `wordMarked` broadcast that other players see will not match the optimistic state shown to the acting player. There is no reconciliation path — the player's own badge count diverges from their board highlight state indefinitely.

This is distinct from "normal" optimistic UI patterns because the toggle is non-idempotent from the client's perspective (clicking again re-flips locally and re-sends, causing further desync).

**Fix:** Either (a) revert the optimistic flip on the next `wordMarked` received for `myPlayerId` by resetting `markedCellIds` from the authoritative `markCount` (requires tracking which cellId corresponds to which mark), or (b) send `markWord` first and only flip `markedCellIds` when the echoed `wordMarked` arrives for the local player. Option (b) is simpler:

```typescript
// room.svelte.ts — non-optimistic version
toggleMark(cellId: string) {
  ws.send(JSON.stringify({ type: "markWord", cellId }));
  // No local flip — wait for wordMarked echo
},
```

Then in the `wordMarked` case, maintain a local `myMarkedCellIds` Set that flips the specific cell. The server already sends `markCount`, so `PlayerRow` badges stay authoritative. The board highlight is the only thing that needs reconciliation; flip the specific cellId on echo from your own `playerId`:

```typescript
case "wordMarked":
  playerMarks = { ...playerMarks, [msg.playerId]: msg.markCount };
  if (msg.playerId === player.playerId) {
    // server confirmed; rebuild markedCellIds from last known state + this toggle
    // (requires tracking pending cellId — store it before send)
  }
  break;
```

Alternatively, keep the optimistic flip but add a reconcile step that resets `markedCellIds` when a `boardAssigned` arrives (already done) and also reconcile on reconnect.

---

### WR-02: JSON.parse in room store message handler can throw and crash the listener

**File:** `src/lib/stores/room.svelte.ts:63`

**Issue:** `JSON.parse((ev as MessageEvent).data)` is called without a try/catch. If the server ever sends malformed JSON (network corruption, partial frame), this throws an uncaught exception inside the `addEventListener` callback. In PartySocket, an uncaught error in a message listener can silence future messages from that socket depending on the runtime.

```typescript
ws.addEventListener("message", (ev) => {
  const parsed = v.safeParse(ServerMessage, JSON.parse((ev as MessageEvent).data));
  // ^^^ JSON.parse can throw
```

**Fix:**
```typescript
ws.addEventListener("message", (ev) => {
  let raw: unknown;
  try {
    raw = JSON.parse((ev as MessageEvent).data);
  } catch {
    return; // discard malformed frame
  }
  const parsed = v.safeParse(ServerMessage, raw);
  if (!parsed.success) return;
  const msg = parsed.output;
  // ...
});
```

---

### WR-03: `randomIntBelow(1)` produces a biased result — always returns 0, but the rejection-sampling loop is unreachable and the `max` computation is wrong for `n=1`

**File:** `src/lib/util/shuffle.ts:15`

**Issue:** When `n = 1` (a single-element array is shuffled), `randomIntBelow(1)` is called. The max calculation is:

```
Math.floor(0xffffffff / 1) * 1 = 0xffffffff = 4294967295
```

`crypto.getRandomValues` fills a `Uint32` in `[0, 4294967295]`. The condition `x >= max` is `x >= 4294967295`, which is true only when `x === 4294967295` (the maximum uint32 value). This is not a bias issue in practice (1-in-4B chance of a retry, result is always `x % 1 = 0`), but the loop does run and issues an unnecessary `getRandomValues` call for every single-element shuffle, consuming entropy unnecessarily.

More importantly, the Fisher–Yates loop in `shuffle` starts at `i = arr.length - 1` and the inner condition is `i > 0`, so for a single-element array the loop body never executes — `randomIntBelow` is never actually called for `n=1`. This means the `n=1` path is dead code rather than a runtime error, but it is still worth fixing for clarity.

The real concern is `n=2`: `max = Math.floor(0xffffffff / 2) * 2 = 4294967294`. Values `4294967294` and `4294967295` — only `4294967295` is rejected. This is correct but may be unintuitive. The algorithm is sound for all practical inputs.

**Fix:** Add an early return for the trivial case to avoid unnecessary entropy consumption and clarify intent:

```typescript
function randomIntBelow(n: number): number {
  if (n <= 0) throw new Error("n must be > 0");
  if (n === 1) return 0; // trivial case
  const buf = new Uint32Array(1);
  const max = Math.floor(0xffffffff / n) * n;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= max);
  return x % n;
}
```

---

## Info

### IN-01: `#buildBoardForPlayer` — `blankCount` can never be negative but `Math.max(0, ...)` implies it might

**File:** `party/game-room.ts:326`

**Issue:** `cellCount` is computed from the tier (9, 16, or 25) and `wordPool` always has at least 5 entries (guarded by the `words.size < 5` check). `shuffled.slice(0, cellCount)` returns at most `cellCount` elements (exactly `cellCount` when `wordPool.length >= cellCount`). The `Math.max(0, cellCount - wordCells.length)` guard is defensive but creates a false impression that `wordCells` could exceed `cellCount`. It cannot. The code is correct; the guard is misleading.

**Fix:** Remove the `Math.max` guard and add a comment explaining the invariant:

```typescript
// wordPool.length >= 5 is enforced before startGame; slice never exceeds cellCount
const blankCount = cellCount - wordCells.length;
```

---

### IN-02: `+page.svelte` reads `sessionStorage` inside a `$derived` — re-reads on every derivation

**File:** `src/routes/room/[code]/+page.svelte:72-76`

**Issue:** `myPlayerId` is a `$derived.by` that calls `sessionStorage.getItem` on every reactive evaluation. Svelte 5 derived values re-run whenever any reactive dependency changes. Since `sessionStorage` is not reactive, this will re-run unnecessarily on every state update — once per message received. The value is stable for the lifetime of the component.

**Fix:** Hoist the read into a plain `let` assigned once in the script:

```typescript
const myPlayerId = typeof window !== "undefined"
  ? (() => {
      const raw = sessionStorage.getItem(`bsbingo_player_${data.code}`);
      return raw ? (JSON.parse(raw).playerId as string) : "";
    })()
  : "";
```

Or assign it in `onMount` where `window` is guaranteed:

```typescript
let myPlayerId = $state("");
onMount(() => {
  const raw = sessionStorage.getItem(`bsbingo_player_${data.code}`);
  myPlayerId = raw ? JSON.parse(raw).playerId : "";
  store = createRoomStore(data.code);
  // ...
});
```

---

### IN-03: E2E test "two players see a board" only seeds 5 words — board layout is always 3x3

**File:** `e2e/board-mark.spec.ts:37`

**Issue:** All three multiplayer E2E tests seed exactly 5 words (`["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]`), which hits the 3x3 tier exclusively. The 4x4 and 5x5 board tiers (16 and 25 cells) have no E2E coverage. If `deriveGridTier` or `#buildBoardForPlayer` regresses for larger word pools, no E2E test would catch it.

**Fix (future test):** Add an E2E scenario that seeds 16+ words and asserts `grid-cols-4` or `grid-cols-5` is present in the board grid class. No change needed in the current test — this is a coverage gap to address in a follow-up.

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
