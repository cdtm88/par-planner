/**
 * GameRoom Durable Object — authoritative per-room server.
 *
 * One instance per 6-char room code. Holds game state in memory.
 * WebSocket Hibernation is enabled so idle rooms cost near-zero.
 *
 * Sources:
 *   - RESEARCH.md Pattern 1 (lines 299–410)
 *   - RESEARCH.md Pitfalls 2, 6, 8
 *   - CONTEXT.md D-14 (host transfer deferred to Phase 5)
 */

import { Server, type Connection, type ConnectionContext } from "partyserver";
import * as v from "valibot";
import {
  ClientMessage,
  type Player,
  type RoomState,
} from "../src/lib/protocol/messages.js";

// 30 minutes idle before the room is reaped (RESEARCH.md §Open Question 2, A1).
const IDLE_TTL_MS = 30 * 60 * 1000;

type Env = { GameRoom: DurableObjectNamespace };

export class GameRoom extends Server<Env> {
  // CRITICAL: opt into WebSocket Hibernation API — RESEARCH.md Pitfall 2.
  static options = { hibernate: true };

  // In-memory state — ephemeral by design (Phase 1 TTL model).
  #hostId: string | null = null;
  #players = new Map<string, Player>();
  #createdAt = 0;
  // #active is set to true only after POST /create is called by the API layer.
  // This distinguishes "room was formally created" from "DO was just instantiated".
  #active = false;

  async onStart() {
    this.#active = (await this.ctx.storage.get<boolean>("active")) ?? false;
    this.#createdAt = Date.now();
    // Schedule idle reaper — fires after IDLE_TTL_MS with no activity.
    this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
  }

  onConnect(_conn: Connection, _ctx: ConnectionContext) {
    // Admit the connection and wait for the client's `hello` before adding
    // them to the roster. We don't yet have their playerId or displayName.
  }

  onMessage(conn: Connection, raw: string | ArrayBuffer) {
    // Guard: parse JSON safely.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw as string);
    } catch {
      conn.send(JSON.stringify({ type: "error", code: "bad_message" }));
      return;
    }

    // Guard: validate against schema (RESEARCH.md Pitfall — T-01-02-02).
    const result = v.safeParse(ClientMessage, parsed);
    if (!result.success) {
      conn.send(JSON.stringify({ type: "error", code: "bad_message" }));
      return;
    }

    switch (result.output.type) {
      case "hello": {
        const { playerId, displayName } = result.output;

        // RESEARCH.md Pitfall 8: only assign host when BOTH conditions hold.
        const isFirst = this.#players.size === 0 && this.#hostId === null;
        if (isFirst) this.#hostId = playerId;

        const player: Player = {
          playerId,
          displayName,
          isHost: playerId === this.#hostId,
          joinedAt: Date.now(),
        };
        this.#players.set(playerId, player);

        // Tag connection so onClose knows which player left.
        conn.setState({ playerId });

        // Send full snapshot to the newcomer only.
        conn.send(
          JSON.stringify({
            type: "roomState",
            state: this.#snapshot(),
          })
        );

        // Broadcast playerJoined to everyone else (exclude this connection).
        this.broadcast(
          JSON.stringify({
            type: "playerJoined",
            player,
          }),
          [conn.id]
        );
        return;
      }

      case "ping": {
        conn.send(JSON.stringify({ type: "pong" }));
        return;
      }
    }
  }

  onClose(
    conn: Connection,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ) {
    const state = conn.state as { playerId?: string } | null;
    if (!state?.playerId) return;
    const player = this.#players.get(state.playerId);
    if (!player) return;

    this.#players.delete(state.playerId);

    this.broadcast(
      JSON.stringify({
        type: "playerLeft",
        playerId: state.playerId,
      })
    );

    // D-14: host transfer deferred to Phase 5 (RESI-05).
    // If the host leaves, #hostId stays as-is — room is effectively orphaned
    // for Phase 1. Acceptable per CONTEXT.md D-14.
  }

  async onAlarm() {
    if (this.#players.size === 0) {
      // Reap: wipe storage so the DO instance can be garbage-collected.
      await this.ctx.storage.deleteAll();
      return;
    }
    // Still alive with players — extend the alarm.
    this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
  }

  onRequest(request: Request): Response {
    const url = new URL(request.url);

    // POST /create — called by POST /api/rooms to mark the room as formally created.
    // Returns 200 on first call; 409 if already active.
    if (request.method === "POST" && url.pathname.endsWith("/create")) {
      if (this.#active) {
        return new Response(JSON.stringify({ error: "already_exists" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
      this.#active = true;
      void this.ctx.storage.put("active", true);
      return new Response(JSON.stringify({ created: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /exists — returns 200 only if the room was formally created.
    if (url.pathname.endsWith("/exists")) {
      if (!this.#active) {
        return new Response(JSON.stringify({ exists: false }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ exists: true, playerCount: this.#players.size }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  }

  #snapshot(): RoomState {
    return {
      code: this.name, // DO's idFromName string — set by PartyServer from room name
      phase: "lobby",
      hostId: this.#hostId,
      players: [...this.#players.values()],
    };
  }
}
