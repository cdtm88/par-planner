# Technology Stack

**Project:** Bullshit Bingo — real-time multiplayer browser mini-game
**Researched:** 2026-04-16
**Overall confidence:** HIGH

## Headline Recommendation

Build on **SvelteKit + PartyServer (Cloudflare Durable Objects with WebSocket Hibernation) + PartySocket**, deployed entirely to **Cloudflare Workers** via a single `wrangler` config. The whole stack is TypeScript, serverless, globally edge-hosted, and costs effectively nothing at Bullshit Bingo scale.

This choice is driven by three constraints from `PROJECT.md`:
1. **"Must feel instant"** (sub-second sync) → rules out polling; WebSockets required.
2. **Zero-signup, ephemeral sessions** → rules out auth-heavy SaaS (Supabase, Firebase auth flows); favors per-room server objects with in-memory state.
3. **Browser-only, mobile-friendly** → favors a framework that ships minimal JS (SvelteKit over Next.js).

## Recommended Stack

### Real-Time / Coordination Layer (the critical choice)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Cloudflare Durable Objects** | (platform) | Per-game-session coordination actor | One Durable Object instance per game room. Holds game state in memory (players, submitted words, boards, marks). Strong consistency inside the object serializes all moves without locks — perfect for "first to complete a line wins" race conditions. |
| **WebSocket Hibernation API** | (platform) | Keep connections open while game is idle | Durable Object evicts from memory between messages but WS stays connected. Per Cloudflare docs, "reduces costs by as much as 1000x" and Cloudflare handles pings for free. Essential because meetings have long idle stretches. |
| **PartyServer** | `0.4.1` | Ergonomic wrapper over Durable Objects + WS | Class-based `Server` with `onConnect`/`onMessage`/`broadcast` primitives. Removes ~100 lines of DO boilerplate per room. Open source, now owned/maintained by Cloudflare (acquired Apr 2024). |
| **PartySocket** | `1.1.16` | Client-side WS with auto-reconnect | Drop-in WebSocket with reconnection, exponential backoff, and connection ID. Critical for flaky mobile/corporate wifi during meetings. |

