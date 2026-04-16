# Domain Pitfalls

**Domain:** Real-time multiplayer browser mini-game (Bullshit Bingo)
**Researched:** 2026-04-16
**Overall confidence:** MEDIUM-HIGH

## Orientation

Bullshit Bingo sits in a narrow sweet spot: casual, anonymous, ephemeral rooms with low message volume but hard real-time requirements (sub-second win announcement). Most "multiplayer game" pitfall advice is written for twitch/shooter games where the latency budget is 16-50ms and anti-cheat is paramount. Less applies here. What DOES apply — and often goes wrong — is session/connection management, simultaneous-win correctness, fairness of board generation, and the unique UX trap of "joining a game during a video call on a phone."

Pitfalls below are ranked by likelihood × severity for this specific project, not a generic MMO.

---

## Critical Pitfalls

Mistakes that cause rewrites, game-ruining bugs, or fundamental correctness issues.

### Pitfall 1: Client-Authoritative Win Detection

**What goes wrong:** The client computes "I won!" and tells the server. Server trusts it and announces the winner.

**Why it happens:** It's the easiest thing to code. The board lives in the client anyway (rendered UI state), so win-checking naturally happens there. Developers tell themselves "it's just a joke game during meetings, who would cheat?"

**Consequences:**
- Any player can open DevTools and emit a fake "bingo" event
- Out-of-order clicks can produce phantom wins if the client's marks desync from the server's record
- Race conditions become unresolvable — the server has no ground truth to arbitrate between simultaneous "I won!" claims
- Once the client is trusted, retrofitting server authority requires reworking the whole protocol

**Prevention:**
- Server stores each player's board layout AND marks list. Client sends `markCell(cellIndex)` events, never `declareWin()`.
- Server recomputes win condition on every mark it records. Server is the ONLY authority on who won.
- Clients receive a `gameEnded({winner, winningLine, finalBoards})` event; they never compute winners themselves.
- Treat the board as two pieces: layout (server-generated, sent once per player) + mark state (server-canonical, streamed).

**Detection:** If you ever write `if (checkWin(myBoard)) socket.emit('win')` on the client, stop. That's the bug.

**Phase:** Phase 1 (core architecture). Must be decided before any game logic exists. Retrofit cost is enormous.

**Confidence:** HIGH (universal consensus: "never trust the client").

---

### Pitfall 2: Simultaneous-Win Race Condition Not Explicitly Designed For

**What goes wrong:** Two players complete their winning line on the SAME buzzword being clicked. Without deterministic tie-breaking, one of three bad things happens:
1. Both see a "you won" screen and the other sees "you lost" — inconsistent UI
2. Neither wins because the server processes them in parallel and each rejects the other
3. The UI flickers/race-conditions while the server tries to decide

**Why it happens:** Developers assume simultaneous completion is a one-in-a-million edge case. For a buzzword bingo game where everyone marks the same word at nearly the same moment, it is **actually common** — the "Bingo Paradox" shows ties are the modal outcome with enough players.

**Consequences:**
- Broken core promise of the game ("first to complete wins")
- Social acrimony in the meeting ("I clicked first!")
- Support complaints with no way to reconstruct what happened
- If not designed in from the start, fixing requires re-architecting the winner-announcement flow

