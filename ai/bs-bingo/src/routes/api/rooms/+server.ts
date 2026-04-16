/**
 * POST /api/rooms — create a new game room.
 *
 * Generates a 6-char code from the unambiguous alphabet, verifies it is
 * unused (DO does not exist), and returns { code, shareUrl }.
 *
 * Collision handling: 5-attempt retry loop. At Bullshit Bingo scale
 * (31^6 ≈ 887M combinations) collisions are astronomically unlikely,
 * but the loop is included per RESEARCH.md Pattern 4.
 *
 * Source: PATTERNS.md §src/routes/api/rooms/+server.ts
 */

import { json, error } from "@sveltejs/kit";
import { makeRoomCode } from "$lib/util/roomCode.js";
import type { RequestHandler } from "./$types.js";

export const POST: RequestHandler = async ({ platform, url }) => {
  if (!platform?.env) error(500, "Platform unavailable");
  const env = platform.env;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const stub = env.GameRoom.get(env.GameRoom.idFromName(code));
    const res = await stub.fetch("https://do/exists").catch(() => null);
    // A non-ok response means the DO has no room (never existed or reaped) →
    // safe to use this code.
    if (!res || !res.ok) {
      return json({ code, shareUrl: `${url.origin}/join/${code}` });
    }
  }

  error(500, "Could not allocate a room code");
};
