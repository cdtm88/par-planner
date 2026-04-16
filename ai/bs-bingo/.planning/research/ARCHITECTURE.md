# Architecture Patterns

**Domain:** Real-time multiplayer browser mini-game (Bullshit Bingo)
**Researched:** 2026-04-16
**Confidence:** HIGH (patterns well-established; room-based real-time architecture is the dominant paradigm, verified via Context7 Colyseus docs + Cloudflare PartyKit docs + multiple ecosystem sources)

---

## Recommended Architecture: Room-Authoritative, Single-Process-Per-Room

Bullshit Bingo is a **low-tick, low-actor, ephemeral-room** game. Games last minutes, hold 2-30 players, have no persistence requirements beyond the game's lifetime, and update only on discrete user clicks (not continuous simulation). This profile perfectly fits the **stateful-room, server-authoritative** pattern used by Colyseus, PartyKit/Durable Objects, and nearly every browser party game built in the last decade.

### High-Level Diagram

```
                        ┌─────────────────────────────────┐
                        │        BROWSER (Client)         │
                        │  ┌───────────────────────────┐  │
                        │  │  UI Layer (React)         │  │
                        │  │  - Lobby / Join screen    │  │
                        │  │  - Word submission form   │  │
                        │  │  - Bingo board grid       │  │
                        │  │  - Winner announcement    │  │
                        │  └─────────────┬─────────────┘  │
                        │  ┌─────────────▼─────────────┐  │
                        │  │  Client Store (Zustand)   │  │
                        │  │  - Mirror of server state │  │
                        │  │  - Local optimistic marks │  │
                        │  └─────────────┬─────────────┘  │
                        │  ┌─────────────▼─────────────┐  │
                        │  │  Transport (WebSocket)    │  │
                        │  │  - Auto-reconnect         │  │
                        │  │  - Message dispatch       │  │
                        │  └─────────────┬─────────────┘  │
                        └────────────────┼────────────────┘
                                         │ WebSocket (wss://)
                                         │
                ┌────────────────────────▼────────────────────────┐
                │              EDGE / GATEWAY                     │
                │  Routes by roomId → same server instance every  │
                │  time (sticky session / Durable Object routing) │
                └────────────────────────┬────────────────────────┘
                                         │
                ┌────────────────────────▼────────────────────────┐
                │            ROOM INSTANCE (stateful)             │
                │  ┌────────────────────────────────────────────┐ │
                │  │  Room State (authoritative)                │ │
                │  │  - phase: lobby | submit | play | ended    │ │
                │  │  - players: Map<playerId, Player>          │ │
                │  │  - words: string[]                         │ │
                │  │  - boards: Map<playerId, Board>            │ │
                │  │  - marks:  Map<playerId, Set<cellId>>      │ │
                │  │  - winnerId, winningLine                   │ │
                │  └────────────────────────────────────────────┘ │
                │  ┌────────────────────────────────────────────┐ │
                │  │  Message Handlers                          │ │
                │  │  submitWord / startGame / markCell / etc.  │ │
                │  └────────────────────────────────────────────┘ │
                │  ┌────────────────────────────────────────────┐ │
                │  │  State Broadcaster (delta or full)         │ │
                │  └────────────────────────────────────────────┘ │
                └─────────────────────────────────────────────────┘
                         (In-memory; no DB required for MVP)
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Where It Runs |
|-----------|---------------|-------------------|---------------|
| **UI Layer** | Render lobby, board, submissions, winner. Dispatch user actions. | Client Store | Browser |
| **Client Store** | Hold mirror of authoritative room state. Apply optimistic updates. Expose hooks to UI. | UI Layer, Transport | Browser |
| **Transport** | Maintain WebSocket connection. Auto-reconnect. Serialize messages. | Client Store, Room Instance | Browser |
| **Edge / Gateway** | Route `roomId` → same room instance every time. TLS termination. | Transport, Room Instance | Edge / load balancer |
| **Room Instance** | Own authoritative game state. Validate all actions. Detect wins. Broadcast state changes. | Transport (N clients) | Single server process (or Durable Object) |
| **Room Registry** | Map `roomCode → roomId`. Handle room creation / collision on join. | Room Instance, HTTP endpoint | Same server (or separate lightweight service) |

**Key rule: each room is owned by exactly one process at any time.** Multiple clients in the same room always connect to the same room instance. This is the "sticky session" or "Durable Object routing" guarantee — without it, you need a shared cache (Redis pub/sub) to synchronize, which is over-engineering for a game that never needs horizontal sharding within a single room.

---

## Data Flow: How a Click Propagates to All Players

The canonical flow when Player A clicks a cell:

```
  Player A's browser                Room Instance                Player B, C, D...

  [click cell "synergy"]
         │
         ▼
  Client Store:
    optimisticMarks.add(cellId)  ← UI feels instant (<16ms)
         │
         ▼
  Transport.send({
    type: "markCell",
    cellId: "r2c3"
  })
         │
         └─── WebSocket ─────▶ onMessage("markCell")
                                     │
                                     ▼
                               Validate:
                                 - is phase === "play"?
                                 - does client own this board?
                                 - is cell unmarked?
                                 - is word actually at r2c3?
                                     │
                                     ▼
                               Apply: marks[playerA].add("r2c3")
                                     │
                                     ▼
                               checkWin(playerA.board, marks[playerA])
                                 → winningLine or null
                                     │
                                     ▼
                               Broadcast state delta:
                                 {type: "cellMarked", playerId: A, cellId}
                                 (+ {type: "gameWon", ...} if win)
                                     │
                                     ├───────────────┬───────────────┐
                                     ▼               ▼               ▼
                              [Player A]       [Player B]       [Player C]
                              confirm mark     apply mark       apply mark
                              (drop opt flag)  (update UI)      (update UI)
