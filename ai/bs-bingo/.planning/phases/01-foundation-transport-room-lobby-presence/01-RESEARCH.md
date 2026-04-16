# Phase 1: Foundation — Transport, Room, Lobby, Presence - Research

**Researched:** 2026-04-16
**Domain:** Real-time multiplayer transport, room lifecycle, presence sync on Cloudflare Durable Objects + SvelteKit
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield scaffold of the entire app. It establishes (a) the SvelteKit 2 + Svelte 5 frontend on `@sveltejs/adapter-cloudflare`, (b) a PartyServer-backed Durable Object class (`GameRoom`) that holds authoritative room state in memory, (c) a PartySocket client module that auto-reconnects, and (d) the session/identity decoupling (sessionStorage-keyed player token) that RESI-01 will lean on in Phase 5. All seven SESS requirements are answered by this phase, and the room-code generator, lifecycle TTL, share-link route, and error page shipped here are the contract every later phase inherits.

The stack is already chosen and locked in `CONTEXT.md` / `research/STACK.md`. Research here is prescriptive, not exploratory: verify the current versions of each dependency, pin down the exact API surface of PartyServer 0.4 and PartySocket 1.1 against their 2026 docs, and flag the two version facts that shifted since `STACK.md` was written (`new_sqlite_classes` vs `new_classes`, and `lucide-svelte` 1.0.1 stable).

**Primary recommendation:** Stand up the app in three work streams that can parallelize after a one-task scaffolding gate — (1) PartyServer `GameRoom` DO class with authoritative in-memory state and a typed message protocol validated by Valibot, (2) SvelteKit routes (`/`, `/join/[code]`, `/room/[code]`) with an `.svelte.ts` client store wrapping PartySocket, (3) UI components per the approved `01-UI-SPEC.md`. Ship `new_sqlite_classes` (not `new_classes`) in `wrangler.jsonc` because the current PartyServer README requires it, and turn on `static options = { hibernate: true }` on the `GameRoom` class from day one — hibernation is opt-in and retrofitting later means changing a migration tag.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Home / Landing Page**
- **D-01:** Single-page layout with two prominent CTAs: "Create a game" and "Join a game" (code entry field inline). No separate create/join routes.
- **D-02:** No loading state on the home page — it is static.

**Join Flow & Display Name**
- **D-03:** Display name is collected inline (modal or sheet) the moment a user initiates either action (create or join). Required before entering the lobby.
- **D-04:** Display name: max 20 characters, no special validation beyond non-empty trim. Stored in `sessionStorage` keyed by room ID.
- **D-05:** Join code entry: uppercase, 6 characters, visually unambiguous alphabet (no 0/O/1/I/L). Input auto-uppercases and ignores ambiguous substitutions. Submit on Enter or button press.

**Room Code & Share Link**
- **D-06:** 6-character nanoid with a custom alphabet. Displayed prominently in the lobby header. Copy-code button (Clipboard API) adjacent to the code.
- **D-07:** Share link = `{origin}/join/{code}`. Copy-link button in the lobby header alongside the code. Clicking the share link pre-fills the join code and prompts for a display name.

**Lobby Layout & Presence**
- **D-08:** Lobby uses a vertical list layout. Each player entry shows: auto-assigned color circle with their initials, display name, and a "Host" badge (crown icon) on the room creator.
- **D-09:** Player list is ordered by join time (oldest at top). Live updates — new joiners append to the bottom; departures remove immediately with no animation needed in Phase 1.
- **D-10:** The lobby shows a "Waiting for players…" hint when fewer than 2 players are present.

**Connection State**
- **D-11:** No persistent connection status indicator on the happy path — the UI is silent when connected. A non-blocking top banner ("Reconnecting…" with a spinner) appears only when the WebSocket is disconnected. Banner auto-dismisses on reconnect.

**Error States**
- **D-12:** Expired, non-existent, or already-started rooms render a dedicated error page (not a broken lobby). The page shows a human-readable message and a single CTA: "Create a new game" (returns to home).
- **D-13:** Phase 5 handles reconnection/resume. Phase 1 error states are for cold-entry failures only (bad code, dead room).

**Host Designation**
- **D-14:** First player to create the room is the host. This is shown in the lobby. Host cannot leave Phase 1 (host transfer is Phase 5 scope). In Phase 1, if the host navigates away the room is effectively orphaned — acceptable for this phase.

### Claude's Discretion

- Visual design (color palette, typography, spacing) — implement with Tailwind 4, clean and minimal, mobile-first *(NOTE: already resolved by the approved `01-UI-SPEC.md` — the planner should treat the UI spec as binding, not the discretion)*.
- Exact animation/transition style for player join/leave — subtle or none is fine.
- Whether copy-code and copy-link are one combined button or two separate buttons *(the UI spec chose two separate buttons — follow that)*.
- Error message copy.

### Deferred Ideas (OUT OF SCOPE)

- Host transfer on disconnect → Phase 5 (RESI-05)
- Reconnect / session resume → Phase 5 (RESI-01 through RESI-04)
- Spectator mode → v2 (explicitly out of scope)
- QR code for join link → v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | User can create a new game session and receive a 6-character join code and shareable link. | `nanoid/customAlphabet` with the D-05 alphabet; `getServerByName` call on the `GameRoom` Durable Object namespace; share URL built as `{origin}/join/{code}`. |
| SESS-02 | User can join an existing session by entering a join code. | Client-side form posts to `/api/rooms/:code/exists` (or the WS `onBeforeConnect` returns 404), then opens PartySocket with `room: code`. |
| SESS-03 | User can join an existing session by opening a share link. | SvelteKit route `/join/[code]/+page.svelte` pre-fills the display-name modal, same downstream WS connect as SESS-02. |
| SESS-04 | User can enter a display name to identify themselves in the lobby (no account required). | Modal per `01-UI-SPEC.md`; `sessionStorage` key `bsbingo_player_{code}` stores `{playerId, displayName}`; name sent as a hello message after `onConnect`. |
| SESS-05 | All players in the lobby can see who has joined in real time. | PartyServer `this.broadcast(playerJoined)` on `onConnect` after the client sends `hello`; `playerLeft` on `onClose`. |
| SESS-06 | First player to create a room is designated the host. | Server-side: the DO's in-memory `hostId` is set on the first accepted `hello`; all `roomState` snapshots include it. |
| SESS-07 | User opening a link for an expired or non-existent room sees a clear error message. | `routePartykitRequest`'s `onBeforeConnect` returns a 404 if the room isn't "live", SvelteKit `+page.server.ts` for `/join/[code]` pings the DO first and throws `error(404, ...)` on miss. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** Use `/gsd-execute-phase` or similar GSD commands; do not make direct edits outside a GSD workflow.
- **Project declarations in CLAUDE.md are echoed from `STACK.md`** — no additional independent constraints beyond what STACK/ARCHITECTURE/PITFALLS/CONTEXT already impose.
- Performance: <1s end-to-end mark→peer propagation (this phase: join→peers see roster).
- Accessibility: browser-only, works on desktop and mobile (UI-SPEC codifies 44px tap targets).
- Simplicity: zero-signup flow — no cookies, no auth.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Room code generation (6-char) | API / Backend (Worker entry) | — | A secure, collision-avoiding code must not be client-forgeable. Server-side `nanoid/customAlphabet` inside the Worker's `POST /api/rooms`. |
| Room existence check (cold lookup) | Durable Object (`GameRoom`) | API / Backend (Worker fetch) | The DO itself is the only authority on whether a room is "live"; the Worker proxies the check. |
| WebSocket upgrade + room routing | Edge (Cloudflare Worker) → Durable Object | — | `routePartykitRequest` parses `/parties/game-room/:code` and routes to `env.GameRoom.idFromName(code)`. |
| Authoritative room state (players list, hostId, phase) | Durable Object (`GameRoom`) | — | Locked by ARCHITECTURE.md Pattern 1 (Authoritative Server, Dumb Client). |
| Presence broadcast (join/leave) | Durable Object | — | `this.broadcast` on PartyServer. |
| Display name modal | Browser / Client | — | Ephemeral UI, no server concern until submitted. |
| `sessionStorage` player identity (`playerId`) | Browser / Client | API / Backend (validates on `hello`) | Per ARCHITECTURE Pitfall 5 (decouple identity from socket). Server treats incoming `playerId` as a resume key — Phase 1 always admits it; Phase 5 uses it to match slots. |
| Share-link route `/join/[code]` | Frontend Server (SvelteKit SPA) | — | Pure client routing; no server data needed beyond the existence check on entry. |
| Error page for bad/expired room | Frontend Server (SvelteKit `+error.svelte`) | API (DO ping) | SvelteKit renders a 404 via `error(404, …)` thrown in the `/join/[code]` load function. |
| Reconnecting banner | Browser / Client | — | PartySocket exposes readyState; Svelte 5 `$state` reflects it. |

