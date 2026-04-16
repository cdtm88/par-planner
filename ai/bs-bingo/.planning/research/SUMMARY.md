# Project Research Summary

**Project:** Bullshit Bingo
**Domain:** Real-time multiplayer browser mini-game (ephemeral party game for meetings)
**Researched:** 2026-04-16
**Confidence:** HIGH

## Executive Summary

Bullshit Bingo is a low-tick, low-actor, ephemeral-room party game. The dominant architectural pattern — used by Jackbox, Skribbl, Kahoot, and every modern buzzword-bingo clone — is a **room-authoritative, single-process-per-room** model with WebSocket transport, in-memory state, zero persistence, and zero signup. Research strongly converges on this shape; there is no credible alternative worth considering.

The recommended implementation is **SvelteKit + PartyServer on Cloudflare Durable Objects (with WebSocket Hibernation) + PartySocket client**, deployed as a single Worker. This hits all three hard constraints from PROJECT.md (sub-second sync, zero signup, mobile-friendly browser-only) while costing ~$5/month at realistic scale and requiring zero operational work — no server processes to babysit, no sticky-session load balancers, no Redis. Each game room is one Durable Object: in-memory state, serialized message handling (which trivially resolves the "first to bingo wins" race condition), hibernating WebSockets so idle meetings don't burn cycles.

The three risks worth calling out up front are all architectural, not framework-level: (1) **server-authoritative win detection must be designed in from day one** — retrofitting it is painful; (2) **reconnection and session identity must be decoupled from the WebSocket** on day one as well, because iOS Safari drops WebSockets on screen lock and this product's primary use case is "phone during a Zoom call"; (3) **boards must be generated server-side and sent only to their owner** — naive client-side seeding leaks other players' boards via DevTools. All three mitigations are cheap if planned, expensive if bolted on.

## Key Findings

### Recommended Stack

A TypeScript-everywhere, edge-native stack where the same `wrangler deploy` ships the UI and the real-time server.

**Core technologies:**
- **SvelteKit 2.57 + Svelte 5.55** — full-stack framework; runes handle high-frequency reactive state naturally; minimal JS bundle
- **Cloudflare Durable Objects + WebSocket Hibernation API** — one DO per game room; authoritative in-memory state; ~1000x cost reduction while idle
- **PartyServer 0.4.1 + PartySocket 1.1.16** — ergonomic class-based wrapper over Durable Objects (server) + auto-reconnecting WebSocket client; Cloudflare-owned
- **Cloudflare Workers + Wrangler 4.83** — single deploy target for static UI and DO binding; free tier covers 100k req/day
- **Tailwind 4.2** — utility styling, new Oxide engine
- **Valibot 1.3** — WS message validation; 10x smaller bundle than Zod
- **nanoid 5.1** — short (6-char) friendly join codes with unambiguous alphabet

### Expected Features

**Must have (table stakes):**
- Create game session + shareable join code AND link
- Display-name-only anonymous join; lobby with live presence
- Word submission with case-insensitive dedupe and min-word threshold
- Host-triggered "Start Game"; grid size auto-derived from word count (3×3 / 4×4 / 5×5)
- Per-player server-generated randomized boards with blank spaces
- Click-to-mark with server-authoritative win detection and broadcast
- Mobile-responsive layout (≥44px tap targets)
- Reconnection with session ID in sessionStorage + state replay on rejoin
- Host reassignment if original host disconnects

**Should have (v1 differentiators — cheap, high impact):**
- Confetti + celebration animation on win
- "BINGO!" button winner presses to trigger announcement
- Starter buzzword packs (Corporate Classics / Agile / Sales)
- Friendly 6-char uppercase join codes with visually unambiguous alphabet
- One-click "copy link" via Clipboard API
- Play-again / rematch keeping the same lobby alive

### Architecture Approach