**Confidence: HIGH** — Verified via Context7 (`/partykit/partykit`, `/threepointone/partyserver`) and Cloudflare official docs. Cloudflare explicitly ships a [multiplayer game tutorial](https://blog.cloudflare.com/building-real-time-games-using-workers-durable-objects-and-unity/) using this exact pattern.

#### Why not Socket.IO?

Socket.IO (`4.8.x`) is the classic answer but is wrong for this project:
- Requires a stateful Node.js process you have to host, scale, and keep warm
- ~15 KB/connection memory vs. ~3 KB for `ws`; ~60 KB client bundle
- Horizontal scaling needs Redis adapter + sticky sessions — overkill for ephemeral rooms
- Its own non-standard wire protocol (a plain WS client cannot connect)

Only choose Socket.IO if you explicitly need its room/namespace abstraction on a traditional Node host. For serverless + per-room state, Durable Objects are strictly better.

#### Why not raw `ws` on a Node VPS?

Works, but you own: process supervision, WS ping/pong, reconnection logic on client, horizontal scaling with sticky sessions, room-to-server routing, and state replication. Durable Objects give all of that for free.

#### Why not SSE or long-polling?

SSE is one-directional (server→client). A bingo mark is bidirectional (client sends mark, server broadcasts). Could be faked with fetch+SSE but that's two transports to debug for no benefit over WS. Polling at 1 s intervals would hit the "feels instant" bar but wastes ~60 req/min/player — unacceptable for a 10-player game.

#### Why not Liveblocks / Reflect / Ably / Pusher?

- **Liveblocks** — Overkill + pricey. Designed around CRDT document collab (cursors, text). Free tier caps at 100 MAU; paid starts at $19/mo. No custom server code on free tier.
- **Reflect** (Rocicorp) — Sunset / archived in favor of Zero. Do not use.
- **Ably / Pusher** — Managed WebSocket-as-a-service. Good, but add a vendor and cost where Cloudflare's platform already solves it. Free tiers have low message caps that a viral meeting tool could blow through in a week.

### Frontend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **SvelteKit** | `2.57.1` | Full-stack framework + router | Ships 50–70% less JS than Next.js for equivalent functionality. Critical on mobile browsers and corporate VPN'd laptops. Built-in Cloudflare adapter. |
| **Svelte 5** | `5.55.4` | UI layer with runes | Runes (`$state`, `$derived`) work in plain `.svelte.ts` files — ideal for a WebSocket client module that exposes a reactive game state object. Compiler-first, zero runtime. Docs explicitly cite high-frequency real-time updates as a sweet spot (100 msgs/sec at 60 fps). |
| **@sveltejs/adapter-cloudflare** | `7.2.8` | Build output for Workers | Same runtime as PartyServer. One `wrangler deploy` ships both the static UI and the Worker/DO. |
| **Vite** | `5.1.9` (via SvelteKit) | Dev server / bundler | Bundled with SvelteKit; nothing to configure. |

**Confidence: HIGH** — Versions verified from npm registry today (2026-04-16). SvelteKit + Svelte 5 are the current stable line.

#### Why not Next.js / React?

Next.js is the safe, boring choice and is fine, but:
- 30–50% larger JS bundle than SvelteKit for the same UI
- App Router + Server Components add complexity this project doesn't need (no SEO, no data fetching from DB, no auth)
- Harder to run non-HTTP WebSocket logic next to it — you'd still need a separate Worker/DO

React-specific wins (huge component ecosystem, hiring pool) don't apply to a ~10-screen meeting toy.

#### Why not plain HTML + vanilla JS?

Viable for an MVP, but you'll reinvent routing (`/`, `/game/:code`, `/join`), state management for the board, and a build step for TypeScript. SvelteKit gives all of that plus type-safe form actions for free.

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Tailwind CSS** | `4.2.2` | Utility-first styling | v4 has a new Oxide engine — no `postcss.config.js`, no `tailwind.config.js` in the common case. Configure via CSS `@theme`. Works out of the box with SvelteKit + Vite. |

**Confidence: HIGH.** Install via `pnpm add -D tailwindcss @tailwindcss/vite`.

### Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Valibot** | `1.3.1` | Validate WS messages on both sides | Same TypeScript schema safety as Zod; up to 90–95% smaller bundle because it's modular and tree-shakeable. Critical for a small game client and for Workers (where every KB of cold-start bundle costs ms). |

**Confidence: HIGH.** If the team already strongly prefers Zod (`4.3.6`), that is also fine — just accept the larger bundle.

### Infrastructure / Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Cloudflare Workers** | (platform) | Host static SvelteKit output + DO bindings | Single target for UI + server. Free tier covers 100k req/day. No cold starts for DOs while hibernating. |
| **Cloudflare Durable Objects** | (platform) | Per-room state | Paid plan minimum $5/month includes Workers + DO usage. At Bullshit Bingo scale (handful of concurrent meetings), $5/mo is the realistic ceiling. |
| **Wrangler** | `4.83.0` | Dev + deploy CLI | One command (`wrangler dev`) runs Worker + DO + static assets locally. `wrangler deploy` ships to prod. |

**Confidence: HIGH** — Cloudflare pricing page verified; PartyKit deploy-to-own-account path verified.

#### Why not Vercel + Upstash Redis / Railway / Fly.io?

- **Vercel** can't run Durable-Object-style per-room actors. You'd need an external WS host anyway → split infra.
- **Railway / Fly.io** works but you'd manage a long-lived Node process, sticky sessions, and per-region deployment yourself. More ops for worse latency.
- **Supabase Realtime** is Postgres-LISTEN/NOTIFY with Phoenix Channels on top. Great if you need persistence; adds a DB for a game that doesn't need one. Overkill.

### Session / Identity

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **nanoid** | `5.1.9` | Generate join codes + player IDs | 21-char URL-safe IDs by default; can generate short (6-char) friendly codes for game joins. 120-byte library. |
| **`sessionStorage` / `localStorage`** | (browser) | Persist player-id + chosen nickname | No cookies, no server-side session store. Anonymous by design, per `PROJECT.md` constraints. |

Generate a 6-character uppercase join code (`ABC123`) per game room; that string is the Durable Object ID. Player identity is a nanoid kept in `localStorage` so a refresh rejoins the same seat.

**Confidence: HIGH.**

### Optional / Later

| Technology | Version | Purpose | When |
|------------|---------|---------|------|
| **Cloudflare KV** | (platform) | Persist finished-game summaries | Only if v2 adds game history |
| **Sentry** | latest | Error reporting | Once there are real users |
| **PostHog** | latest | Funnel analytics (share-link → join rate) | After launch, to validate frictionless flow |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Real-time transport | Durable Objects + WS Hibernation | Socket.IO on Node VPS | Ops burden, more memory, non-standard protocol |
| Real-time transport | Durable Objects + WS Hibernation | Liveblocks | Vendor lock, priced for collab apps not games |
| Real-time transport | Durable Objects + WS Hibernation | Ably / Pusher | Extra vendor, tight free tiers |
| Frontend framework | SvelteKit | Next.js | Larger bundle, heavier mental model for a toy |
| Frontend framework | SvelteKit | Solid Start / Qwik | Smaller ecosystem for edge adapters |
| Frontend framework | SvelteKit | Plain HTML + vanilla JS | Reinvents routing/state for no gain |
| Backend runtime | Cloudflare Workers | Node.js on Fly.io / Railway | More ops, worse latency, no per-room actor model |
| Backend runtime | Cloudflare Workers | Deno Deploy | Smaller ecosystem for WS+state; no DO equivalent |
| Schema validation | Valibot | Zod | 10x larger bundle for equivalent safety |
| Schema validation | Valibot | ArkType | Faster but smaller community; Valibot is the safer pick |
| Styling | Tailwind v4 | CSS modules / vanilla CSS | Slower to iterate on a playful UI |
| Styling | Tailwind v4 | Chakra / MUI / shadcn | React-only or too heavy |
| ID / codes | nanoid | uuid v4 | Longer, not URL-friendly for 6-char join codes |

## What NOT to Use

| Don't use | Why |
|-----------|-----|
| **Firebase Realtime Database / Firestore** | Auth gating is a pain for zero-signup; pricing surprises; latency often worse than a DO |
| **Socket.IO on a single Node process** | Won't survive a Hacker News hug; sticky-session clustering is overkill here |
| **Any polling-based sync** | Can't hit the sub-second target without hammering the server |
| **Redux / Zustand / MobX** | Svelte 5 runes replace external state managers; adding one adds bundle + ceremony |
| **Turbopack / webpack directly** | SvelteKit uses Vite; don't fight the framework |
| **Next.js App Router** | You gain nothing (no DB, no auth, no SEO) and pay in bundle size + complexity |
| **tRPC** | Built for typed RPC over HTTP; for 5–10 WS message types, a plain discriminated-union TypeScript type + Valibot is simpler and smaller |
| **Reflect (Rocicorp)** | Archived; migrate-path is Zero, which is still early |

## Installation

```bash
# Scaffold SvelteKit on Cloudflare
pnpm create svelte@latest bs-bingo
cd bs-bingo
pnpm add -D @sveltejs/adapter-cloudflare@^7.2.8 wrangler@^4.83.0
pnpm add -D tailwindcss@^4.2.2 @tailwindcss/vite

# Real-time
pnpm add partyserver@^0.4.1 partysocket@^1.1.16

# Utilities
pnpm add valibot@^1.3.1 nanoid@^5.1.9
```

Minimal `wrangler.jsonc` snippet:

```jsonc
{
  "name": "bs-bingo",
  "main": ".svelte-kit/cloudflare/_worker.js",
  "compatibility_date": "2026-04-01",
  "durable_objects": {
    "bindings": [{ "name": "GameRoom", "class_name": "GameRoom" }]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["GameRoom"] }
  ]
}
```

## Confidence Summary

| Area | Confidence | Basis |
|------|------------|-------|
| Real-time layer (DO + WS Hibernation) | HIGH | Cloudflare official docs + Context7 PartyServer docs + existing multiplayer game reference implementation |
| Frontend (SvelteKit 2 / Svelte 5) | HIGH | npm versions verified 2026-04-16; SvelteKit Cloudflare adapter is first-party |
| Styling (Tailwind v4) | HIGH | Stable release, v4 engine is current |
| Validation (Valibot) | HIGH | Bundle-size advantage well-documented; both Zod and Valibot are acceptable |
| Hosting (Cloudflare Workers) | HIGH | Pricing and limits verified from Cloudflare docs |
| Session model (nanoid + localStorage) | HIGH | Straightforward; matches zero-signup constraint |

## Sources

### Authoritative (Context7 / Official)
- [PartyKit docs — how PartyKit works](https://docs.partykit.io/how-partykit-works/)
- [PartyServer README (Context7: /threepointone/partyserver)](https://github.com/threepointone/partyserver/blob/main/packages/partyserver/README.md)
- [Cloudflare Durable Objects — WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare Durable Objects — WebSocket Hibernation example](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare blog — Building real-time games with Workers, Durable Objects, and Unity](https://blog.cloudflare.com/building-real-time-games-using-workers-durable-objects-and-unity/)
- [Cloudflare blog — Cloudflare acquires PartyKit](https://blog.cloudflare.com/cloudflare-acquires-partykit/)
- [Svelte blog — Introducing runes](https://svelte.dev/blog/runes)
- [SvelteKit docs (Context7: /sveltejs/kit)](https://svelte.dev/docs/kit)
- [Socket.IO performance tuning](https://socket.io/docs/v4/performance-tuning/)
- [Valibot — comparison with Zod](https://valibot.dev/guides/comparison/)

### Corroborating (WebSearch)
- [Ably — Socket.IO vs WebSocket](https://ably.com/topic/socketio-vs-websocket)
- [DEV — Node.js WebSockets: ws vs Socket.IO](https://dev.to/alex_aslam/nodejs-websockets-when-to-use-ws-vs-socketio-and-why-we-switched-di9)
- [DEV — SvelteKit vs Next.js in 2026](https://dev.to/paulthedev/sveltekit-vs-nextjs-in-2026-why-the-underdog-is-winning-a-developers-deep-dive-155b)
- [DEV — Real-world Svelte 5: high-frequency real-time data with Runes](https://dev.to/polliog/real-world-svelte-5-handling-high-frequency-real-time-data-with-runes-3i2f)
- [Inngest — Building a real-time WebSocket app using SvelteKit](https://www.inngest.com/blog/building-a-realtime-websocket-app-using-sveltekit)
- [Builder.io — Valibot bundle size is 10x smaller than Zod](https://www.builder.io/blog/valibot-bundle-size)
- [Pockit — Zod vs Valibot vs ArkType in 2026](https://pockit.tools/blog/zod-valibot-arktype-comparison-2026/)
