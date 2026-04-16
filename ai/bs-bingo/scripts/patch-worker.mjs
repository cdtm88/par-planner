/**
 * Post-build patch for src/worker.ts.
 *
 * The @sveltejs/adapter-cloudflare writes a self-contained SvelteKit worker to
 * wrangler.main (src/worker.ts), which only exports the SvelteKit default handler.
 * Wrangler also needs the GameRoom Durable Object class exported from the same entry.
 *
 * This script runs after `vite build` and injects:
 *   1. The GameRoom re-export (so wrangler registers the DO class)
 *   2. A routePartykitRequest wrapper so /parties/* is handled by PartyServer
 *
 * Dev workflow: `pnpm build` runs this automatically via "postbuild" in package.json.
 * Then `wrangler dev --port 5173` works without further setup.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const workerPath = resolve(process.cwd(), "src/worker.ts");

const generated = readFileSync(workerPath, "utf8");

// Guard: if file already has GameRoom export, skip (idempotent).
if (generated.includes("GameRoom")) {
  console.log("patch-worker: GameRoom already present, skipping.");
  process.exit(0);
}

// Extract the default export name from the generated file.
// The adapter writes: export { worker_default as default };
const defaultExportMatch = generated.match(/export\s*\{\s*(\w+)\s+as\s+default\s*\}/);
if (!defaultExportMatch) {
  console.error("patch-worker: Could not find default export in generated worker. Aborting.");
  process.exit(1);
}
const skDefaultName = defaultExportMatch[1]; // e.g. "worker_default"

// Remove the original default export line — we'll replace it with our wrapper.
const stripped = generated.replace(/export\s*\{\s*\w+\s+as\s+default\s*\};\s*$/, "").trimEnd();

const patched = `${stripped}

// ---------------------------------------------------------------------------
// Injected by scripts/patch-worker.mjs after build (see 01-02-SUMMARY deferred items).
// Re-export GameRoom so wrangler registers the DO class from the binding in wrangler.jsonc.
export { GameRoom } from "../party/game-room.js";

// Wrap the SK default handler with PartyServer routing.
import { routePartykitRequest } from "partyserver";

export default {
  async fetch(request, env, ctx) {
    const partyResponse = await routePartykitRequest(request, env, {
      onBeforeConnect: async (_req, { name: code }) => {
        const stub = env.GameRoom.get(env.GameRoom.idFromName(code));
        const alive = await stub
          .fetch("https://do/exists", { headers: { "x-partykit-room": code } })
          .catch(() => null);
        if (!alive || !alive.ok) {
          return new Response("Room not found", { status: 404 });
        }
      },
    });
    if (partyResponse) return partyResponse;
    return ${skDefaultName}.fetch(request, env, ctx);
  },
};
`;

writeFileSync(workerPath, patched, "utf8");
console.log("patch-worker: Patched src/worker.ts with GameRoom export + PartyServer routing.");