One Durable Object per game room holds the authoritative state machine (`LOBBY → SUBMITTING → PLAYING → ENDED`), mutates it only in response to validated client messages, and broadcasts state deltas to all connected clients. Clients are dumb renderers with a Svelte runes-backed mirror store and optimistic local marks for the acting player only.

**Major components:**
1. **UI Layer (Svelte 5)** — lobby / submission / board / winner screens
2. **Client Store (Svelte runes)** — reactive mirror of server state plus local optimistic marks
3. **Transport (PartySocket)** — persistent WebSocket with auto-reconnect and session-ID resume
4. **Durable Object Room Instance** — authoritative state, board generation, win detection, delta broadcasts
5. **Room Registry** — maps join codes → DO IDs (Cloudflare-native)

### Critical Pitfalls

1. **Client-authoritative win detection** — trivially cheatable; creates irresolvable race conditions. Must be server-side from Phase 1.
2. **Simultaneous-win race condition** — single-DO serialization resolves this by construction; first message dequeued wins. Lock state after winner declared.
3. **No reconnection strategy** — iOS Safari drops WebSockets on screen lock; cellular NAT kills idle connections in ~30s. Decouple player identity (sessionStorage token) from WebSocket; hold slots 30–60s; send full snapshot on resume.
4. **Vague session lifecycle** — define before coding: room TTL, host-disconnect behavior, player identity model, expired-room UX.
5. **Board generation leaks** — generate server-side with `crypto.getRandomValues`; send each player only their own board.

## Implications for Roadmap

### Suggested Phases

**Phase 1: Foundation — Transport, Room, Lobby, Presence**
Locks in server authority, identity decoupling, and lifecycle spec. Delivers: create-room, join-by-code, join-by-link, display name, live presence, host designation, friendly codes, copy-link.

**Phase 2: Lobby Gameplay — Word Submission & Start**
Word submission is BS Bingo's core differentiator. Delivers: per-player submission, dedupe, min-word threshold, starter packs, host "Start Game", auto grid-size selection.

**Phase 3: Board Generation & Core Mark Loop**
The gameplay itself. Delivers: server-side Fisher-Yates board gen with blanks, private boards (only your board sent to you), click-to-mark with optimistic UI, server-confirmed peer marks, mobile-responsive grid.

**Phase 4: Win Detection, Announcement, Play-Again**
The payoff moment. Delivers: server `checkWin` on every mark, `gameWon` broadcast, winner modal, confetti, BINGO! button, play-again flow.

**Phase 5: Resilience & Mobile Hardening**
Not optional — meeting context means flaky networks. Delivers: exponential-backoff reconnect, slot-hold, state-snapshot resume, `visibilitychange` resync, host reassignment, observability, real-device testing.

### Research Flags for Phase Planning

- **Phase 5 (Resilience):** Needs a dedicated research pass — reconnect/resume protocol is stack-specific and dense.
- **Phase 3 (Board Generation):** Short spike on bingo fairness invariants (winnability, blank placement constraints) worth doing before implementation.
- **Phases 1, 2, 4:** Standard patterns, no phase-specific research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified npm 2026-04-16; Cloudflare-official pattern |
| Features | MEDIUM-HIGH | Grounded in convergent competitor analysis |
| Architecture | HIGH | Universal pattern across Colyseus, PartyKit, and ecosystem sources |
| Pitfalls | MEDIUM-HIGH | Server authority, reconnection, race conditions have HIGH-confidence sources |

**Overall confidence: HIGH**

### Open Questions (product decisions, not research unknowns)

- Host-transfer policy on disconnect (recommend: next-longest-connected player)
- Multi-winner UX treatment (single-DO serialization makes true ties impossible)
- Mid-game join policy (recommend: reject, spectators are v2)
- Room TTL values (recommend: 30-60s slot hold, 5-15min idle reap)
- Word editing during lobby (recommend: remove own yes, host removes any no)
- Minimum word count per grid size (recommend: 5/12/21 for 3×3/4×4/5×5)

---
*Research completed: 2026-04-16*
*Ready for roadmap: yes*