```

**Latency budget** to meet the ~1 second requirement:
- Click → send: ~5ms
- Client → edge RTT: ~20-80ms
- Server validate + checkWin: ~1ms (5x5 grid, trivial)
- Broadcast → other clients: ~20-80ms
- UI render on peer: ~16ms
- **Total P95: ~100-200ms** — well inside the 1s requirement.

### Optimistic UI Rule

**Only for the acting player.** Player A's own mark appears instantly; peers wait for server confirmation. This is safe because:
- The server is authoritative (no "rolled back mark" ambiguity for peers)
- Conflicts are impossible (each player owns their own board)
- If the server rejects, only Player A sees a brief flicker (roll back)

For the "first to win" race, **do not optimistically announce a win locally**. Always wait for the server's `gameWon` event — the server is the only entity that can arbitrate simultaneous wins.

---

## Game State Machine

The room transitions through four phases. All transitions are server-driven.

```
                        ┌─────────────────┐
              create    │     LOBBY       │
        ─────────────▶  │  - players join │
                        │  - host visible │
                        └────────┬────────┘
                                 │  host clicks "Open word submission"
                                 ▼
                        ┌─────────────────┐
                        │   SUBMITTING    │
                        │  - players add  │
                        │    words        │◀──── late joiner
                        │  - host sees    │      (allowed)
                        │    count grow   │
                        └────────┬────────┘
                                 │  host clicks "Start game"
                                 │  (validates: enough words for grid size?)
                                 ▼
                        ┌─────────────────┐
                        │    PLAYING      │
                        │  - boards dealt │
                        │  - marks flow   │  late joiner
                        │  - win watcher  │  (rejected OR becomes spectator)
                        │    active       │
                        └────────┬────────┘
                                 │  any player completes a line
                                 ▼
                        ┌─────────────────┐
                        │     ENDED       │
                        │  - winner       │
                        │    announced    │
                        │  - "play again" │─── host clicks "New game"
                        │    option       │         │
                        └─────────────────┘         │
                                 ▲                  │
                                 └──────────────────┘
                                  (new room OR reset same room to LOBBY)