**Misassignment to watch for (flagged for planner):** It will be tempting to let the client generate the room code and POST it to the server. Don't. Client-generated codes are race-prone (two browsers pick the same random code in the same tick) and bypass the server's collision/retry loop. Code generation lives in the Worker's `POST /api/rooms` handler.

## Standard Stack

All versions verified against the npm registry on 2026-04-16.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `svelte` | `5.55.4` | UI framework, runes-based reactivity | [VERIFIED: npm view svelte version → 5.55.4] Matches `STACK.md`; runes work in `.svelte.ts` modules. |
| `@sveltejs/kit` | `2.57.1` | Router, adapter integration | [VERIFIED: npm view @sveltejs/kit version → 2.57.1] |
| `@sveltejs/adapter-cloudflare` | `7.2.8` | Builds to `.svelte-kit/cloudflare/_worker.js` | [VERIFIED: npm view @sveltejs/adapter-cloudflare version → 7.2.8] First-party Cloudflare adapter; emits the Worker entry that our custom `fetch()` wraps. |
| `partyserver` | `0.4.1` | Server-side Durable Object room class | [VERIFIED: npm view partyserver version → 0.4.1] [CITED: https://github.com/threepointone/partyserver/blob/main/packages/partyserver/README.md] |
| `partysocket` | `1.1.16` | Client-side WebSocket with reconnection | [VERIFIED: npm view partysocket version → 1.1.16] [CITED: https://github.com/threepointone/partyserver/blob/main/packages/partysocket/README.md] |
| `wrangler` | `4.83.0` | Dev server + deploy CLI | [VERIFIED: npm view wrangler version → 4.83.0] |
| `tailwindcss` | `4.2.2` | Utility styling with `@theme` tokens | [VERIFIED: npm view tailwindcss version → 4.2.2] [CITED: https://tailwindcss.com/docs/installation/framework-guides/sveltekit] |
| `@tailwindcss/vite` | latest | Vite plugin that wires Tailwind v4 into SvelteKit | [CITED: Tailwind SvelteKit guide — install command is `npm install tailwindcss @tailwindcss/vite`] |
| `nanoid` | `5.1.9` | Room-code and player-id generation with custom alphabet | [VERIFIED: npm view nanoid version → 5.1.9] [CITED: https://github.com/ai/nanoid/blob/main/README.md] |
| `valibot` | `1.3.1` | WS message schema validation, client + server | [VERIFIED: npm view valibot version → 1.3.1] [CITED: https://github.com/fabian-hiller/valibot README] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-svelte` | `1.0.1` | Crown/clipboard/spinner/alert icons | [VERIFIED: npm view lucide-svelte version → 1.0.1] ⚠️ The UI-SPEC declares `^0.454.0`. That version IS still on npm, but `1.0.1` is the current stable line. The API changed minimally between `0.5xx` and `1.0`; use `^1.0.1` for new code and update the UI-SPEC note. |
| `@fontsource-variable/inter` | `5.2.8` | Self-hosted Inter variable font | [VERIFIED: npm view @fontsource-variable/inter version → 5.2.8] |
| `@fontsource-variable/space-grotesk` | latest | Self-hosted Space Grotesk for the wordmark and room code | [CITED: UI-SPEC §Design System] |
| `@cloudflare/workers-types` | latest | TypeScript ambient types for `platform.env` bindings | [CITED: SvelteKit adapter-cloudflare docs — "install the `@cloudflare/workers-types` package and reference them in your `src/app.d.ts`"] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PartyServer + PartySocket | Raw Durable Object + native WebSocket API | PartyServer removes ~100 lines of accept/hibernate boilerplate and gives you `broadcast`, `getConnections`, `getConnectionTags` for free. Don't skip it. |
| Valibot | Zod 4 | ~10× larger bundle for equivalent safety. `STACK.md` locked this. |
| Tailwind v4 Vite plugin | PostCSS-based Tailwind v3 | v3 still works but the v4 Vite plugin is the canonical install per the Tailwind docs. |
| `nanoid` | `crypto.randomUUID()` for room codes | UUID is 36 chars and includes dashes — unsharable. nanoid's `customAlphabet` is the right tool. |

**Installation:**

```bash
pnpm create svelte@latest bs-bingo            # scaffold SvelteKit
cd bs-bingo

# Cloudflare runtime + deploy
pnpm add -D @sveltejs/adapter-cloudflare@^7.2.8 wrangler@^4.83.0 @cloudflare/workers-types

# Styling
pnpm add -D tailwindcss@^4.2.2 @tailwindcss/vite
pnpm add @fontsource-variable/inter @fontsource-variable/space-grotesk lucide-svelte@^1.0.1

# Real-time
pnpm add partyserver@^0.4.1 partysocket@^1.1.16

# Utilities
pnpm add nanoid@^5.1.9 valibot@^1.3.1
```

**Version verification note:** All versions above were resolved by running `npm view <pkg> version` on 2026-04-16. No speculative versions.

## Architecture Patterns

### System Architecture Diagram

```
                            ┌─────────────────────────────────────────┐
                            │            Browser (client)             │
                            │                                         │
                            │  ┌──────────────┐   ┌────────────────┐  │
                            │  │ SvelteKit    │   │ src/lib/store/ │  │
                            │  │ routes:      │◀─▶│ room.svelte.ts │  │
                            │  │  /           │   │ ($state runes) │  │
                            │  │  /join/[c]   │   └────────┬───────┘  │
                            │  │  /room/[c]   │            │          │
                            │  └──────────────┘   ┌────────▼───────┐  │
                            │                     │ PartySocket    │  │
                            │                     │ (reconnecting) │  │
                            │                     └────────┬───────┘  │
                            └──────────────────────────────┼──────────┘
                                                           │ wss://
                                                           │ /parties/game-room/:code
                                                           │
                            ┌──────────────────────────────▼──────────┐
                            │      Cloudflare Worker (edge)           │
                            │                                         │
                            │  fetch(request, env):                   │
                            │    ├─ POST /api/rooms  → create code,   │
                            │    │      check DO, return {code, link} │
                            │    ├─ GET /api/rooms/:code/exists?      │
                            │    │      (room liveness ping)          │
                            │    ├─ routePartykitRequest(...)         │
                            │    │      parses /parties/game-room/:c  │
                            │    │      → env.GameRoom.idFromName(c)  │
                            │    │      → WS upgrade into DO          │
                            │    └─ SvelteKit server handler (for     │
                            │         pages/load functions)           │
                            └───────────────┬─────────────────────────┘
                                            │
                            ┌───────────────▼─────────────────────────┐
                            │  Durable Object: GameRoom (per code)    │
                            │  (PartyServer, hibernation enabled)     │
                            │                                         │
                            │  In-memory state:                       │
                            │   - code:       string (from ctx.id)    │
                            │   - phase:      "lobby" (P1 only)       │
                            │   - hostId:     string | null           │
                            │   - players:    Map<playerId, Player>   │
                            │   - createdAt:  number                  │
                            │   - lastActive: number                  │
                            │                                         │
                            │  Lifecycle:                             │
                            │   onStart   — set createdAt, bump TTL   │
                            │   onConnect — admit, wait for hello     │
                            │   onMessage — validate w/ Valibot,      │
                            │               dispatch (hello/ping/…)   │
                            │   onClose   — remove, broadcast left    │
                            │   onAlarm   — reap empty rooms          │
                            └─────────────────────────────────────────┘
```

**Data-flow trace — a player joining by code:**

1. Browser: home page, user clicks "Join with code", enters `ABC234`.
2. Browser: display-name modal captures name; generates `playerId = nanoid(21)` if not already in `sessionStorage.bsbingo_player_ABC234`; stores `{playerId, displayName}` there.
3. Browser: SvelteKit navigates to `/room/ABC234`.
4. Browser: `room.svelte.ts` instantiates `new PartySocket({ party: "game-room", room: "ABC234" })`.
5. Edge Worker: `routePartykitRequest` calls `onBeforeConnect`, which pings the DO for existence; if dead, returns a `404` Response that PartySocket surfaces as a `close`, which the route handler turns into a redirect to an error page.
6. Edge Worker: upgrade succeeds, DO's `onConnect(conn, ctx)` runs.
7. Browser: sends `{type: "hello", playerId, displayName}` immediately after `onopen`.
8. DO: `onMessage` parses/validates with Valibot. If the player map is empty AND `hostId` unset → assign this player as host. Add to `players`. Broadcast `{type: "playerJoined", player}` to others; send `{type: "roomState", state}` to the joining client.
9. All other connections: their `PartySocket` emits `message`, `room.svelte.ts` mutates `$state` players array, the lobby `{#each}` re-renders with the new PlayerRow within one animation frame.

### Recommended Project Structure

```
bs-bingo/
├── wrangler.jsonc                      # Worker + DO binding + migrations
├── svelte.config.js                    # @sveltejs/adapter-cloudflare
├── vite.config.ts                      # tailwindcss() + sveltekit() plugins
├── src/
│   ├── app.d.ts                        # App.Platform.env.GameRoom binding type
│   ├── app.css                         # @import "tailwindcss"; @theme tokens
│   ├── hooks.server.ts                 # SvelteKit handle() — passes through; DO routing happens in server-entry
│   ├── routes/
│   │   ├── +layout.svelte              # imports app.css; renders Reconnecting banner slot
│   │   ├── +layout.ts                  # prerender = false; csr = true (SPA)
│   │   ├── +page.svelte                # Home: Create + Join form
│   │   ├── +page.server.ts             # POST /api/rooms lives in a dedicated +server.ts instead
│   │   ├── api/
│   │   │   └── rooms/
│   │   │       └── +server.ts          # POST → create a room code, ping DO to materialize
│   │   │       └── [code]/
│   │   │           └── exists/
│   │   │               └── +server.ts  # GET → 200 if live, 404 if reaped
│   │   ├── join/
│   │   │   └── [code]/
│   │   │       └── +page.svelte        # pre-fills modal, redirects to /room/[code]
│   │   │       └── +page.server.ts     # load() → check DO, throw error(404) if dead
│   │   ├── room/
│   │   │   └── [code]/
│   │   │       └── +page.svelte        # Lobby
│   │   │       └── +page.server.ts     # load() → check DO exists
│   │   └── +error.svelte               # Error page (D-12)
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Button.svelte
│   │   │   ├── TextInput.svelte
│   │   │   ├── Modal.svelte
│   │   │   ├── Badge.svelte
│   │   │   ├── PlayerRow.svelte
│   │   │   ├── Banner.svelte
│   │   │   └── ErrorPage.svelte
│   │   ├── stores/
│   │   │   └── room.svelte.ts          # PartySocket wrapper + $state mirror
│   │   ├── protocol/
│   │   │   └── messages.ts             # Valibot schemas for ClientMessage + ServerMessage (shared server/client)
│   │   ├── util/
│   │   │   ├── roomCode.ts             # customAlphabet + ambiguous-char stripping
│   │   │   ├── playerColor.ts          # deterministic hash → 1 of 8 palette colors
│   │   │   └── initials.ts
│   │   └── session.ts                  # sessionStorage get/set for playerId+name
│   └── server/                         # server-only utilities (if any)
└── party/
    └── game-room.ts                    # PartyServer class `GameRoom`
```

**Why this split:**
- `party/` is a conventional PartyServer location; the root `_worker.js` emitted by `adapter-cloudflare` imports and re-exports `GameRoom`.
- `src/lib/protocol/messages.ts` is the single source of truth for wire format. Both the DO and the Svelte store import Valibot schemas from it. Do not duplicate types.
- `src/lib/stores/room.svelte.ts` uses the `.svelte.ts` extension so runes (`$state`, `$derived`) are legal — required for Svelte 5 reactive modules.

### Pattern 1: PartyServer `Server` class with opt-in Hibernation

**What:** Each room is a DO instance keyed by the 6-char code. PartyServer wraps the Cloudflare DO lifecycle with `onStart`/`onConnect`/`onMessage`/`onClose` hooks and handles WebSocket Hibernation under the hood when opted in.

**When to use:** For the `GameRoom` class. Always.

**Example:**
```ts
// Source: https://github.com/threepointone/partyserver/blob/main/packages/partyserver/README.md
// party/game-room.ts
import { Server, type Connection, type ConnectionContext } from "partyserver";
import * as v from "valibot";
import { ClientMessage, ServerMessage, type RoomState, type Player } from "../src/lib/protocol/messages";

type Env = { GameRoom: DurableObjectNamespace };

export class GameRoom extends Server<Env> {
  static options = { hibernate: true };     // CRITICAL — opt into Hibernation API

  // In-memory state (survives hibernation because PartyServer re-hydrates from storage if needed;
  // for Phase 1 the ephemeral TTL-based model means we intentionally DO NOT persist beyond the room's life)
  #hostId: string | null = null;
  #players = new Map<string, Player>();
  #createdAt = 0;

  onStart() {
    this.#createdAt = Date.now();
    // Schedule a reaper alarm. Idle > N min → self-destruct.
    this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
  }

  onConnect(conn: Connection, ctx: ConnectionContext) {
    // Connection is admitted; wait for the client's `hello` before adding to the roster.
    // Parking the connection in onConnect is important — we don't yet have their displayName or playerId.
  }

  onMessage(conn: Connection, raw: string | ArrayBuffer) {
    const result = v.safeParse(ClientMessage, JSON.parse(raw as string));
    if (!result.success) {
      conn.send(JSON.stringify({ type: "error", code: "bad_message" }));
      return;
    }

    switch (result.output.type) {
      case "hello": {
        const { playerId, displayName } = result.output;
        const isFirst = this.#players.size === 0 && this.#hostId === null;
        if (isFirst) this.#hostId = playerId;
        const player: Player = {
          playerId,
          displayName,
          isHost: playerId === this.#hostId,
          joinedAt: Date.now(),
        };
        this.#players.set(playerId, player);
        conn.setState({ playerId });  // tag the connection so onClose knows who left

        // Send full snapshot to the newcomer
        conn.send(JSON.stringify(<ServerMessage>{
          type: "roomState",
          state: this.#snapshot(),
        }));
        // Broadcast joined to everyone else
        this.broadcast(JSON.stringify(<ServerMessage>{
          type: "playerJoined",
          player,
        }), [conn.id]);
        return;
      }
      case "ping": {
        conn.send(JSON.stringify(<ServerMessage>{ type: "pong" }));
        return;
      }
    }
  }

  onClose(conn: Connection, _code: number, _reason: string, _wasClean: boolean) {
    const state = conn.state as { playerId?: string } | undefined;
    if (!state?.playerId) return;
    const p = this.#players.get(state.playerId);
    if (!p) return;
    this.#players.delete(state.playerId);
    this.broadcast(JSON.stringify(<ServerMessage>{
      type: "playerLeft",
      playerId: state.playerId,
    }));
  }

  async onAlarm() {
    if (this.#players.size === 0) {
      // Reap: delete storage so the DO instance can be garbage-collected.
      await this.ctx.storage.deleteAll();
      return;
    }
    // Still alive — extend alarm.
    this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
  }

  onRequest(request: Request): Response {
    // Lightweight liveness check for /api/rooms/:code/exists proxy
    const url = new URL(request.url);
    if (url.pathname.endsWith("/exists")) {
      return new Response(JSON.stringify({ exists: true, playerCount: this.#players.size }));
    }
    return new Response("Not Found", { status: 404 });
  }

  #snapshot(): RoomState {
    return {
      code: this.name,  // DO's idFromName string
      phase: "lobby",
      hostId: this.#hostId,
      players: [...this.#players.values()],
    };
  }
}

const IDLE_TTL_MS = 30 * 60 * 1000; // 30 min — DECISION: ratify with planner
```

### Pattern 2: Worker fetch handler — route to DO OR SvelteKit

**What:** The Cloudflare adapter generates `_worker.js` that handles SvelteKit routes. We wrap it so that `/parties/*` routes go to PartyServer and everything else falls through to SvelteKit.

**Example:**
```ts
// Source: https://github.com/threepointone/partyserver/blob/main/packages/partyserver/README.md
//         + https://github.com/sveltejs/kit/blob/main/documentation/docs/25-build-and-deploy/60-adapter-cloudflare.md
// (conceptual — actual integration uses adapter-cloudflare's emitted worker)

import { routePartykitRequest } from "partyserver";
import skWorker from "../.svelte-kit/cloudflare/_worker.js";
export { GameRoom } from "../party/game-room";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // PartyServer first — it only matches /parties/:server/:name
    const partyResponse = await routePartykitRequest(request, env, {
      onBeforeConnect: async (_req, { name: code }) => {
        // Room existence gate — if the DO has been reaped, reject the upgrade
        // so Phase 5 doesn't have to retrofit this.
        const stub = env.GameRoom.get(env.GameRoom.idFromName(code));
        const alive = await stub.fetch(`https://do/exists`).catch(() => null);
        if (!alive || !alive.ok) return new Response("Room not found", { status: 404 });
      },
    });
    if (partyResponse) return partyResponse;

    // Fall through to SvelteKit for pages + /api/*
    return skWorker.fetch(request, env, ctx);
  },
};
```

**Open question for planner:** `adapter-cloudflare` emits its own `_worker.js`. The cleanest integration is to set `config.kit.adapter.routes = { include: [...], exclude: ["/parties/*"] }` and add a custom `_worker.js` that composes both. Confirm exact option names during planning — SvelteKit 2.57 docs support this pattern.

### Pattern 3: Svelte 5 `.svelte.ts` module store wrapping PartySocket

**What:** One reactive store per room session. `$state` runes are legal only in `.svelte.js` / `.svelte.ts` files.

```ts
// Source: Svelte 5 docs — https://github.com/sveltejs/svelte/blob/main/documentation/docs/06-runtime/01-stores.md
//         PartySocket docs — https://github.com/threepointone/partyserver/blob/main/packages/partysocket/README.md
// src/lib/stores/room.svelte.ts
import { PartySocket } from "partysocket";
import * as v from "valibot";
import { ServerMessage, type RoomState } from "$lib/protocol/messages";
import { getOrCreatePlayer } from "$lib/session";

