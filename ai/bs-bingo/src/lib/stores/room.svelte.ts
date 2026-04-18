import { PartySocket } from "partysocket";
import * as v from "valibot";
import {
  ServerMessage,
  PARTY_NAME as _PARTY_NAME,
  type RoomState,
  type WordEntry,
  type ClientMessage,
  type BoardCell,
  type WinningLine,
} from "$lib/protocol/messages";
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
  let words = $state<WordEntry[]>([]);
  let usedPacks = $state<Set<string>>(new Set());
  let lastError = $state<{ code: string; message?: string } | null>(null);
  let board = $state<BoardCell[] | null>(null);
  let playerMarks = $state<Record<string, number>>({});
  let markedCellIds = $state<Set<string>>(new Set());
  let winner = $state<{ playerId: string; displayName: string } | null>(null);
  let winningLine = $state<WinningLine | null>(null);
  let winningCellIds = $state<string[]>([]);

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
        words = msg.state.words ?? [];
        usedPacks = new Set(msg.state.usedPacks ?? []);
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
        lastError = { code: msg.code, message: msg.message };
        break;
      case "gameStarted":
        if (state) state = { ...state, phase: "playing" };
        break;
      case "wordAdded":
        if (!words.some((w) => w.wordId === msg.word.wordId)) {
          words = [...words, msg.word];
        }
        break;
      case "wordRemoved":
        words = words.filter((w) => w.wordId !== msg.wordId);
        break;
      case "boardAssigned":
        board = msg.cells;
        // Fresh board → no marks yet. Reassign (Pitfall 3) — never mutate existing Set.
        markedCellIds = new Set();
        break;
      case "wordMarked":
        // Reassign the object (Pitfall 3 analog) so runes see the change.
        playerMarks = { ...playerMarks, [msg.playerId]: msg.markCount };
        break;
      case "winDeclared": {
        winner = { playerId: msg.winnerId, displayName: msg.winnerName };
        winningLine = msg.winningLine;
        winningCellIds = msg.winningCellIds;
        if (state) state = { ...state, phase: "ended" };

        // Fire confetti ONLY on the winner's client, ONLY in a browser.
        // Dynamic import keeps canvas-confetti out of the SSR bundle (Pitfall 3).
        if (typeof window !== "undefined" && msg.winnerId === player.playerId) {
          import("canvas-confetti")
            .then(({ default: confetti }) => {
              const reduce =
                typeof window.matchMedia === "function" &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              confetti(
                reduce
                  ? {
                      particleCount: 60,
                      spread: 90,
                      ticks: 100,
                      origin: { y: 0.25 },
                      colors: ["#F5D547", "#F5F5F7", "#F87171"],
                    }
                  : {
                      particleCount: 180,
                      spread: 90,
                      startVelocity: 45,
                      ticks: 220,
                      origin: { y: 0.25 },
                      colors: ["#F5D547", "#F5F5F7", "#F87171"],
                    }
              );
            })
            .catch(() => {
              // Silent — EndScreen still renders if the module fails to load.
            });
        }
        break;
      }
      case "gameReset": {
        board = null;
        markedCellIds = new Set();
        playerMarks = {};
        winner = null;
        winningLine = null;
        winningCellIds = [];
        if (state) state = { ...state, phase: "lobby" };
        break;
      }
    }
  });

  return {
    get state() {
      return state;
    },
    get status() {
      return status;
    },
    send(msg: ClientMessage) {
      ws.send(JSON.stringify(msg));
    },
    get words() {
      return words;
    },
    get usedPacks() {
      return usedPacks;
    },
    get lastError() {
      return lastError;
    },
    clearError() {
      lastError = null;
    },
    disconnect() {
      ws.close();
      connection.status = "closed";
    },
    get board() {
      return board;
    },
    get playerMarks() {
      return playerMarks;
    },
    get markedCellIds() {
      return markedCellIds;
    },
    toggleMark(cellId: string) {
      // Optimistic local flip — reassign Set (Pitfall 3) so rune reactivity fires.
      const next = new Set(markedCellIds);
      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      markedCellIds = next;
      ws.send(JSON.stringify({ type: "markWord", cellId }));
    },
    get winner() {
      return winner;
    },
    get winningLine() {
      return winningLine;
    },
    get winningCellIds() {
      return winningCellIds;
    },
    startNewGame() {
      ws.send(JSON.stringify({ type: "startNewGame" }));
    },
  };
}