```

### Phase Rules (enforced server-side)

| Phase | Allowed Actions | Rejected Actions |
|-------|----------------|------------------|
| LOBBY | join, leave, setName, rename | submitWord, markCell, startGame (until host present) |
| SUBMITTING | join, leave, submitWord, removeOwnWord, openSubmission→startGame (host only) | markCell |
| PLAYING | markCell, unmarkCell, leave | submitWord, startGame, join (reject OR flag as spectator) |
| ENDED | leave, requestNewGame (host only) | markCell, submitWord |

**Host handling:** First player to connect is the host. If host leaves during LOBBY or SUBMITTING, transfer host to next-longest-connected player. Store `hostId` in room state.

**Reconnection:** When a client drops during PLAYING, hold their slot for 30-60 seconds (Colyseus `allowReconnection`, or a timer in PartyKit). Their marks and board persist until the timer fires. This prevents rage-quit on a brief Wi-Fi blip.

---

## Session / Room Management

### Join Code Generation

Use **nanoid with a custom alphabet** — short, URL-friendly, unambiguous, crypto-secure.

```ts
import { customAlphabet } from "nanoid";
// Exclude visually ambiguous chars: 0/O, 1/I/L
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeCode = customAlphabet(alphabet, 6); // e.g. "K7QXM9"
```

6 characters × 31-char alphabet = ~887M combinations. At 1,000 concurrent games, collision probability over a year is astronomically low — but still **check-and-retry** on insert to be safe (3-line while loop).

### Room Lifecycle

1. **Create:** `POST /rooms` → server allocates fresh `roomId`, generates `joinCode`, registers `joinCode → roomId` in registry, responds with both.
2. **Join by code:** `GET /rooms/by-code/:joinCode` → resolve to `roomId` → client opens WebSocket to `/ws/:roomId`.
3. **Join by link:** URL contains the `joinCode` (e.g. `https://app/?code=K7QXM9`) → client auto-resolves.
4. **Dispose:** Room auto-disposes when empty for N seconds (Colyseus default 60s). Registry entry evicted on dispose.

### Player Identity (Anonymous)

- Server generates a `playerId` (UUID) on first connect.
- Client stores it in `sessionStorage` keyed by `roomId` (not `localStorage` — ephemeral).
- On reconnect, client presents the `playerId` to resume their slot.
- Display name is user-provided, mutable, non-unique.

**Do not use cookies.** `sessionStorage` per tab keeps things simple and avoids multi-tab collisions (one person can play from two devices intentionally).

### Board Generation (Fair Distribution)

Run on server at the `SUBMITTING → PLAYING` transition:

```
For each player:
  1. Fisher-Yates shuffle the submitted word pool.
  2. Take first (gridSize² - blankCount) words.
     (Allow repeats if pool < needed; warn host.)
  3. Insert blanks at random positions.
  4. Shuffle the final cell array.
  5. Store as Board{cells: Cell[gridSize²]}.
```

**Grid size logic:**

| Words Submitted | Grid Size | Blanks |
|-----------------|-----------|--------|
| 5-11 | 3×3 | 4 blanks, scale down |
| 12-20 | 4×4 | 3-4 blanks |
| 21+ | 5×5 | 4 blanks (center usually) |

Server picks grid size automatically; host can override.

**Fairness guarantee:** Every player's board draws from the same pool with independent shuffles. No player sees a "better" set of words than another — just different arrangements. Because blanks count as marked, luck lies in position, not content.

### Win Detection

Precompute winning lines at board creation:
```
Line[] = [
  ...rows, ...cols,
  mainDiagonal, antiDiagonal
]  // 2*gridSize + 2 lines total
```

On every `markCell`, iterate lines containing the marked cell (at most 4). For each line, check `all cells in line are marked OR blank`. O(gridSize) per click. Trivial.

**Simultaneous wins:** If two players' marks arrive in the same tick, the server processes them sequentially — whoever's message is dequeued first wins. Document this. No ties in single-server model.

---

## Patterns to Follow

### Pattern 1: Authoritative Server, Dumb Client
**What:** Server holds the truth; client renders what the server says.
**When:** Always for this project. Every `markCell` is validated server-side.
**Why:** Zero cheating, zero divergence, zero "my board shows X but my friend sees Y" bugs. A 5×5 grid with ~20 players generates so little state (a few KB) that the cost of server-side validation is negligible.

### Pattern 2: Event Messages In, State Snapshots/Deltas Out
**What:** Clients send typed action messages (`{type: "markCell", cellId}`). Server broadcasts state changes (either full snapshots or deltas).
**When:** Always.
**Why:** Actions are small and discrete (easy to validate). State is what the UI needs to render. Don't confuse the two.