export function createRoomStore(code: string) {
  const player = getOrCreatePlayer(code);

  // Runes state — all consumers get reactive updates.
  let state = $state<RoomState | null>(null);
  let status = $state<"connecting" | "open" | "reconnecting" | "closed">("connecting");

  const ws = new PartySocket({
    // host defaults to window.location.host — correct for same-origin deploy
    party: "game-room",      // kebab-cased binding name
    room: code,
  });

  ws.addEventListener("open", () => {
    status = "open";
    ws.send(JSON.stringify({
      type: "hello",
      playerId: player.playerId,
      displayName: player.displayName,
    }));
  });

  ws.addEventListener("close", () => { status = "reconnecting"; });
  ws.addEventListener("error", () => { status = "reconnecting"; });

  ws.addEventListener("message", (ev) => {
    const parsed = v.safeParse(ServerMessage, JSON.parse(ev.data));
    if (!parsed.success) return;
    const msg = parsed.output;
    switch (msg.type) {
      case "roomState":    state = msg.state; break;
      case "playerJoined": if (state) state.players = [...state.players, msg.player]; break;
      case "playerLeft":   if (state) state.players = state.players.filter(p => p.playerId !== msg.playerId); break;
    }
  });

  return {
    get state() { return state; },
    get status() { return status; },
    disconnect() { ws.close(); },
  };
}
```

### Pattern 4: Server-generated room code (customAlphabet)

```ts
// Source: https://github.com/ai/nanoid/blob/main/README.md
import { customAlphabet } from "nanoid";
// Per CONTEXT D-05 / D-06 — 31-char visually unambiguous alphabet
const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const makeRoomCode = customAlphabet(ROOM_CODE_ALPHABET, 6);
// 31^6 ≈ 887M combinations — collision check-and-retry on the DO is trivial.
```

**Collision handling:** `env.GameRoom.idFromName(code)` does NOT detect collisions automatically — it creates a deterministic DO ID per string. You must ping the DO first and, if `playerCount > 0` or `createdAt > 0`, generate a new code. For Phase 1's scale (single-digit concurrent rooms) this is astronomically unlikely, but include the 3-line while loop anyway.

### Pattern 5: Session identity decoupled from socket

```ts
// src/lib/session.ts
import { nanoid } from "nanoid";
type Player = { playerId: string; displayName: string };
export function getOrCreatePlayer(code: string): Player {
  const key = `bsbingo_player_${code}`;
  const existing = sessionStorage.getItem(key);
  if (existing) return JSON.parse(existing);
  const p = { playerId: nanoid(), displayName: "" };
  sessionStorage.setItem(key, JSON.stringify(p));
  return p;
}
export function setDisplayName(code: string, displayName: string) {
  const key = `bsbingo_player_${code}`;
  const cur = getOrCreatePlayer(code);
  sessionStorage.setItem(key, JSON.stringify({ ...cur, displayName }));
}
```

**Why this matters even in Phase 1:** RESI-01 in Phase 5 depends on `playerId` already living in `sessionStorage` at that point. Shipping this split now avoids a schema migration later.

### Pattern 6: Valibot shared protocol

```ts
// Source: https://github.com/fabian-hiller/valibot/blob/main/website/src/routes/guides/(main-concepts)/parse-data/index.mdx
// src/lib/protocol/messages.ts
import * as v from "valibot";

