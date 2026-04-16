/**
 * GET /api/rooms/[code]/exists — proxy the DO liveness check.
 *
 * Returns 200 with { exists: true, playerCount } if the room is live,
 * or 404 JSON if the DO has been reaped / never existed.
 *
 * Source: PATTERNS.md §src/routes/api/rooms/[code]/exists/+server.ts
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ params, platform }) => {
  if (!platform?.env) error(500, "Platform unavailable");
  const stub = platform.env.GameRoom.get(
    platform.env.GameRoom.idFromName(params.code)
  );
  const res = await stub
    .fetch("https://do/exists", {
      headers: { "x-partykit-room": params.code },
    })
    .catch(() => null);
  if (!res || !res.ok) error(404, { message: "Room not found" });
  // Cast: Cloudflare workers-types and Web API Response are structurally
  // compatible at runtime; the type mismatch is a tsconfig collision between
  // @cloudflare/workers-types and lib.dom. Cast through unknown to satisfy
  // SvelteKit's RequestHandler return type.
  return res as unknown as Response;
};
