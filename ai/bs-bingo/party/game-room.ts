/**
 * GameRoom Durable Object — authoritative per-room server.
 *
 * One instance per 6-char room code. Holds game state in memory.
 * WebSocket Hibernation is enabled so idle rooms cost near-zero.
 *
 * Hibernation-safety: in-memory class fields are wiped whenever the DO
 * hibernates. Every mutation is mirrored to `ctx.storage`, and `onStart()`
 * rehydrates fields from storage on wake. Without this, the DO wakes up
 * with `#hostId = null` and silently drops host-only messages like
 * `startGame` (see .planning/debug/start-game-button-no-board.md).
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
  type WordEntry,
  type BoardCell,
} from "../src/lib/protocol/messages.js";
import { STARTER_PACKS } from "../src/lib/util/starterPacks.js";
import { shuffle } from "../src/lib/util/shuffle.js";
import { deriveGridTier } from "../src/lib/util/gridTier.js";
import { detectWin } from "../src/lib/util/winLine.js";
import { nanoid } from "nanoid";

// 30 minutes idle before the room is reaped (RESEARCH.md §Open Question 2, A1).
const IDLE_TTL_MS = 30 * 60 * 1000;

// Storage keys — kept narrow and explicit so onStart can rehydrate cleanly.
const K_ACTIVE = "active";
const K_HOST_ID = "hostId";
const K_PLAYERS = "players";      // Player[]
const K_WORDS = "words";          // WordEntry[]
const K_PHASE = "phase";          // "lobby" | "playing" | "ended"
const K_USED_PACKS = "usedPacks"; // string[]
const K_BOARDS = "boards";        // Array<[playerId, BoardCell[]]>
const K_MARKS = "marks";          // Array<[playerId, string[]]>

type Env = { GameRoom: DurableObjectNamespace };

export class GameRoom extends Server<Env> {
  // CRITICAL: opt into WebSocket Hibernation API — RESEARCH.md Pitfall 2.
  static options = { hibernate: true };

  // In-memory state — rehydrated from storage in onStart() on wake.
  #hostId: string | null = null;
  #players = new Map<string, Player>();
  #createdAt = 0;
  // #active is set to true only after POST /create is called by the API layer.
  // This distinguishes "room was formally created" from "DO was just instantiated".
  #active = false;
  #words = new Map<string, WordEntry>();
  #phase: "lobby" | "playing" | "ended" = "lobby";
  #usedPacks = new Set<string>();
  #boards = new Map<string, BoardCell[]>();   // playerId → that player's cells
  #marks = new Map<string, Set<string>>();    // playerId → set of marked cellIds

  async onStart() {
    // Rehydrate every field that must survive hibernation. Without this,
    // post-wake host-only guards (startGame, loadStarterPack) silently drop
    // messages because #hostId is null.
    const [
      active,
      hostId,
      players,
      words,
      phase,
      usedPacks,
      boards,
      marks,
    ] = await Promise.all([
      this.ctx.storage.get<boolean>(K_ACTIVE),
      this.ctx.storage.get<string | null>(K_HOST_ID),
      this.ctx.storage.get<Player[]>(K_PLAYERS),
      this.ctx.storage.get<WordEntry[]>(K_WORDS),
      this.ctx.storage.get<"lobby" | "playing" | "ended">(K_PHASE),
      this.ctx.storage.get<string[]>(K_USED_PACKS),
      this.ctx.storage.get<Array<[string, BoardCell[]]>>(K_BOARDS),
      this.ctx.storage.get<Array<[string, string[]]>>(K_MARKS),
    ]);

    this.#active = active ?? false;
    this.#hostId = hostId ?? null;
    this.#players = new Map((players ?? []).map((p) => [p.playerId, p]));
    this.#words = new Map((words ?? []).map((w) => [w.wordId, w]));
    this.#phase = phase ?? "lobby";
    this.#usedPacks = new Set(usedPacks ?? []);
    this.#boards = new Map(boards ?? []);
    this.#marks = new Map((marks ?? []).map(([pid, ids]) => [pid, new Set(ids)]));

    this.#createdAt = Date.now();
    // Schedule idle reaper — fires after IDLE_TTL_MS with no activity.
    this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
  }

  // --- Persistence helpers ---------------------------------------------------
  // Each mutation writes exactly what changed. Fire-and-forget (void) — DO
  // storage writes are durable before the response returns on the same request,
  // which is sufficient for our per-room coordination model.

  #persistHostId() {
    void this.ctx.storage.put(K_HOST_ID, this.#hostId);
  }
  #persistPlayers() {
    void this.ctx.storage.put(K_PLAYERS, [...this.#players.values()]);
  }
  #persistWords() {
    void this.ctx.storage.put(K_WORDS, [...this.#words.values()]);
  }
  #persistPhase() {
    void this.ctx.storage.put(K_PHASE, this.#phase);
  }
  #persistUsedPacks() {
    void this.ctx.storage.put(K_USED_PACKS, [...this.#usedPacks]);
  }
  #persistBoards() {
    void this.ctx.storage.put(K_BOARDS, [...this.#boards.entries()]);
  }
  #persistMarks() {
    const serialized: Array<[string, string[]]> = [];
    for (const [pid, ids] of this.#marks) serialized.push([pid, [...ids]]);
    void this.ctx.storage.put(K_MARKS, serialized);
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
        if (isFirst) {
          this.#hostId = playerId;
          this.#persistHostId();
        }

        const player: Player = {
          playerId,
          displayName,
          isHost: playerId === this.#hostId,
          joinedAt: Date.now(),
        };
        this.#players.set(playerId, player);
        this.#persistPlayers();

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

      case "submitWord": {
        const { text } = result.output;
        const normalized = text.trim();
        // Dedupe: synchronous check + insert — NEVER await between these (Pitfall 4)
        const exists = [...this.#words.values()].some(
          (w) => w.text.toLowerCase() === normalized.toLowerCase()
        );
        if (exists) {
          conn.send(JSON.stringify({
            type: "error",
            code: "duplicate_word",
            message: `"${normalized}" is already in the pool`,
          }));
          return;
        }
        const wordId = nanoid();
        const connState = conn.state as { playerId?: string } | null;
        const entry: WordEntry = {
          wordId,
          text: normalized,
          submittedBy: connState?.playerId ?? "unknown",
        };
        this.#words.set(wordId, entry);
        this.#persistWords();
        this.broadcast(JSON.stringify({ type: "wordAdded", word: entry }));
        return;
      }

      case "removeWord": {
        const { wordId } = result.output;
        const entry = this.#words.get(wordId);
        if (!entry) return; // idempotent
        const connState = conn.state as { playerId?: string } | null;
        if (entry.submittedBy !== connState?.playerId) {
          conn.send(JSON.stringify({ type: "error", code: "not_owner" }));
          return;
        }
        this.#words.delete(wordId);
        this.#persistWords();
        this.broadcast(JSON.stringify({ type: "wordRemoved", wordId }));
        return;
      }

      case "loadStarterPack": {
        const connState = conn.state as { playerId?: string } | null;
        if (connState?.playerId !== this.#hostId) return; // host-only, silent ignore
        const { pack } = result.output;
        if (this.#usedPacks.has(pack)) return; // once-per-session
        this.#usedPacks.add(pack);
        this.#persistUsedPacks();
        const packWords = STARTER_PACKS[pack as keyof typeof STARTER_PACKS];
        let wordsChanged = false;
        for (const text of packWords) {
          const alreadyIn = [...this.#words.values()].some(
            (w) => w.text.toLowerCase() === text.toLowerCase()
          );
          if (alreadyIn) continue;
          const wordId = nanoid();
          // Use host's playerId (not "pack") so host can delete pack words (Pitfall 3)
          const entry: WordEntry = { wordId, text, submittedBy: connState.playerId! };
          this.#words.set(wordId, entry);
          wordsChanged = true;
          this.broadcast(JSON.stringify({ type: "wordAdded", word: entry }));
        }
        if (wordsChanged) this.#persistWords();
        return;
      }

      case "startGame": {
        const connState = conn.state as { playerId?: string } | null;
        if (connState?.playerId !== this.#hostId) return;          // host-only guard
        if (this.#words.size < 5) {
          conn.send(JSON.stringify({ type: "error", code: "not_enough_words" }));
          return;
        }
        this.#phase = "playing";
        this.#persistPhase();

        // PITFALL 8: broadcast gameStarted FIRST so every client mounts <Board/> before
        // their boardAssigned arrives. WS is FIFO per connection, so this ordering is
        // visible to each client in the same order it leaves the DO.
        this.broadcast(JSON.stringify({ type: "gameStarted" }));

        // Per-connection private board delivery (BOAR-03 — NEVER broadcast).
        const wordPool = [...this.#words.values()];
        for (const c of this.getConnections()) {
          const s = c.state as { playerId?: string } | null;
          if (!s?.playerId) continue;                                // pre-hello connection — skip
          const cells = this.#buildBoardForPlayer(wordPool);
          this.#boards.set(s.playerId, cells);
          this.#marks.set(s.playerId, new Set());
          c.send(JSON.stringify({ type: "boardAssigned", cells }));
        }
        this.#persistBoards();
        this.#persistMarks();
        return;
      }

      case "markWord": {
        const connState = conn.state as { playerId?: string } | null;
        if (!connState?.playerId) return;                            // pre-hello — silent drop
        if (this.#phase !== "playing") return;                       // phase guard

        const myBoard = this.#boards.get(connState.playerId);
        const myMarks = this.#marks.get(connState.playerId);
        if (!myBoard || !myMarks) return;                            // board not dealt — silent drop

        const { cellId } = result.output;

        // AUTHORIZATION (V4 Access Control / T-3-02):
        // The cellId must be on THIS player's own board, not blank.
        const cell = myBoard.find((c) => c.cellId === cellId);
        if (!cell || cell.blank) return;                             // not owner's cell OR blank — silent drop

        // Toggle — UI-SPEC: second tap unmarks.
        if (myMarks.has(cellId)) myMarks.delete(cellId);
        else myMarks.add(cellId);
        this.#persistMarks();

        // BROADCAST: strict payload shape — no layout fields (BOAR-06).
        this.broadcast(JSON.stringify({
          type: "wordMarked",
          playerId: connState.playerId,
          markCount: myMarks.size,
        }));

        // Phase 4: server-authoritative win detection (WIN-01, WIN-02).
        // Runs AFTER #persistMarks() + wordMarked broadcast so peers see the
        // final badge count before the announcement and a hibernation mid-flow
        // cannot lose the mark (Pitfall 1 / Pitfall 2).
        const win = detectWin(myBoard, myMarks);
        if (!win) return;

        this.#phase = "ended";
        this.#persistPhase();

        const winnerPlayer = this.#players.get(connState.playerId);
        const winnerName = winnerPlayer?.displayName ?? "Someone";

        this.broadcast(JSON.stringify({
          type: "winDeclared",
          winnerId: connState.playerId,
          winnerName,
          winningLine: win.winningLine,
          winningCellIds: win.winningCellIds,
        }));
        return;
      }

      case "startNewGame": {
        // WIN-05 / D-09 / D-13: only the current host may return the room to
        // lobby. Pre-hello and non-host senders are silently dropped.
        const connState = conn.state as { playerId?: string } | null;
        if (!connState?.playerId) return;              // pre-hello — silent drop
        if (connState.playerId !== this.#hostId) return; // non-host — silent drop

        // Clear only the per-game state. Retain #players, #hostId, #words,
        // #usedPacks so the same roster can immediately start another round.
        this.#boards.clear();
        this.#marks.clear();
        this.#phase = "lobby";

        // Persist-then-broadcast ordering (Pitfall 1/2): a hibernation between
        // the broadcast and the puts would leave in-memory and storage out of
        // sync on rehydrate. Persist all three before announcing.
        this.#persistBoards();
        this.#persistMarks();
        this.#persistPhase();

        this.broadcast(JSON.stringify({ type: "gameReset" }));
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
    this.#persistPlayers();

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
      void this.ctx.storage.put(K_ACTIVE, true);
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

  #buildBoardForPlayer(wordPool: WordEntry[]): BoardCell[] {
    const tier = deriveGridTier(wordPool.length);
    const cellCount = tier === "5x5" ? 25 : tier === "4x4" ? 16 : 9;

    // Copy-per-player (Pitfall 5: never reuse the shuffled array across players).
    const shuffled = shuffle([...wordPool]);
    const wordCells: BoardCell[] = shuffled.slice(0, cellCount).map((w) => ({
      cellId: nanoid(),
      wordId: w.wordId,
      text: w.text,
      blank: false,
    }));
    const blankCount = Math.max(0, cellCount - wordCells.length);
    const blankCells: BoardCell[] = Array.from({ length: blankCount }, () => ({
      cellId: nanoid(),
      wordId: null,
      text: null,
      blank: true,
    }));

    // Fill-tail then shuffle the combined array so blanks are uniformly distributed.
    return shuffle([...wordCells, ...blankCells]);
  }

  #snapshot(): RoomState {
    return {
      code: this.name, // DO's idFromName string — set by PartyServer from room name
      phase: this.#phase,
      hostId: this.#hostId,
      players: [...this.#players.values()],
      words: [...this.#words.values()],
      usedPacks: [...this.#usedPacks],
    };
  }
}