export const Player = v.object({
  playerId: v.pipe(v.string(), v.minLength(1)),
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
  isHost: v.boolean(),
  joinedAt: v.number(),
});
export type Player = v.InferOutput<typeof Player>;

export const RoomState = v.object({
  code: v.string(),
  phase: v.literal("lobby"),
  hostId: v.nullable(v.string()),
  players: v.array(Player),
});
export type RoomState = v.InferOutput<typeof RoomState>;

export const ClientMessage = v.variant("type", [
  v.object({
    type: v.literal("hello"),
    playerId: v.pipe(v.string(), v.minLength(1)),
    displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
  }),
  v.object({ type: v.literal("ping") }),
]);
export type ClientMessage = v.InferOutput<typeof ClientMessage>;

export const ServerMessage = v.variant("type", [
  v.object({ type: v.literal("roomState"), state: RoomState }),
  v.object({ type: v.literal("playerJoined"), player: Player }),
  v.object({ type: v.literal("playerLeft"), playerId: v.string() }),
  v.object({ type: v.literal("error"), code: v.string(), message: v.optional(v.string()) }),
  v.object({ type: v.literal("pong") }),
]);
export type ServerMessage = v.InferOutput<typeof ServerMessage>;
```

### Anti-Patterns to Avoid

- **Generating the room code in the browser.** See Architectural Responsibility Map note.
- **Storing identity in `localStorage`.** Per ARCHITECTURE.md Pitfall 5 — use `sessionStorage` scoped by roomId. Prevents "zombie player" bugs across rooms.
- **Skipping Valibot for WS messages.** Clients ARE adversarial, especially with DevTools open. `safeParse` on every inbound.
- **Running logic in `+page.ts` that only works in the browser.** Use `+page.svelte` `onMount` or put the code behind `if (browser)` from `$app/environment`.
- **Putting `PartySocket` instances in module top-level state.** Keep them inside `createRoomStore()` so SvelteKit SSR won't try to instantiate them.
- **Using the default PartySocket auto-generated `id`.** Phase 5 needs `playerId`-keyed reconnection. Don't rely on the WS-layer id; carry `playerId` in the `hello` message explicitly.
- **Forgetting `static options = { hibernate: true }`.** Retrofitting after launch means a new migration tag in wrangler.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-reconnecting WebSocket client | `new WebSocket()` + manual backoff | `partysocket` | Handles exponential backoff with jitter, uptime gating (`minUptime`), configurable `maxReconnectionDelay`, and ready-state events — all tested in the wild. Hand-rolled reconnection is where nearly every multiplayer-web project has lived for its first bug report. |
| Durable Object boilerplate (`fetch`, upgrade, accept, message routing) | Raw DO class with `state.acceptWebSocket(server)` | `partyserver` Server base class | Saves ~100 lines per room class, gives you `broadcast(msg, exclude)` and `getConnections()` for free, and its Hibernation integration is the one the maintainers use themselves. |
| 6-character unambiguous room codes | `Math.random()` with manual alphabet loop | `nanoid/customAlphabet` | Uses a CSPRNG. Worth 3 lines of nanoid code to avoid accidentally spinning up `Math.random()` which is NOT cryptographically safe (matters more in Phase 3 board generation — but set the habit now). |
| Discriminated-union WebSocket schema | TypeScript types + `as` casts | `valibot` `v.variant("type", [...])` | Runtime enforcement at both ends; `InferOutput<>` gives you the same TypeScript types for free. |
| Tailwind v4 install | `postcss.config.js` + `tailwind.config.js` | `@tailwindcss/vite` plugin only | v4's Oxide engine configures via `@theme` in CSS. The `@tailwindcss/vite` plugin is the blessed SvelteKit setup. |

**Key insight:** The stack is already pre-vetted to eliminate hand-rolling at every layer of Phase 1. The temptation is to "just write a quick WebSocket client" — resist.

## Runtime State Inventory

*Not applicable — this is a greenfield phase. No pre-existing renames, migrations, or stored data.*

## Common Pitfalls

### Pitfall 1: `new_classes` vs `new_sqlite_classes` in wrangler.jsonc

**What goes wrong:** PartyServer 0.4.1 with `static options = { hibernate: true }` expects SQLite-backed storage. The older `new_classes` migration tag worked when there was no SQLite, but current docs have moved to `new_sqlite_classes`. Mixing them causes silent failures where the DO can't persist or hibernate cleanly.

**Why it happens:** Most example code online (including PartyServer's own `hono-party` subpackage README and this project's `STACK.md` snippet) still shows `new_classes`. The authoritative `partyserver` package README has updated to `new_sqlite_classes`.

**How to avoid:** Use `new_sqlite_classes: ["GameRoom"]` in the initial migration. Verify on Context7 before writing the file.

**Warning signs:** `wrangler dev` starts, but `ctx.storage.sql.exec(...)` (if you add it in Phase 2) throws. Or a deploy succeeds but connections time out.

**Confidence:** HIGH [VERIFIED: Context7 /threepointone/partyserver README 2026-04-16 shows `new_sqlite_classes`; Cloudflare WebSocket Hibernation docs confirm `new_sqlite_classes` is the correct tag for hibernatable DOs.]

### Pitfall 2: Forgetting `static options = { hibernate: true }`

**What goes wrong:** Without hibernation, the DO stays "warm" and bills duration GB-seconds for every second of every connected socket. Cloudflare describes this as "as much as 1000x more expensive." PartyServer does not default this on.

**How to avoid:** Include `static options = { hibernate: true }` on the `GameRoom` class from the very first commit.

**Detection:** `wrangler tail` in prod shows the DO class staying resident between messages.

### Pitfall 3: SvelteKit SSR tries to evaluate `new PartySocket()` at build time

**What goes wrong:** `partysocket` reaches for `WebSocket` which doesn't exist in the SSR environment. The build fails or the first render errors.

**How to avoid:** The whole app runs as an SPA for Phase 1. Set `export const ssr = false;` in `src/routes/+layout.ts` (the CONTEXT doesn't dictate SSR, and no SEO / data-fetching use case demands it). All client stores live inside components mounted with `onMount` or behind `if (browser)`.

**Warning signs:** Build-time errors mentioning `WebSocket is not defined` or `window is not defined`.

**Confidence:** HIGH [CITED: SvelteKit docs — "Disable SSR for SPA Mode in SvelteKit" / `+layout.js` `export const ssr = false`.]

### Pitfall 4: Browser generates `playerId` but never re-uses it

**What goes wrong:** The client computes a new `playerId` on every load. sessionStorage is ignored. Phase 5 reconnect has no key to match, so Phase 5 is written as a bigger migration.

**How to avoid:** `getOrCreatePlayer(code)` in `src/lib/session.ts` is the ONLY entry point for `playerId`. Component code never mints IDs itself. Write a unit test that `getOrCreatePlayer("ABC234")` called twice returns the same object.

**Detection:** Open two tabs of `/room/ABC234` with the same browser session → roster shows two separate players. Wrong. (For Phase 1 this is acceptable — it's what multi-tab WILL do in Phase 5 — but the single-tab refresh case must reuse.)

### Pitfall 5: `routePartykitRequest` prefix mismatch

**What goes wrong:** Docs show the default prefix is `parties`. A client that says `party: "game-room", room: "ABC234"` connects to `/parties/game-room/ABC234`. If the server-side router is configured with a different prefix (or the custom `_worker.js` wrapper filters `/party/*` instead), the WS upgrade 404s.

**How to avoid:** Use the default `prefix: "parties"` on both sides. If you override, override in exactly one place and export a shared constant.

**Confidence:** HIGH [CITED: `routePartykitRequest(request, env, {prefix = 'parties', ...})` default per PartyServer README.]

### Pitfall 6: PartyServer `party` name must match the kebab-cased binding

**What goes wrong:** Client passes `party: "GameRoom"`. Server binding is named `GameRoom`. PartyServer's default router lowercases+kebab-cases the binding name, so it looks for `game-room` and the client's camelCase misses.

**How to avoid:** Client side, use `party: "game-room"`. Define a shared constant `PARTY_NAME = "game-room"` that both the client store and any integration tests import.

**Confidence:** HIGH [CITED: PartySocket README — "if you use routePartykitRequest, it automatically uses the kebab-cased version of the binding name (MyServer -> my-server)".]

### Pitfall 7: Clipboard API in insecure contexts

**What goes wrong:** `navigator.clipboard.writeText()` throws on `http://` origins. `wrangler dev` serves on `localhost` which Chrome considers secure, but a LAN preview on a phone via IP won't work.

**How to avoid:** Feature-detect `navigator.clipboard`. For local testing of the Copy button on a phone, use Cloudflare Tunnel or `wrangler dev --tunnel`. Accept that local-IP preview won't exercise the copy path.

### Pitfall 8: Host designation race on simultaneous first connects

**What goes wrong:** Two players hit `POST /api/rooms` in the same tick; both are first; both think they're host.

**How to avoid:** Room creation is atomic per `code`. The `POST /api/rooms` handler picks a fresh code, the DO's `onMessage("hello")` decides the host based on `this.#players.size === 0 && this.#hostId === null`. Inside one DO instance, JS is single-threaded, so two `hello` messages from the same room are processed sequentially by the Worker's event loop.

**Notes:** Don't set the host in `POST /api/rooms` (who *creates* ≠ who connects first, especially if the creator never opens the lobby). The reliable rule: "first to `hello` becomes host." This matches CONTEXT D-14 ("first player to create the room is the host") because the create flow and the `hello` both happen on the creator's client before the share link is even copied.

### Pitfall 9: Session-lifecycle ambiguity (from PITFALLS.md §4)

**What goes wrong:** "Anonymous sessions" sounds simple, but fuzzy lifecycle leads to zombie rooms or kicked hosts.

**How to avoid (Phase 1 specifics — these are decisions the planner should lock):**

| Event | Behavior |
|-------|----------|
| Creator hits `POST /api/rooms` | Room materializes (DO comes online, sets `createdAt`, `hostId=null`, empty players). Alarm set for `createdAt + IDLE_TTL_MS`. |
| Creator's client opens WS and sends `hello` | They become host (first `hello`, `#hostId === null`). |
| Second player joins | `hello` → added, roster broadcast. |
| Player closes tab | `onClose` removes from roster + broadcasts left. No slot-hold in Phase 1 (that is RESI-02 / Phase 5). |
| Host closes tab | Same as any player (CONTEXT D-14 accepts this as "room is effectively orphaned"). Room persists until idle TTL. Non-hosts see Host badge disappear; remaining players can still look at each other's names. |
| Room empty for `IDLE_TTL_MS` | `onAlarm` clears storage — next request to this code must create a new room. |
| Non-existent code joined | DO's `/exists` endpoint returns 404; `onBeforeConnect` 404s the WS upgrade; SvelteKit renders error page. |

**Proposed `IDLE_TTL_MS` default:** 30 minutes. A reasonable meeting span. The planner should confirm — this is a product decision, not a technical one.

### Pitfall 10: Icon library version drift (lucide-svelte)

**What goes wrong:** UI-SPEC locked `^0.454.0`. The current stable is `1.0.1`. Between those, the package moved to a `1.0.0-rc.x` line. Both versions work, but if one dev uses `^0.454.0` and another `^1.0.1`, you can get double-install or API-subtle drift (tree-shaking changed around icon named-exports in 1.0).

**How to avoid:** Use `lucide-svelte@^1.0.1` for the Phase 1 install. Update the UI-SPEC header note during planning. Keep `@fontsource-variable/inter` at `^5.2.8` (stable).

**Confidence:** HIGH [VERIFIED: `npm view lucide-svelte version` → `1.0.1` on 2026-04-16.]

## Code Examples

### Create-room endpoint (server)

```ts
// Source: nanoid docs + PartyServer docs
// src/routes/api/rooms/+server.ts
import { json, error } from "@sveltejs/kit";
import { customAlphabet } from "nanoid";
import type { RequestHandler } from "./$types";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeCode = customAlphabet(ROOM_CODE_ALPHABET, 6);

export const POST: RequestHandler = async ({ platform, url }) => {
  if (!platform?.env) error(500, "Platform unavailable");
  const env = platform.env;

  // Collision check-and-retry
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const stub = env.GameRoom.get(env.GameRoom.idFromName(code));
    const res = await stub.fetch(`https://do/exists`).catch(() => null);
    if (!res || !res.ok) {
      // Room doesn't exist yet — materialize by pinging once (warm on first hello)
      return json({ code, shareUrl: `${url.origin}/join/${code}` });
    }
    // Collision; try again
  }
  error(500, "Could not allocate a room code");
};
```

### Room existence check (for `/join/[code]` load)

```ts
// src/routes/join/[code]/+page.server.ts
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform?.env) error(500, "Platform unavailable");
  const stub = platform.env.GameRoom.get(platform.env.GameRoom.idFromName(params.code));
  const res = await stub.fetch(`https://do/exists`).catch(() => null);
  if (!res || !res.ok) error(404, { message: "Room not found" });
  return { code: params.code };
};
```

### Tailwind v4 setup

```ts
// Source: https://tailwindcss.com/docs/installation/framework-guides/sveltekit
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
});
```

```css
/* src/app.css */
@import "tailwindcss";