```ts
// Client → Server (actions)
type ClientMessage =
  | {type: "submitWord", word: string}
  | {type: "removeWord", wordId: string}
  | {type: "startGame"}                       // host only
  | {type: "markCell", cellId: string}
  | {type: "unmarkCell", cellId: string}
  | {type: "setName", name: string};

// Server → Client (state changes)
type ServerMessage =
  | {type: "roomState", state: RoomState}     // full snapshot (on join)
  | {type: "playerJoined", player: Player}
  | {type: "playerLeft", playerId: string}
  | {type: "wordSubmitted", word: Word}
  | {type: "phaseChanged", phase: Phase, payload?: any}
  | {type: "cellMarked", playerId: string, cellId: string}
  | {type: "gameWon", playerId: string, line: string[]}
  | {type: "error", code: string, message: string};
```

### Pattern 3: In-Memory State, No Database (for MVP)
**What:** Room state lives in the room instance's memory. Lost on dispose.
**When:** Games are ephemeral (minutes-long, no "resume tomorrow" feature).
**Why:** A database adds deployment complexity, latency, and operational burden for zero MVP benefit. If persistence is needed later (game history, stats), add it then.

### Pattern 4: Single WebSocket Per Tab
**What:** One persistent connection per browser tab, multiplexed if ever needed.
**When:** Always.
**Why:** Simpler state management, fewer connections to scale, matches the "one room = one session" mental model.

### Pattern 5: WebSocket Instance in useRef, Not useState
**What:** The socket object itself is not React state. Only derived data (messages, connection status) is state.
**Why:** Prevents re-render cycles when the socket emits. The socket is a mutable object; putting it in `useState` is a common React + WebSocket footgun.

```tsx
function useGameSocket(roomId: string) {
  const socketRef = useRef<WebSocket>();
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");

  useEffect(() => {
    const ws = new WebSocket(`wss://api/ws/${roomId}`);
    socketRef.current = ws;
    ws.onopen = () => setStatus("open");
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      // reducer pattern → update state
    };
    ws.onclose = () => setStatus("closed");
    return () => ws.close();
  }, [roomId]);

  const send = (msg: ClientMessage) => socketRef.current?.send(JSON.stringify(msg));
  return { state, status, send };
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Authoritative Wins
**What:** Client announces "BINGO!" and others trust it.
**Why bad:** Trivially exploitable. Any player can claim a win with the browser devtools console. Breaks trust in the game.
**Instead:** Server checks every mark, owns the `winnerId`, broadcasts `gameWon`.

### Anti-Pattern 2: Broadcasting Every Mark as a Full State Snapshot
**What:** Re-sending the entire room state on every click.
**Why bad:** Wasteful bandwidth, confuses diffing, harder to reason about. A 20-player game with ~100 marks per game would send 100 × 20 = 2000 full snapshots of ~10KB each = 20MB for a trivial game.
**Instead:** Send full snapshot only on initial join and phase transitions. Send deltas (`cellMarked`) for in-game actions. Colyseus `@colyseus/schema` does this automatically via binary delta encoding; a hand-rolled approach just sends delta JSON.

### Anti-Pattern 3: Multiple Servers Sharing One Room Without Pub/Sub
**What:** Load balancer round-robins players in the same room across instances without sticky routing.
**Why bad:** Players see different states. Marks don't propagate. Chaos.
**Instead:** Sticky routing by `roomId` (HTTP session affinity, Durable Objects, or Colyseus presence). For MVP single-instance, trivially solved.

### Anti-Pattern 4: Polling for Updates
**What:** Client polls `GET /rooms/:id` every second.
**Why bad:** Terrible latency, terrible bandwidth, doesn't meet the 1-second requirement cleanly, doesn't scale.
**Instead:** WebSocket push. Non-negotiable for this product.

### Anti-Pattern 5: Using localStorage for Session Identity
**What:** Persist `playerId` in `localStorage` so "they come back tomorrow."
**Why bad:** Confuses multi-tab use, clutters storage, creates weird "zombie player" reconnection bugs, requires GDPR-style consent in some jurisdictions. Games are ephemeral.
**Instead:** `sessionStorage` keyed by `roomId`. Reconnect within the tab's lifetime; new tab = new session.

