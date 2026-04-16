import { PartySocket } from "partysocket";
import * as v from "valibot";
import { ServerMessage, PARTY_NAME as _PARTY_NAME, type RoomState } from "$lib/protocol/messages";
import { getOrCreatePlayer } from "$lib/session";

// Re-export PARTY_NAME for tests and other consumers
export const PARTY_NAME = _PARTY_NAME;

// Global-overlay status the layout's Banner reads. Set by whatever room page is mounted.
export const connection = $state<{
  status: "idle" | "connecting" | "open" | "reconnecting" | "closed";
}>({ status: "idle" });

export function createRoomStore(code: string) {
  const player = getOrCreatePlayer(code);

  let state = $state<RoomState | null>(null);
  let status = $state<"connecting" | "open" | "reconnecting" | "closed">("connecting");

  connection.status = "connecting";

  // host: use current page origin so PartySocket connects to the same-origin Worker
  // (Works for both wrangler dev at localhost:8787 and production Cloudflare deploy)
  const host = typeof window !== "undefined" ? window.location.host : "localhost:8787";
  const ws = new PartySocket({ host, party: PARTY_NAME, room: code });

  ws.addEventListener("open", () => {
    status = "open";
    connection.status = "open";
    ws.send(
      JSON.stringify({
        type: "hello",
        playerId: player.playerId,
        displayName: player.displayName,
      })
    );
  });

  ws.addEventListener("close", () => {
    status = "reconnecting";
    connection.status = "reconnecting";
  });

  ws.addEventListener("error", () => {
    status = "reconnecting";
    connection.status = "reconnecting";
  });

  ws.addEventListener("message", (ev) => {
    const parsed = v.safeParse(ServerMessage, JSON.parse((ev as MessageEvent).data));
    if (!parsed.success) return;
    const msg = parsed.output;
    switch (msg.type) {
      case "roomState":
        state = msg.state;
        break;
      case "playerJoined":
        if (state && !state.players.some((p) => p.playerId === msg.player.playerId)) {
          state.players = [...state.players, msg.player];
        }
        break;
      case "playerLeft":
        if (state) state.players = state.players.filter((p) => p.playerId !== msg.playerId);
        break;
      case "error":
        console.warn("Server error:", msg.code, msg.message);
        break;
    }
  });

  return {
    get state() {
      return state;
    },
    get status() {
      return status;
    },
    disconnect() {
      ws.close();
      connection.status = "closed";
    },
  };
}
