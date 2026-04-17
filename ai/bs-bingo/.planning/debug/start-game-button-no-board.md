---
status: resolved
slug: start-game-button-no-board
trigger: "Start game button does nothing — no board appears after clicking it"
created: 2026-04-17T21:30:00Z
updated: 2026-04-17T22:00:00Z
---

## Symptoms

- expected: Clicking "Start Game" triggers game start; server sends boardAssigned per-connection; board renders on page
- actual: Button click has no visible effect; no board appears; page stays on lobby view
- errors: unknown — user has not reported console errors
- timeline: Immediately after Phase 3 implementation (board generation, markWord handler, client store, Board.svelte wiring)
- reproduction: Enter lobby with 5+ words submitted, click Start Game button (after time has passed — long enough for the DO to hibernate)

## Current Focus

hypothesis: DO hibernation wipes in-memory state between messages; `#hostId` becomes null, so the host-guard silently drops the `startGame` message
test: regression unit test driving onStart() with pre-hibernation storage values, then sending startGame from a reconnected host
expecting: startGame broadcasts gameStarted and delivers boardAssigned to the host (not silently dropped)
next_action: none — resolved

## Evidence

- timestamp: 2026-04-17T21:40:00Z
  source: party/game-room.ts:34
  observation: `static options = { hibernate: true }` — hibernation is enabled
- timestamp: 2026-04-17T21:40:00Z
  source: party/game-room.ts:37-47
  observation: Room state is held in class-private fields (`#hostId`, `#players`, `#words`, `#usedPacks`, `#boards`, `#marks`) — these live in the JS instance only, not in durable storage
- timestamp: 2026-04-17T21:40:00Z
  source: party/game-room.ts:49-54 (onStart, pre-fix)
  observation: `onStart()` restores only `#active` from storage; does not restore `#hostId`, `#players`, `#words`, or any other room state. On wake from hibernation, all of these reset to their class-initial values (`null`, empty Maps/Sets)
- timestamp: 2026-04-17T21:40:00Z
  source: party/game-room.ts:183-185 (startGame, pre-fix)
  observation: startGame handler: `if (connState?.playerId !== this.#hostId) return;` — after hibernation, `#hostId` is `null` while the connection still has a valid `playerId` (conn.state IS persisted by the hibernation API). Comparison is truthy → handler returns silently → no broadcast, no boardAssigned, no user-visible feedback
- timestamp: 2026-04-17T21:40:00Z
  source: PartyServer README (node_modules/partyserver/README.md:106,155-157)
  observation: "onStart() … called … after waking up from hibernation. You can use this to load data from storage" — confirms in-memory class state is lost on hibernation and must be rehydrated in onStart
- timestamp: 2026-04-17T21:40:00Z
  source: tests/unit/game-room.test.ts (all startGame tests)
  observation: Unit tests exercise a single in-memory instance and never hibernate — they pass. E2E tests run the full flow within a few seconds, below the hibernation threshold, so they also pass. Manual wrangler dev testing includes enough idle time (typing words, reading UI) for the DO to hibernate → only the manual path hits the bug.
- timestamp: 2026-04-17T22:00:00Z
  source: tests/unit/game-room.test.ts (new regression test)
  observation: New test "rehydrates hostId/players/words/phase from storage on wake (startGame survives hibernation)" drives onStart() with pre-hibernation storage values, then sends startGame from a reconnected host. After fix: broadcast fires with `gameStarted` and host receives `boardAssigned`. 200/200 unit tests pass. `pnpm build` succeeds.

## Eliminated

- Client-side state not updating (room store `case "gameStarted"` / `case "boardAssigned"` reassign state correctly; runes are wired via getters)
- Button wiring (`Button.svelte` forwards `onclick`; `startGame()` calls `store?.send({ type: "startGame" })`)
- Schema / protocol mismatch (`startGame` ClientMessage and `gameStarted`/`boardAssigned` ServerMessage schemas match)
- DO binding / routing (Phase 2 lobby continues to work end-to-end; WS messages reach the server)
- Build staleness (`wrangler dev` hot-rebuilds on file changes)

## Resolution

root_cause: The GameRoom Durable Object has `hibernate: true` but does not persist or rehydrate its in-memory room state (`#hostId`, `#players`, `#words`, `#usedPacks`, `#boards`, `#marks`). When the DO hibernates between messages (hibernation happens on message inactivity, independent of the 30-minute TTL alarm), waking up for `startGame` finds `#hostId === null`. The host-only guard `connState?.playerId !== this.#hostId` then silently drops the message. No `gameStarted` broadcast, no `boardAssigned` send, so the client never flips to the playing phase and the board never renders.

fix: Applied persist-and-rehydrate (path 1).
  - `party/game-room.ts`:
    - Extracted storage keys to named constants (K_ACTIVE, K_HOST_ID, K_PLAYERS, K_WORDS, K_PHASE, K_USED_PACKS, K_BOARDS, K_MARKS).
    - Added per-field `#persist*()` helpers (fire-and-forget writes).
    - `onStart()` now reads all eight keys in parallel with `Promise.all` and rehydrates the in-memory fields.
    - Every mutation site (`hello`, `submitWord`, `removeWord`, `loadStarterPack`, `startGame`, `markWord`, `onClose`) now calls the matching `#persist*()` helper immediately after mutating the field.
    - Maps/Sets are serialized as arrays / `[key, value[]]` tuples so `storage.put` can JSON-encode them.
  - `tests/unit/game-room.test.ts`:
    - Extended the `FakeServer` mock's storage type to include `get` and `put`.
    - Added regression test "rehydrates hostId/players/words/phase from storage on wake (startGame survives hibernation)" under the Phase 3 describe block.
  - Verification: `pnpm test:unit` → 200/200 passing (was 199 before adding the regression). `pnpm build` → clean.

specialist_hint: typescript