### Anti-Pattern 6: Trusting the Client's Clock for Win Timing
**What:** Use client-reported timestamps to break ties.
**Why bad:** Clocks drift, clients lie, NTP isn't reliable in browsers.
**Instead:** Server receive-order is the tiebreaker. First message processed wins.

---

## Scalability Considerations

| Concern | At 10 concurrent rooms (MVP) | At 1,000 rooms | At 100,000 rooms |
|---------|------------------------------|----------------|------------------|
| Compute | Single Node process, ~10 MB RAM | Single process still fine, ~500 MB | Multi-process + sticky routing; Colyseus cluster or PartyKit Durable Objects |
| Connections | 10-200 WebSockets | 1k-20k WebSockets | 100k+ — use edge platform (Cloudflare DO, AWS API Gateway WebSocket) |
| State storage | In-memory | In-memory | Still in-memory per-room; edge DOs colocate memory + compute |
| Room routing | None needed | Room ID map in memory | Consistent hashing / DO built-in routing |
| Deploy | Single container, any PaaS | Horizontal scale with session affinity | Edge-native (PartyKit/Cloudflare), no orchestration |

**Key insight:** because each room is independent and small, this architecture is **embarrassingly parallel**. You never need to shard within a room. You only need to route to the right room. At MVP scale, a single $5 VPS handles this easily.

---

## Suggested Build Order (Dependencies)

Roadmap phases should respect these dependencies. Earlier items unblock later items.

### Phase A — Transport + Skeleton
1. **Server skeleton:** HTTP endpoint to create/join rooms, WebSocket upgrade, room registry (Map `roomId → roomInstance`).
2. **Client skeleton:** React app scaffold, WebSocket hook, connection status display.
3. **Echo round-trip:** Client sends `ping`, server echoes `pong`. Verifies the full pipe.
*Gate:* Two browser tabs open the same room URL; messages echo between them via server.

### Phase B — Lobby + Presence
4. Room creation returns `joinCode`. Join by code resolves and connects.
5. `playerJoined`/`playerLeft` events. Display player list. Host designation (first to join).
6. Room disposal on empty.
*Gate:* Create a room, share code to another tab, see both names in each other's lobby.

### Phase C — Word Submission
7. `SUBMITTING` phase. `submitWord` handler, dedupe, persist in room state.
8. Host control: "Open submission" and "Start game" buttons (server-validated).
9. Client UI: submit form, live-updating word list.
*Gate:* Multiple players submit words, all see the combined list grow live.

### Phase D — Board Generation + Play
10. Grid-size selection logic.
11. Server-side Fisher-Yates board generator with blanks.
12. Transition to `PLAYING`, distribute per-player boards.
13. Board renderer in React (grid component).
14. `markCell` / `unmarkCell` handlers + broadcast.
15. Optimistic UI for own marks; server-confirmed for peer marks.
*Gate:* Three players see their unique boards, mark cells, and see each other's marks update within 1 second. (Peer marks probably shown as ghost/dimmed; primary requirement is just sync.)

### Phase E — Win Detection + End Game
16. Precompute winning lines on board creation.
17. Server `checkWin` after every `markCell`.
18. `gameWon` broadcast with winning line.
19. `ENDED` phase, winner announcement modal.
20. "Play again" flow (reset room to LOBBY, keep players).
*Gate:* A player completes a line, everyone sees the winner announcement within 1 second.

### Phase F — Resilience
21. Auto-reconnect in the WebSocket hook.
22. Server-side `allowReconnection` / slot hold on drop.
23. Recovery: on reconnect, server sends full `roomState` snapshot.
24. Error handling: malformed messages, duplicate submissions, phase violations.
*Gate:* Refresh the tab mid-game; you're back in your seat with your marks intact.

### Phase G (Stretch) — Polish
25. Mobile touch ergonomics, responsive grid.
26. Sound on mark / win.
27. Rate limiting on submit/mark (anti-spam).
28. Basic analytics (room count, avg game duration).

