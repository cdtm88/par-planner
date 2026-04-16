/**
 * Custom Cloudflare Worker entry point.
 *
 * Routing order:
 *   1. /parties/* → PartyServer (GameRoom DO via routePartykitRequest)
 *   2. Everything else → SvelteKit handler
 *
 * Build note: After `vite build`, the adapter writes the SvelteKit handler to
 * `.svelte-kit/cloudflare/_worker.js`. This file imports it at runtime.
 * Dev workflow: run `pnpm build` first to generate the SK handler, then
 * `wrangler dev` bundles this entry.
 *
 * RESEARCH.md Pattern 2 — Worker fetch handler: route to DO OR SvelteKit.
 */

import { routePartykitRequest } from "partyserver";

// Re-export GameRoom so wrangler can register it as a Durable Object class.
export { GameRoom } from "../party/game-room.js";

// SvelteKit handler — emitted by @sveltejs/adapter-cloudflare during `vite build`.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — file is generated at build time; not present in the source tree
import skHandler from "../.svelte-kit/cloudflare/_worker.js";

type Env = {
  GameRoom: DurableObjectNamespace;
  ASSETS: Fetcher;
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // PartyServer handles /parties/:server/:name WebSocket upgrades + requests.
    const partyResponse = await routePartykitRequest(request, env as never, {
      onBeforeConnect: async (
        _req: Request,
        { name: code }: { name: string }
      ) => {
        // Room existence gate: reject WS upgrade if the room DO has been reaped.
        // Returns 404 before the upgrade is accepted → SESS-07.
        const stub = env.GameRoom.get(env.GameRoom.idFromName(code));
        const alive = await stub
          .fetch("https://do/exists")
          .catch(() => null);
        if (!alive || !alive.ok) {
          return new Response("Room not found", { status: 404 });
        }
      },
    });

    if (partyResponse) return partyResponse;

    // Fall through to SvelteKit for pages, API routes, and static assets.
    return (
      skHandler as { fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> }
    ).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