@theme {
  --color-bg:           #0F0F14;
  --color-surface:      #1A1A23;
  --color-divider:      #2A2A36;
  --color-accent:       #F5D547;
  --color-destructive:  #F87171;
  --color-ink-primary:  #F5F5F7;
  --color-ink-secondary:#A1A1AA;
  --color-ink-inverse:  #0F0F14;
  --font-sans: "Inter Variable", system-ui, sans-serif;
  --font-display: "Space Grotesk Variable", "Inter Variable", sans-serif;
}
```

### wrangler.jsonc (authoritative)

```jsonc
// Source: https://github.com/threepointone/partyserver/blob/main/packages/partyserver/README.md
//         https://github.com/sveltejs/kit/blob/main/documentation/docs/25-build-and-deploy/60-adapter-cloudflare.md
{
  "name": "bs-bingo",
  "main": ".svelte-kit/cloudflare/_worker.js",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_als"],
  "assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
  "durable_objects": {
    "bindings": [
      { "name": "GameRoom", "class_name": "GameRoom" }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["GameRoom"]
    }
  ]
}
```

### `src/app.d.ts` (binding type)

```ts
// Source: https://github.com/sveltejs/kit/blob/main/documentation/docs/25-build-and-deploy/60-adapter-cloudflare.md
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
declare global {
  namespace App {
    interface Platform {
      env: {
        GameRoom: DurableObjectNamespace;
      };
    }
  }
}
export {};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new_classes` in wrangler migrations | `new_sqlite_classes` for hibernatable / SQLite-backed DOs | 2025 (Cloudflare introduced SQLite-backed DOs; PartyServer README updated) | Phase 1 must use `new_sqlite_classes`. |
| Raw `WebSocketPair` + `server.accept()` | `ctx.acceptWebSocket(server)` (Hibernation API) | 2024 — Hibernation GA | PartyServer wraps this; opt in via `static options = { hibernate: true }`. |
| Svelte 4 stores (`writable`, `readable`) | Svelte 5 runes (`$state`, `$derived`, `$effect`) in `.svelte.ts` modules | Svelte 5 GA | Our room store is a rune, not a store. |
| Tailwind v3 with `tailwind.config.js` + PostCSS | Tailwind v4 with `@tailwindcss/vite` + `@theme` in CSS | Tailwind v4 GA, 2025 | No config file needed for Phase 1. |
| Zod for WS validation | Valibot (tree-shakeable, ~10× smaller) | Valibot 1.0 (2024-2025) | Already locked in STACK.md. |
| `lucide-svelte@0.4xx` | `lucide-svelte@1.0.1` stable | Late 2025 / early 2026 | Update UI-SPEC pin. |

**Deprecated / outdated:**
- Socket.IO: great tool, wrong fit (see STACK.md §"Why not Socket.IO").
- Firebase Realtime DB: wrong cost profile + auth friction for zero-signup.
- `localStorage` for ephemeral game identity: use sessionStorage per PITFALLS Anti-Pattern 5.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `IDLE_TTL_MS = 30 minutes` is the appropriate idle-reap window for Phase 1 rooms. | Pitfall 9, Pattern 1 | If too short, the "room expires mid-planning" UX bug surfaces; too long and orphan rooms linger. LOW risk for Phase 1 (any value works for the demo). **User should confirm during planning.** |
| A2 | The SvelteKit `_worker.js` can be wrapped by a custom Worker entry that calls `routePartykitRequest` first, then delegates to SvelteKit. | Pattern 2 | If `adapter-cloudflare` doesn't expose a clean override path, we'd need to instead move `/parties/*` to the adapter's exclude list and use a secondary Worker script (still tenable). **Verify early in the planning phase.** |
| A3 | `lucide-svelte@1.0.1` has the same named-export surface as `0.454.0` for the icons used (`Crown`, `ClipboardCopy`, `Check`, `Loader2`, `AlertTriangle`). | Supporting Stack | If exports changed, icons need renaming. Time cost: minutes. Low risk. |
| A4 | PartyServer 0.4.1's `onRequest` can be used for the `/exists` liveness ping without interfering with WS routing. | Pattern 2, `onRequest` usage | If `onRequest` is reserved or does not cover our sub-path, we'd serve the existence check via a separate Worker fetch (slightly more boilerplate). |
| A5 | `IDLE_TTL` reset via `onAlarm` re-arming is sufficient; we don't need per-message alarm bumping in Phase 1. | Pattern 1 | A host who opens the page and never connects would have their room persist the full TTL. Acceptable at Phase 1. |

## Open Questions

1. **Does `adapter-cloudflare` v7.2.8 provide a hook for custom `_worker.js` composition, or must we use `--routes` exclude + a secondary worker script?**
   - What we know: SvelteKit docs confirm `adapter-cloudflare` emits `_worker.js` at `.svelte-kit/cloudflare/_worker.js`; it is importable as an ES module.
   - What's unclear: Whether re-exporting from a wrapper file is the canonical approach in 2026 or whether SvelteKit has a newer `platformProxy` option.
   - Recommendation: Spike this in the very first scaffold task. If the wrapper approach fails, move PartyServer to a separate Worker script bound by service binding (still ships as one `wrangler deploy`).

2. **Room `IDLE_TTL_MS` — 30 minutes or longer?**
   - What we know: Meetings are typically 30-60 min.
   - Recommendation: Ship 30 min; add a config constant so tuning is one-line.

3. **Should `POST /api/rooms` require a display name up-front, or is it allocated-then-hello?**
   - CONTEXT D-03 says the modal collects the name "the moment a user initiates either action." Either order works; the simpler implementation is: POST creates the room, redirect to `/room/[code]`, modal opens, user submits, client sends `hello`. The DO only has a `hostId` after the first `hello` — consistent with Pitfall 8.
   - Recommendation: Allocate-then-hello.

4. **Phase 1 "Start Game" button disabled-state copy is in UI-SPEC; should we keep it or hide the button entirely until Phase 2?**
   - CONTEXT and UI-SPEC both show a disabled "Start Game" with a "Coming in the next build" tooltip.
   - Recommendation: Keep as specified — it previews the flow for Phase 2 planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | pnpm, SvelteKit build | ✓ | v23.11.0 | — |
| pnpm | STACK.md install commands | ✓ | 10.33.0 | npm (available 11.11.1) |
| npm | Registry lookups + fallback install | ✓ | 11.11.1 | — |
| git | Version control, GSD commits | ✓ | 2.50.1 | — |
| wrangler CLI | `wrangler dev`, `wrangler deploy` | ✗ (not globally installed) | — | `pnpm add -D wrangler@^4.83.0` + `pnpm exec wrangler dev` — standard pattern; no blocker. |
| Cloudflare account + DO entitlement | Production deploy, `wrangler deploy` | Unknown (not testable in this sandbox) | — | Dev works without; deploy blocked until a Cloudflare account + paid plan ($5/mo for DOs) is configured. **Flag for the user; Phase 1 local development does not require an account.** |
| Cloudflare Tunnel (mobile preview) | Testing Clipboard API on a phone during dev | Unknown | — | `wrangler dev --remote` or deploy to a preview URL. Not blocking Phase 1 code completion, only hardware testing. |

**Missing dependencies with no fallback:**
- None that block Phase 1 code implementation.

**Missing dependencies with fallback:**
- `wrangler` will be installed as a dev dependency (standard pattern).
- Cloudflare account entitlement will be needed for `wrangler deploy`; `wrangler dev` works locally without it.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` (latest stable via `@testing-library/svelte` + `@sveltejs/vitest-plugin` if available) plus Playwright for end-to-end — see Wave 0 |
| Config file | `vitest.config.ts` (does not exist yet — Wave 0) |
| Quick run command | `pnpm exec vitest run --changed` |
| Full suite command | `pnpm exec vitest run && pnpm exec playwright test` |

**Why vitest + Playwright:** vitest is the SvelteKit-blessed unit test runner (same Vite pipeline, Svelte 5 rune support). Playwright covers the two-tab, real-WebSocket integration tests needed for SESS-03, SESS-05. Smoke tests against `wrangler dev`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | `POST /api/rooms` returns a 6-char code matching the unambiguous alphabet, and a shareURL of form `{origin}/join/{code}`. | unit (server) | `pnpm exec vitest run tests/unit/api-rooms.test.ts` | ❌ Wave 0 |
| SESS-01 | `makeRoomCode()` produces only alphabet chars `ABCDEFGHJKMNPQRSTUVWXYZ23456789` and length 6. | unit | `pnpm exec vitest run tests/unit/roomCode.test.ts` | ❌ Wave 0 |
| SESS-02 | Client submitting a known-live code via `/` navigates to `/room/[code]` and roster appears. | e2e | `pnpm exec playwright test e2e/join-by-code.spec.ts` | ❌ Wave 0 |
| SESS-03 | Visiting `/join/ABC234` pre-fills display-name modal; after submit, lobby loads. | e2e | `pnpm exec playwright test e2e/join-by-link.spec.ts` | ❌ Wave 0 |
| SESS-04 | Display-name modal trims, enforces `1 ≤ len ≤ 20`, and persists to `sessionStorage.bsbingo_player_{code}`. | unit (browser) | `pnpm exec vitest run tests/unit/session.test.ts` | ❌ Wave 0 |
| SESS-05 | Two parallel Playwright contexts in the same room see each other's roster updates within 1s. | e2e | `pnpm exec playwright test e2e/presence.spec.ts` | ❌ Wave 0 |
| SESS-06 | `GameRoom` assigns `hostId` to the first `hello` sender; host badge visible to all connections. | integration (against `wrangler dev`) | `pnpm exec playwright test e2e/host-designation.spec.ts` | ❌ Wave 0 |
| SESS-07 | `/join/NOTREAL` and `/room/NOTREAL` render `+error.svelte` (404) with the "Create a new game" CTA. | e2e | `pnpm exec playwright test e2e/error-page.spec.ts` | ❌ Wave 0 |
| (valibot) | `ClientMessage` schema rejects malformed hello payloads. | unit | `pnpm exec vitest run tests/unit/protocol.test.ts` | ❌ Wave 0 |

**Manual-only acceptance (flagged):** Real-device mobile tap-target validation (44px) is unit-testable via computed style in Playwright but the subjective tap-ergonomic check on a physical iPhone is manual. Not blocking.

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run --changed` (unit tests only, <5s).
- **Per wave merge:** `pnpm exec vitest run && pnpm exec playwright test` (full suite, ~60-90s).
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `vitest.config.ts` — Vitest + jsdom/browser env for SvelteKit
- [ ] `playwright.config.ts` — two browser contexts, base URL from `wrangler dev`
- [ ] `tests/unit/roomCode.test.ts` — covers SESS-01 alphabet check
- [ ] `tests/unit/session.test.ts` — covers SESS-04 sessionStorage behavior
- [ ] `tests/unit/protocol.test.ts` — covers Valibot schemas
- [ ] `tests/unit/api-rooms.test.ts` — covers POST /api/rooms handler
- [ ] `e2e/join-by-code.spec.ts` — SESS-02
- [ ] `e2e/join-by-link.spec.ts` — SESS-03
- [ ] `e2e/presence.spec.ts` — SESS-05 (two contexts)
- [ ] `e2e/host-designation.spec.ts` — SESS-06
- [ ] `e2e/error-page.spec.ts` — SESS-07
- [ ] Framework install: `pnpm add -D vitest @vitest/ui @playwright/test jsdom` + `pnpm exec playwright install --with-deps`
- [ ] `package.json` scripts: `"test:unit": "vitest run"`, `"test:e2e": "playwright test"`, `"test": "vitest run && playwright test"`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Zero-signup explicit product decision; `playerId` is a self-issued nanoid, not an auth token. |
| V3 Session Management | partial | sessionStorage per-room bundle is the "session"; no cookies. Phase 5 extends with slot-hold windows. |
| V4 Access Control | yes | Host-only actions (Phase 2+ will include start-game, but Phase 1 only has "designated as host"). Server enforces `hostId`; client UI alone cannot grant host powers. |
| V5 Input Validation | yes | Valibot `v.safeParse` on every inbound WS message server-side; client-side also for trust-but-verify. Display name capped at 20 chars and non-empty after trim. |
| V6 Cryptography | yes | `nanoid` uses CSPRNG (`crypto.getRandomValues` under the hood). Room codes are from a 31-char alphabet — entropy ~30 bits. Adequate for ~minutes-long ephemeral rooms; NOT adequate for long-lived tokens. Do not hand-roll randomness. |
| V8 Data Protection | partial | sessionStorage is per-origin, per-tab — appropriate ephemeral scope. No PII collected. |
| V11 Error Handling | yes | `handleError` in `hooks.server.ts` sanitizes error messages so stack traces don't leak to clients. Generic 404 for bad codes (don't distinguish "room never existed" vs "room reaped"). |
| V12 Files and Resources | n/a | No file uploads in Phase 1. |
| V13 API / Web Service | partial | `/api/rooms*` endpoints need basic rate-limiting (Pitfall 12 in PITFALLS.md). Phase 1: defer to middleware or accept higher limits; revisit in Phase 3. |

### Known Threat Patterns for Cloudflare Workers + Durable Objects + WebSocket + SvelteKit

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Room-code enumeration (brute-force join) | Information Disclosure | 31^6 ≈ 887M combinations; don't distinguish "not found" vs "reaped"; basic rate-limit on `/api/rooms/*/exists`. |
| Display-name abuse (slurs, impersonation, XSS) | Tampering / Repudiation | Valibot maxLength 20 + Svelte's default HTML escaping. Phase 3 adds profanity filter (PITFALLS #13). |
| WebSocket message flooding | Denial of Service | Hibernation absorbs idle cost; for active-flood, Cloudflare applies per-IP connection limits globally. In-DO, drop messages past a rate (Phase 3). |
| Room creation spam (unlimited DOs) | DoS / Cost | Rate-limit `POST /api/rooms` (Pitfall 12). Phase 3 will add Cloudflare Turnstile or per-IP token bucket. Phase 1: document the risk. |
| Malformed WS payloads | Tampering | `v.safeParse` rejects; error reply; connection stays open so attacker gets no oracle. |
| Client-claimed "I am host" | Elevation of Privilege | Server owns `hostId`; clients send `playerId` only. Host-guard runs on every mutating op. |
| Cross-origin WS hijack | Spoofing | PartyServer's `onBeforeConnect` can check `origin` header. Add origin allowlist = `[env.APP_ORIGIN]` in production. |

## Sources

### Primary (HIGH confidence — Context7 / Official Docs)

- [PartyServer README (Context7: /threepointone/partyserver)](https://github.com/threepointone/partyserver/blob/main/packages/partyserver/README.md) — Server class, `routePartykitRequest`, `static options = { hibernate: true }`, `new_sqlite_classes` migration
- [PartySocket README (same repo, `packages/partysocket/README.md`)](https://github.com/threepointone/partyserver/blob/main/packages/partysocket/README.md) — client options, reconnection defaults, readyState
- [Cloudflare Durable Objects — WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) — `acceptWebSocket`, `webSocketMessage`, `new_sqlite_classes`
- [Cloudflare DO — idFromName](https://developers.cloudflare.com/durable-objects/api/id/) — deterministic routing by name
- [SvelteKit adapter-cloudflare](https://github.com/sveltejs/kit/blob/main/documentation/docs/25-build-and-deploy/60-adapter-cloudflare.md) — `platform.env`, `wrangler.jsonc` shape, `App.Platform` ambient types
- [SvelteKit SPA mode](https://github.com/sveltejs/kit/blob/main/documentation/docs/25-build-and-deploy/55-single-page-apps.md) — `export const ssr = false` on layout
- [SvelteKit routing — load functions + error()](https://github.com/sveltejs/kit/blob/main/documentation/docs/20-core-concepts/10-routing.md) — 404 pattern for `/join/[code]`
- [Svelte 5 — `$state` in `.svelte.ts` modules](https://github.com/sveltejs/svelte/blob/main/documentation/docs/06-runtime/01-stores.md) — shared reactive state module pattern
- [Svelte 5 — runes overview](https://github.com/sveltejs/svelte/blob/main/documentation/docs/02-runes/02-$state.md)
- [Nanoid README](https://github.com/ai/nanoid/blob/main/README.md) — `customAlphabet`, CSPRNG guarantee, collision calculator
- [Valibot guides — parse-data / safeParse](https://github.com/fabian-hiller/valibot/blob/main/website/src/routes/guides/(main-concepts)/parse-data/index.mdx)
- [Tailwind v4 with SvelteKit — install guide](https://tailwindcss.com/docs/installation/framework-guides/sveltekit) — `@tailwindcss/vite` plugin, `@import "tailwindcss"`, `@theme`

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — local research output, recent
- `.planning/research/ARCHITECTURE.md` — local research output, recent
- `.planning/research/PITFALLS.md` — local research output, recent
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-UI-SPEC.md` — approved design contract

### Tertiary (LOW confidence — reference only)

- Ecosystem blog posts linked in STACK.md §Sources (DEV, Inngest, Builder.io) — context, not authority

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-04-16.
- Architecture: HIGH — PartyServer + Durable Objects pattern is the maintained reference for this class of app; patterns verified from Context7.
- Pitfalls: HIGH — drawn from project-local PITFALLS.md (already MEDIUM-HIGH there) cross-checked with PartyServer/Cloudflare docs for the framework-specific items.
- Validation architecture: MEDIUM — vitest + Playwright are standard for SvelteKit but no config files exist yet. Wave 0 scope is explicit above.
- Security: HIGH — ASVS categories mapped against a zero-auth edge deployment; no claims stronger than what Cloudflare docs support.

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days — stack is stable; re-verify if Svelte 5.6 or Tailwind 4.3 ship in this window)