**Parallelizable tracks:** Server + client can progress together once Phase A is done. UI polish (Phase G style) can happen anytime after Phase B.

---

## Technology Options (decision deferred to STACK.md)

Three reasonable server architectures, in increasing order of abstraction:

1. **Node + Express + `ws`** — bare metal, full control, most code to write.
2. **Node + Socket.IO** — popular, rooms/broadcast built-in, extra overhead, widely known.
3. **Colyseus** (Node, Context7-verified) — purpose-built for this. `Room` class with `onCreate`/`onJoin`/`onLeave`/`onDrop`/`onReconnect`/`onDispose` lifecycle, `@colyseus/schema` for binary delta-encoded state sync, built-in matchmaking. As of 0.17 (April 2026) ships with automatic reconnection and TypeScript-first `defineServer()` API.
4. **PartyKit / Cloudflare Durable Objects** — each room is a DO, edge-deployed, zero server management, routing by room ID is native. Cloudflare acquired PartyKit; this is now first-class for real-time multiplayer on Cloudflare's edge.

**Architecture consequence:** Options 1-3 imply one server process. Option 4 implies edge-native, no server to operate. The overall component boundaries are identical; the difference is operational.

---

## Sources

### HIGH confidence (Context7, official docs)
- [Colyseus Documentation (Context7)](https://docs.colyseus.io/) — room lifecycle methods (`onCreate`, `onJoin`, `onLeave`, `onDrop`, `onReconnect`, `onDispose`), matchmaking, `setMatchmaking`, `lock`/`unlock`
- [Colyseus React SDK — useQueueRoom](https://github.com/colyseus/docs/blob/master/pages/getting-started/react.mdx)
- [PartyKit Docs — How PartyKit works](https://docs.partykit.io/how-partykit-works/) — each room = one Durable Object; routing guaranteed by room id
- [Cloudflare — Durable Objects concepts](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/)
- [Cloudflare acquires PartyKit (blog)](https://blog.cloudflare.com/cloudflare-acquires-partykit/)
- [nanoid (GitHub)](https://github.com/ai/nanoid) — 21-char default, customAlphabet, collision math
- [Nano ID Collision Calculator](https://alex7kom.github.io/nano-nanoid-cc/)

### MEDIUM confidence (verified, multiple sources)
- [Metaplay — What are Server-Authoritative Realtime Games? (2026)](https://www.metaplay.io/blog/server-authoritative-games)
- [Heroic Labs / Nakama — Authoritative Multiplayer](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/)
- [Gabriel Gambetta — Client-Server Game Architecture](https://www.gabrielgambetta.com/client-server-game-architecture.html)
- [Rune — Building a Scalable Multiplayer Game Architecture](https://developers.rune.ai/blog/building-a-scalable-multiplayer-game-architecture) — sticky sessions by room+game combo
- [Smashing Magazine — Build a Real-Time Multi-User Game](https://www.smashingmagazine.com/2021/10/real-time-multi-user-game/)
- [Ably — Building a realtime multiplayer browser game](https://dev.to/ably/building-a-realtime-multiplayer-browser-game-in-less-than-a-day-part-2-4-1p1l)
- [WebSocket.org — WebSockets in React: Hooks, Lifecycle, Pitfalls](https://websocket.org/guides/frameworks/react/) — socket in `useRef`, not `useState`
- [TkDodo — Using WebSockets with React Query](https://tkdodo.eu/blog/using-web-sockets-with-react-query)
- [RxDB — Building an Optimistic UI](https://rxdb.info/articles/optimistic-ui.html)

### LOW confidence (reference / inspiration)
- [GitHub — andres0ares/bingo (Next.js + Socket.io)](https://github.com/andres0ares/bingo)
- [GitHub — phpHavok/multiplayer-bingo (Go)](https://github.com/phphavok/multiplayer-bingo)
- [GitHub — spflueger/bingo (browser multiplayer bingo)](https://github.com/spflueger/bingo)
- [Vivek's Tech Blog — Multiplayer Bingo](https://vulabs.dev/posts/multiuser_bingo_game/)
- [Game Programming Patterns — State](https://gameprogrammingpatterns.com/state.html)