**Prevention:**
- Process all `markCell` events for a single room through a **single serialization point** (one room = one async queue / actor / single-writer). Socket.IO rooms + a per-room event loop work.
- On each mark, after applying it, check for wins across ALL players in deterministic order. First player (in insertion order of mark events in the server's queue) with a complete line wins — full stop.
- Define tie-breaking rules up front:
  - Option A (recommended): strict linear ordering — the first mark event the server processes that creates a win, wins. Ties are impossible by construction.
  - Option B: explicit multi-winner UI — "Tie! Alice, Bob, and Carol all got bingo." Only do this if designers want it.
- Lock the game state once a winner is declared; reject or ignore further marks.
- Clients must display the winner from the server's `gameEnded` event, not their local state.

**Detection:**
- Write an automated test that fires 5 concurrent `markCell` events resolving the same buzzword for 5 players holding winning boards. Verify exactly one winner emerges and all clients agree.
- During playtests, look for "who won?" confusion — if anyone asks, the UX isn't resolving it.

**Phase:** Phase 2 (game loop). Design tie-breaking into the protocol before implementing win detection.

**Confidence:** HIGH (this is a well-documented class of real-time game bugs).

---

### Pitfall 3: No Reconnection / State-Sync Strategy for Dropped Connections

**What goes wrong:** A player's phone locks, Safari kills the WebSocket, or they switch browser tabs. When they come back, the game is either:
- Completely reset (lost all their marks, stuck on "connecting...")
- Silently desynced (their board shows different marks than the server thinks)
- Gone entirely (server garbage-collected the room when their connection closed)

**Why it happens:** Mobile browsers aggressively suspend WebSockets. iOS Safari drops WS when the screen locks or the user switches away. Cellular NAT gateways drop idle TCP mappings in ~30 seconds. Developers test on desktop Chrome with the tab focused and never hit these cases.

**Consequences:**
- Players using a meeting tool on their phone (the primary target use case!) lose their game mid-meeting
- Rejoining feels broken, breaking trust in the product
- The "feels instant" constraint is violated

**Prevention:**
- Build reconnection from Day 1, not as a polish task:
  - Client: auto-reconnect with exponential backoff + jitter (avoid thundering herd on server restart)
  - Client: heartbeat ping every ~25s; if 3 missed, force a reconnect
  - Protocol: client sends `resume({sessionToken, lastSequenceId})` on reconnect; server replays missed events or sends full state snapshot
- Decouple **player identity** from **WebSocket connection**. Use a player token (in localStorage or URL fragment) so a dropped connection doesn't mean a new player.
- Server keeps room state alive for a grace period (e.g. 5-15 min) after all players disconnect, not tied to socket lifecycle.
- On reconnect, the server sends a full state snapshot: `{boardLayout, myMarks, otherPlayers, phase, winner?}`. Don't try to replay deltas for a casual game — snapshots are simpler and the state is tiny.
- Test explicitly on iOS Safari with screen-lock and tab-switch. Test on a throttled 3G connection. Test server restart mid-game.

**Detection:**
- Symptoms in the wild: "I refreshed and lost my board," "my friend can't see my marks anymore"
- Test: open game on iPhone, lock screen for 2 minutes, unlock — does it recover?
- Test: kill the WebSocket in DevTools — does the client reconnect and resync?

**Phase:** Phase 1 for the identity-decoupling (architectural); Phase 2 for the reconnect/resume protocol. Do NOT leave for polish phase.

**Confidence:** HIGH (well-documented issue across Safari, mobile Chrome, Socket.IO, Supabase Realtime).

---

### Pitfall 4: Ephemeral Session Lifecycle is Vague

**What goes wrong:** "Anonymous sessions" sounds simple, but nobody decided:
- When does a room get created? (First visit to `/room/ABCD`? Or only when host clicks "create"?)
- When does a room get destroyed? (When host leaves? When last player leaves? After N minutes of inactivity?)
- What if someone opens a join link for a room that doesn't exist yet, or no longer exists?
- What's a "player identity" — a cookie? A tab? A browser? If I open the same join link in two tabs, am I one player or two?
- Can a player rejoin after leaving? With what identity?

The result: weird UX bugs, "ghost" players in rooms, rooms that never free memory, cold-start confusion.

**Why it happens:** "Anonymous" is under-specified. Teams treat session management as an implementation detail rather than a product decision.

**Consequences:**
- Memory leaks (rooms never garbage-collected)
- Confusing UX (host refreshes and is kicked out of their own room)
- Scaling problems (can't cleanly shard rooms if their lifecycle is fuzzy)
- Abuse vector (bots create unlimited rooms)

**Prevention:** Write a **lifecycle spec** before coding:

| Event | Behavior |
|-------|----------|
| Host creates room | Room exists with 6-char code, expires in N minutes if unused |
| Player joins via code | Assigned a player-token (cookie/localStorage), added to roster |
| Player closes tab | Marked as `disconnected`, NOT removed. Room persists. |
| Player reopens link with same token | Re-attached to their slot, state restored |
| Player opens same link with NEW token | Joins as a new player (subject to room's lobby rules) |
| Host disconnects | Host role persists OR transfers to next-joined player (pick one, document it) |
| Game ends | Room stays alive for N minutes so people can see results, then reaped |
| Room idle (no activity) for N minutes | Reaped |

- Use a TTL (time-to-live) on room keys in Redis/memory. Don't rely on "last player left" events (unreliable with mobile disconnects).
- Player identity = opaque token in localStorage, scoped to the room. Not tied to the socket.
- Human-readable room codes (4-6 chars, avoid 0/O/I/1, avoid words). Collision-check before issuing.
- Rate-limit room creation per IP.

**Detection:**
- Monitor: number of active rooms vs number of rooms reaped over time
- Monitor: memory per room, total server memory
- Playtest: "what if the host leaves?" "what if I refresh?" "what if I open the link tomorrow?"

**Phase:** Phase 1 (architecture). The lifecycle spec is a prerequisite for room/session code.

**Confidence:** HIGH (universal problem in lobby-based games; OpenKruise, Heroic Labs, and GameLift docs all call this out).

---

## Moderate Pitfalls

### Pitfall 5: Board Generation Reveals Other Players' Boards

**What goes wrong:** Developer generates all boards client-side (for performance), sends each player a random seed, and clients compute their boards. A player opens DevTools and reads other players' seeds → can see everyone's boards → can predict who will win.

Or: server sends all players' full board layouts to every client (to render the "other players" list), exposing them.

**Why it happens:** It's natural to ship all data to the client when using reactive frameworks, and board layouts seem harmless.

**Consequences:** Fairness is compromised. Anyone technical can spoil the surprise. Game feels cheap once players know.

**Prevention:**
- Generate boards on the **server** using a cryptographic RNG (`crypto.randomUUID` / `crypto.getRandomValues`), never a seeded PRNG shared with the client.
- Send each player ONLY their own board layout. Send other players' state as `{playerName, marksCount, hasWon}` — NOT the full board.
- On win, the server can broadcast the winner's board for display.

**Phase:** Phase 2 (board generation). Cheap to do right, expensive to retrofit.

**Confidence:** HIGH.

---

### Pitfall 6: Board Generation Fairness (Distribution, Not Just Randomness)

**What goes wrong:** With N submitted words and a 5x5 board (25 cells, some blank), naive random selection can:
- Give one player mostly common/easy words and another mostly obscure ones
- Create boards that are mathematically impossible to win (blanks placed so no line is completable)
- Produce two identical boards (rare but embarrassing)

**Why it happens:** "Random" feels like "fair" but they're not the same. Uniform sampling without replacement from the word pool can still produce skewed distributions per board.

**Consequences:** Players feel the game is rigged. Someone can never win because their board is all hard words.

**Prevention:**
- Decide the model up front: **every board uses the same word pool** (shuffled differently) OR **every board samples from the pool** with documented distribution.
- Require a minimum word count before starting (e.g. `n_cells = min(25, n_submitted_words + desired_blanks)`). Block starting if too few words.
- Place blanks deterministically (e.g. always in the center, or randomly but with a max-count constraint) so every board has the same ratio of words-to-blanks.
- Verify every generated board has at least one winnable line. For typical bingo sizes with normal blank ratios this is trivially satisfied, but assert it.
- Check for duplicate boards at generation time and re-roll.
- Use a cryptographic RNG, not `Math.random()` (fine for this scale, but sets good habits).

**Phase:** Phase 2 (board generation). Add the fairness invariants as unit tests.

**Confidence:** MEDIUM-HIGH (combinatorial fairness is a known issue in bingo-style games — see Nick Arnosti's "Bingo Paradox").

---

### Pitfall 7: No Room-Level Concurrency Model (Scaling Trap)

**What goes wrong:** Single-process Node.js server holds all rooms in memory. Works fine for 10 rooms. At 1000 concurrent rooms, the server is CPU-bound, latency spikes, and restarting the process drops every game in flight.

OR: the team scales to multiple server instances with sticky sessions, and suddenly players in the same room can be connected to different instances — marks from one player never reach others.

**Why it happens:** Scaling WebSockets horizontally is genuinely harder than scaling HTTP. The problem is invisible until you try.

**Consequences:**
- Can't scale beyond one process
- Deploys kick everyone out
- Adding a second server breaks multiplayer

**Prevention:**
- Pick a scaling model early, even if you don't need it yet:
  - **Simple (recommended for MVP):** Single process, sticky sessions on the load balancer by room code, room state in-memory. Graceful-restart strategy documented.
  - **Scaled:** Redis pub/sub backplane. Each instance subscribes to the room channels of rooms it hosts. Room state in Redis (ephemeral keys with TTL). No sticky sessions needed for correctness, only for perf.
- Design rooms as self-contained units: one room's state should be movable between instances.
- Use room code as the shard key if/when sharding.
- For deploys: support draining (new connections go to new instances; old instances finish their games then exit).

**Phase:** Phase 1 for the decision; Phase 4+ for implementation of Redis scaling (only if metrics demand it).

**Confidence:** HIGH (Ably, GoldFire, AWS all describe this trap).

---

### Pitfall 8: Polling-on-Click Instead of True Push

**What goes wrong:** Team uses HTTP polling or Server-Sent Events "because it's simpler than WebSockets" and then discovers that 1-second polling feels laggy, 200ms polling melts the server, and SSE is one-way so you still need HTTP POSTs for mark events.

**Why it happens:** WebSockets feel intimidating. "Just poll every second" seems pragmatic.

**Consequences:** The `<1 second` performance constraint is violated, or infrastructure costs balloon.

**Prevention:**
- Use WebSockets (via Socket.IO, native ws, or framework equivalent) for the real-time path.
- If you must fall back, use SSE for server→client updates and HTTP POST for client→server marks. But WebSockets are right here.
- Avoid WebRTC: peer-to-peer is overkill, adds NAT-traversal complexity, and needs a signalling server anyway.

**Phase:** Phase 1 (architecture). Don't relitigate in later phases.

**Confidence:** HIGH.

---

### Pitfall 9: Duplicate Click Events and Non-Idempotent Marks

**What goes wrong:** Player double-clicks a cell. Client fires two `markCell` events. Server processes both. What happens?
- If mark is a toggle: cell becomes unmarked again. Player thought they won but didn't.
- If mark duplicates across clients: mark count is off, UI inconsistent.

OR: network hiccup causes a retry, server applies mark twice.

**Why it happens:** Developers treat marks as events rather than state transitions.

**Consequences:** Game state feels buggy, trust erodes.

**Prevention:**
- Make `markCell` **idempotent**: `markCell(cellIndex)` sets the cell to marked, regardless of current state. A repeated event is a no-op.
- Do NOT make clicks a toggle unless the product explicitly wants unmarking (decide up front).
- If unmarking IS a feature, use explicit events: `markCell(idx)` and `unmarkCell(idx)`.
- Optionally include a client-generated `eventId` for dedup/logging, but idempotent semantics remove most of the need.
- Even though TCP/WebSocket guarantees ordering per-connection, application code can break it (async handlers). Serialize marks per-room in the handler.

**Phase:** Phase 2 (game loop protocol).

**Confidence:** HIGH.

---

### Pitfall 10: Mobile UX Neglected Until Too Late

**What goes wrong:** Primary use case is "open on my phone during a Zoom call." Team develops on desktop, ships, and discovers:
- Cells too small to tap reliably
- Virtual keyboard covers the board during word submission
- Screen lock kills the connection (see Pitfall 3)
- Landscape vs portrait breaks the layout
- iOS rubber-band scrolling makes the board feel janky

**Why it happens:** "Mobile-friendly" is assumed to mean "the CSS doesn't break." Actual touch UX and mobile browser quirks are different problems.

**Consequences:** The product's stated core use case (meetings from phone) doesn't work. Adoption suffers.

**Prevention:**
- Design mobile-first. Prototype the board on a 375px-wide viewport before desktop.
- Min tap target 44×44px (Apple HIG) or 48×48 (Material). Non-negotiable.
- Test with iOS Safari AND Android Chrome. They differ.
- Test with the screen locked, tab backgrounded, and on cellular (not just Wi-Fi).
- Use `visibilitychange` events to proactively reconnect when tab becomes visible.
- Lock orientation or design for both; pick one and commit.
- Disable pull-to-refresh on the game screen (`overscroll-behavior: contain`).

**Phase:** Phase 3 (UX polish), but the decision to mobile-first is Phase 1.

**Confidence:** HIGH.

---

## Minor Pitfalls

### Pitfall 11: Confusing Room Codes

**What goes wrong:** Codes like `O0Il1` are unreadable. Profanity slips into random codes (`FUCK`, `SHIT` — especially awkward for a product called *Bullshit* Bingo in corporate meetings).

**Prevention:**
- Character set: avoid `0O 1lI`. Use `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- 4-6 chars balances brevity and collision-avoidance for expected concurrent-room counts.
- Filter codes against a banned-word list before issuing.
- Consider word-based codes (`purple-cat-42`) if feeling fancy.

**Phase:** Phase 1.

---

### Pitfall 12: No Rate Limiting on Room Creation / Joins

**What goes wrong:** Someone scripts 10,000 room creations, exhausts server memory. Or brute-forces room codes to raid others' games.

**Prevention:**
- Rate limit room creation per IP (e.g., 10/min).
- Room codes large enough that brute-force is impractical (32^5 ≈ 33M combinations).
- Rate limit join attempts per IP.
- Don't leak "room exists but full" vs "room doesn't exist" — both return "join failed."

**Phase:** Phase 3.

---

### Pitfall 13: Profanity / Moderation in Player-Submitted Words

**What goes wrong:** Someone submits slurs or abusive content as buzzwords. Other players see them on their boards and in the chat/word list. HR nightmare during a corporate meeting.

**Prevention:**
- Basic profanity filter on word submission (simple word list sufficient for MVP).
- Host can remove words before game start.
- Max word length + max submissions per player to limit damage.
- Log word submissions with player token for moderation after the fact.

**Phase:** Phase 3 (polish, but don't skip).

---

### Pitfall 14: Visibility API Ignored

**What goes wrong:** Player switches to another tab during the meeting. When they switch back, the app shows a stale board because WebSocket reconnect hasn't fired yet, or the tab's throttled timers made the UI freeze.

**Prevention:**
- Subscribe to `document.visibilitychange`. On `visible`, force a state resync (send `resume()` over the socket).
- Don't rely on timers in background tabs (browsers throttle them to 1Hz or less).
- Request a fresh snapshot on visibility change, not deltas.

**Phase:** Phase 2 (reconnect logic).

---

### Pitfall 15: No Observability for a Real-Time System

**What goes wrong:** Something feels broken in prod. No way to reconstruct what happened: "which player clicked first?" "why did the room disappear?" "how many active rooms?"

**Prevention:**
- Structured event logs: every `markCell`, `join`, `leave`, `win` logged with `roomId`, `playerToken`, `timestamp`, `sequenceId`.
- Metrics: active rooms, active connections, marks/sec, reconnect count, avg game duration, win-latency (mark → gameEnded broadcast).
- Health endpoint distinct from the WS endpoint.
- Keep logs cheap; don't persist per-mark forever, but keep the last hour or so for debugging.

**Phase:** Phase 2 (built-in from the start).

---

## Phase-Specific Warnings

Mapping pitfalls to typical phase names for the roadmap generator. Adjust to actual phase names.

| Phase Topic | Likely Pitfalls | Mitigation Focus |
|-------------|-----------------|------------------|
| Phase 1 — Architecture / Foundation | #1 (server authority), #3 (identity decoupling), #4 (lifecycle spec), #7 (scaling model), #8 (transport choice), #11 (room code design) | Decide authoritative server, player-token identity, lifecycle rules, transport, and scaling model BEFORE any game code. |
| Phase 2 — Core Game Loop | #2 (simultaneous wins), #3 (reconnect/resume protocol), #5 (private boards), #6 (board fairness), #9 (idempotent marks), #14 (visibility API), #15 (observability) | Serialize per-room state transitions. Snapshot-based resume. Server-generated private boards. Idempotent events. |
| Phase 3 — UX / Polish | #10 (mobile UX), #12 (rate limiting), #13 (profanity filter) | Mobile-first testing on real devices. Basic abuse protection. |
| Phase 4+ — Scale (if needed) | #7 (Redis pub/sub backplane) | Only tackle if metrics justify; add after product-market fit. |

---

## Open Questions for Roadmap / Design

These aren't pitfalls yet, but unresolved answers become pitfalls:

1. **Host role transfer:** If the host leaves, does the game end, pause, or transfer host? Pick one.
2. **Multi-winner UX:** If ties are possible (even if rare), what does the UI show? Design this even if you choose strict serialization.
3. **Mid-game joins:** Can someone join after the host starts? If yes, do they get a board or just spectate? (v1 says no spectators, so probably no.)
4. **Word editing mid-lobby:** Can a player edit/remove their submissions before the game starts? Can the host?
5. **Game end display duration:** How long does the "bingo!" screen stay up before room auto-closes? This dictates room TTL.

---

## Sources

- [Stop Using WebSockets for Everything (2026)](https://medium.com/@ppp.mishra124/stop-using-websockets-for-everything-and-other-real-time-mistakes-youre-probably-making-2290394badde) — MEDIUM confidence
- [WebSocket Reconnection: State Sync and Recovery Guide](https://websocket.org/guides/reconnection/) — HIGH confidence (authoritative)
- [Socket.IO Delivery Guarantees](https://socket.io/docs/v4/delivery-guarantees) — HIGH confidence (official docs)
- [Socket.IO Troubleshooting Connection Issues](https://socket.io/docs/v4/troubleshooting-connection-issues/) — HIGH confidence (official docs)
- [Never Trust the Client — GameDeveloper](https://www.gamedeveloper.com/business/never-trust-the-client-simple-techniques-against-cheating-in-multiplayer-and-spatialos) — HIGH confidence
- [Client-Side Prediction and Server Reconciliation — Gabriel Gambetta](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html) — HIGH confidence (canonical reference)
- [Challenges of Scaling WebSockets — Ably](https://dev.to/ably/challenges-of-scaling-websockets-3493) — HIGH confidence
- [Horizontally Scaling Node.js and WebSockets with Redis — GoldFire Studios](https://goldfirestudios.com/horizontally-scaling-node-js-and-websockets-with-redis) — HIGH confidence
- [WebSockets at Scale — WebSocket.org](https://websocket.org/guides/websockets-at-scale/) — HIGH confidence
- [Best Practice for Session-Based Games (PvP room) — OpenKruise](https://openkruise.io/kruisegame/best-practices/session-based-game) — MEDIUM confidence
- [iOS Safari drops WebSocket on screen lock — GitHub discussion](https://github.com/enisdenjo/graphql-ws/discussions/290) — HIGH confidence (reproducible bug reports)
- [Realtime WebSocket loses connection in background tab — Supabase](https://github.com/supabase/realtime-js/issues/121) — HIGH confidence
- [Bingo Tie Rules Explained — Slingo](https://www.slingo.com/blog/bingo/bingo-win-tie-rules/) — MEDIUM confidence (domain context)
- [Multiple Winners In Bingo — BingoTalks](https://bingotalks.co.uk/blog/multiple-winners-in-bingo/) — MEDIUM confidence
- [The Bingo Paradox — Nick Arnosti](https://nickarnosti.com/blog/bingo/) — HIGH confidence (mathematical analysis of ties)
- [Handling Race Conditions in Real-Time Apps — dev.to](https://dev.to/mattlewandowski93/handling-race-conditions-in-real-time-apps-49c8) — MEDIUM confidence
- [Idempotency and Ordering in Event-Driven Systems — CockroachDB](https://www.cockroachlabs.com/blog/idempotency-and-ordering-in-event-driven-systems/) — HIGH confidence
- [WebSockets Guarantee Order — Sitong Peng](https://www.sitongpeng.com/writing/websockets-guarantee-order-so-why-are-my-messages-scrambled) — MEDIUM confidence
- [How Are Bingo Cards Randomized? — Bingo Card Creator](https://www.bingocardcreator.com/support/how-are-cards-randomized/) — LOW confidence (useful domain context)
- [The Random Number Generator & Online Bingo — Wink Bingo](https://www.winkbingo.com/blog/the-random-number-generator-and-online-bingo-games) — LOW confidence (marketing content, but reflects industry norm)
- [Fix WebSocket Timeout and Silent Dropped Connections — WebSocket.org](https://websocket.org/guides/troubleshooting/timeout/) — HIGH confidence

---

## Confidence Summary

| Pitfall Category | Confidence | Why |
|------------------|------------|-----|
| Server authority / win detection | HIGH | Industry consensus, multiple authoritative sources |
| Simultaneous-win race conditions | HIGH | Mathematical (Bingo Paradox) + engineering consensus |
| Reconnection / state sync | HIGH | Well-documented across Safari, Socket.IO, Supabase |
| Session lifecycle | HIGH | Documented in game-platform best practices |
| Board fairness | MEDIUM-HIGH | Domain-specific; sources less rigorous but principles sound |
| Scaling model | HIGH | Ably, AWS, GoldFire all describe the same patterns |
| Mobile UX | HIGH | Well-known browser behavior, reproducible |
| Minor pitfalls (codes, rate limits, profanity) | MEDIUM | General best-practice advice |
