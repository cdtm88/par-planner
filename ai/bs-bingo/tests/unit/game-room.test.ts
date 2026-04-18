/**
 * Unit tests for GameRoom Durable Object (TDD RED phase).
 *
 * Strategy: We test the GameRoom class by subclassing it with a fake Server base
 * that stubs out the PartyServer runtime (ctx, broadcast, getConnections, etc.).
 * We drive `onMessage` / `onClose` directly on the instance.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fake runtime primitives
// ---------------------------------------------------------------------------

function makeConn(
  id: string,
  overrides?: Partial<FakeConn>
): FakeConn {
  const sent: string[] = [];
  const conn: FakeConn = {
    id,
    state: null as unknown,
    send(msg: string) {
      sent.push(msg);
    },
    setState(s: unknown) {
      conn.state = s;
      return s;
    },
    _sent: sent,
    ...overrides,
  };
  return conn;
}

interface FakeConn {
  id: string;
  state: unknown;
  send(msg: string): void;
  setState(s: unknown): unknown;
  _sent: string[];
}

// ---------------------------------------------------------------------------
// We need to stub the PartyServer `Server` base class because it imports from
// "cloudflare:workers" which isn't available in the Vitest jsdom environment.
// We mock "partyserver" so that `Server` is a plain JS class with no CF deps.
// ---------------------------------------------------------------------------

vi.mock("partyserver", () => {
  class FakeServer {
    static options = { hibernate: false };
    ctx: { storage: { setAlarm: ReturnType<typeof vi.fn>; deleteAll: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> } };
    // PartyServer exposes `this.name` from storage; we allow tests to set it.
    _name: string = "TESTAB";

    constructor() {
      this.ctx = {
        storage: {
          setAlarm: vi.fn(),
          deleteAll: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
        },
      };
    }

    get name(): string {
      return this._name;
    }

    // broadcast is provided by PartyServer at runtime; we stub it here.
    broadcast = vi.fn();

    // getConnections is provided by PartyServer at runtime; default returns empty iterable.
    // Phase 3 tests override this per-instance in their beforeEach.
    getConnections(): Iterable<unknown> {
      return [];
    }

    // Lifecycle stubs — subclass overrides.
    onStart() {}
    onConnect(_conn: unknown, _ctx: unknown) {}
    onMessage(_conn: unknown, _msg: unknown) {}
    onClose(_conn: unknown, _code: number, _reason: string, _clean: boolean) {}
    onAlarm() {}
    onRequest(_req: unknown): unknown {
      return new Response("Not Found", { status: 404 });
    }
  }

  return { Server: FakeServer, routePartykitRequest: vi.fn() };
});

// ---------------------------------------------------------------------------
// Import GameRoom AFTER the mock is registered.
// ---------------------------------------------------------------------------

const { GameRoom } = await import("../../party/game-room.js");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GameRoom", () => {
  let room: InstanceType<typeof GameRoom>;

  beforeEach(() => {
    room = new GameRoom({} as never, {} as never);
    // Reset broadcast mock
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // First hello → become host
  // -------------------------------------------------------------------------

  it("first hello sets hostId and sends roomState to newcomer, broadcasts playerJoined to others", () => {
    const conn1 = makeConn("conn-1");

    room.onMessage(conn1 as never, JSON.stringify({
      type: "hello",
      playerId: "player-abc",
      displayName: "Alice",
    }));

    // conn1 should receive roomState
    expect(conn1._sent).toHaveLength(1);
    const roomState = JSON.parse(conn1._sent[0]);
    expect(roomState.type).toBe("roomState");
    expect(roomState.state.hostId).toBe("player-abc");
    expect(roomState.state.players).toHaveLength(1);
    expect(roomState.state.players[0].isHost).toBe(true);
    expect(roomState.state.players[0].playerId).toBe("player-abc");
    expect(roomState.state.phase).toBe("lobby");
    expect(roomState.state.code).toBe("TESTAB");

    // broadcast should fire for playerJoined (excluding conn1)
    expect((room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast).toHaveBeenCalledOnce();
    const broadcastArg = JSON.parse(
      (room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast.mock.calls[0][0] as string
    );
    expect(broadcastArg.type).toBe("playerJoined");
    expect(broadcastArg.player.playerId).toBe("player-abc");

    // conn1 should be tagged with playerId via setState
    expect(conn1.state).toEqual({ playerId: "player-abc" });
  });

  // -------------------------------------------------------------------------
  // Second hello → NOT host, host unchanged
  // -------------------------------------------------------------------------

  it("second hello is not host; players map grows to 2; hostId unchanged", () => {
    const conn1 = makeConn("conn-1");
    const conn2 = makeConn("conn-2");

    room.onMessage(conn1 as never, JSON.stringify({
      type: "hello",
      playerId: "player-abc",
      displayName: "Alice",
    }));

    vi.clearAllMocks(); // reset broadcast count

    room.onMessage(conn2 as never, JSON.stringify({
      type: "hello",
      playerId: "player-def",
      displayName: "Bob",
    }));

    // conn2 should receive roomState with 2 players
    expect(conn2._sent).toHaveLength(1);
    const state2 = JSON.parse(conn2._sent[0]);
    expect(state2.type).toBe("roomState");
    expect(state2.state.players).toHaveLength(2);
    expect(state2.state.hostId).toBe("player-abc"); // unchanged
    expect(state2.state.players.find((p: { playerId: string }) => p.playerId === "player-def")?.isHost).toBe(false);

    // broadcast for playerJoined
    expect((room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast).toHaveBeenCalledOnce();
    const broadcastArg = JSON.parse(
      (room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast.mock.calls[0][0] as string
    );
    expect(broadcastArg.type).toBe("playerJoined");
    expect(broadcastArg.player.playerId).toBe("player-def");
  });

  // -------------------------------------------------------------------------
  // Malformed payload → error sent, state unchanged
  // -------------------------------------------------------------------------

  it("malformed JSON triggers error response and leaves state unchanged", () => {
    const conn = makeConn("conn-bad");

    room.onMessage(conn as never, "not json at all {{{{");

    expect(conn._sent).toHaveLength(1);
    const err = JSON.parse(conn._sent[0]);
    expect(err.type).toBe("error");
    expect(err.code).toBe("bad_message");

    // No broadcast should have fired
    expect((room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast).not.toHaveBeenCalled();
  });

  it("schema-failing payload triggers error response and leaves state unchanged", () => {
    const conn = makeConn("conn-schema");

    room.onMessage(conn as never, JSON.stringify({ type: "unknown_type", foo: "bar" }));

    expect(conn._sent).toHaveLength(1);
    const err = JSON.parse(conn._sent[0]);
    expect(err.type).toBe("error");
    expect(err.code).toBe("bad_message");

    expect((room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // onClose → playerLeft broadcast, player removed
  // -------------------------------------------------------------------------

  it("onClose removes player and broadcasts playerLeft", () => {
    const conn1 = makeConn("conn-1");
    const conn2 = makeConn("conn-2");

    room.onMessage(conn1 as never, JSON.stringify({ type: "hello", playerId: "p1", displayName: "Alice" }));
    room.onMessage(conn2 as never, JSON.stringify({ type: "hello", playerId: "p2", displayName: "Bob" }));

    vi.clearAllMocks();

    // Simulate conn1 disconnect
    room.onClose(conn1 as never, 1000, "", true);

    expect((room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast).toHaveBeenCalledOnce();
    const broadcastArg = JSON.parse(
      (room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast.mock.calls[0][0] as string
    );
    expect(broadcastArg.type).toBe("playerLeft");
    expect(broadcastArg.playerId).toBe("p1");

    // After leaving, a new hello sends roomState with only p2
    const conn3 = makeConn("conn-3");
    room.onMessage(conn3 as never, JSON.stringify({ type: "hello", playerId: "p3", displayName: "Carol" }));
    const state = JSON.parse(conn3._sent[0]);
    expect(state.state.players).toHaveLength(2); // p2 + p3
    expect(state.state.players.find((p: { playerId: string }) => p.playerId === "p1")).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // onRequest → POST /create activates room; GET /exists guards on #active
  // -------------------------------------------------------------------------

  it("onRequest POST /create returns 200 and activates room", async () => {
    const req = new Request("https://do/parties/game-room/TESTAB/create", { method: "POST" });
    const resp = room.onRequest(req as never) as Response;
    expect(resp.status).toBe(200);
    const body = await resp.json() as { created: boolean };
    expect(body.created).toBe(true);
  });

  it("onRequest POST /create returns 409 on second call (already active)", async () => {
    const req1 = new Request("https://do/parties/game-room/TESTAB/create", { method: "POST" });
    room.onRequest(req1 as never);
    const req2 = new Request("https://do/parties/game-room/TESTAB/create", { method: "POST" });
    const resp = room.onRequest(req2 as never) as Response;
    expect(resp.status).toBe(409);
  });

  it("onRequest GET /exists returns 404 before POST /create", async () => {
    const req = new Request("https://do/parties/game-room/TESTAB/exists");
    const resp = room.onRequest(req as never) as Response;
    expect(resp.status).toBe(404);
  });

  it("onRequest GET /exists returns 200 after POST /create", async () => {
    const createReq = new Request("https://do/parties/game-room/TESTAB/create", { method: "POST" });
    room.onRequest(createReq as never);
    const existsReq = new Request("https://do/parties/game-room/TESTAB/exists");
    const resp = room.onRequest(existsReq as never) as Response;
    expect(resp.status).toBe(200);
    const body = await resp.json() as { exists: boolean; playerCount: number };
    expect(body.exists).toBe(true);
    expect(body.playerCount).toBe(0);
  });

  it("onRequest at unknown path returns 404", () => {
    const req = new Request("https://do/parties/game-room/TESTAB/other");
    const resp = room.onRequest(req as never) as Response;
    expect(resp.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // onAlarm — reaps empty rooms
  // -------------------------------------------------------------------------

  it("onAlarm with no players calls ctx.storage.deleteAll", async () => {
    await room.onAlarm();
    expect((room as unknown as { ctx: { storage: { deleteAll: ReturnType<typeof vi.fn> } } }).ctx.storage.deleteAll).toHaveBeenCalledOnce();
  });

  it("onAlarm with players re-arms alarm", async () => {
    const conn = makeConn("conn-1");
    room.onMessage(conn as never, JSON.stringify({ type: "hello", playerId: "p1", displayName: "Alice" }));
    vi.clearAllMocks();

    await room.onAlarm();

    expect((room as unknown as { ctx: { storage: { setAlarm: ReturnType<typeof vi.fn> } } }).ctx.storage.setAlarm).toHaveBeenCalledOnce();
    expect((room as unknown as { ctx: { storage: { deleteAll: ReturnType<typeof vi.fn> } } }).ctx.storage.deleteAll).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // static options
  // -------------------------------------------------------------------------

  it("has static options.hibernate = true", () => {
    expect((GameRoom as unknown as { options: { hibernate: boolean } }).options.hibernate).toBe(true);
  });

  // -------------------------------------------------------------------------
  // ping → pong
  // -------------------------------------------------------------------------

  it("ping message triggers pong response", () => {
    const conn = makeConn("conn-ping");
    room.onMessage(conn as never, JSON.stringify({ type: "ping" }));

    expect(conn._sent).toHaveLength(1);
    const pong = JSON.parse(conn._sent[0]);
    expect(pong.type).toBe("pong");
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Word pool tests
// ---------------------------------------------------------------------------

describe("GameRoom — word pool (Phase 2)", () => {
  let room: InstanceType<typeof GameRoom>;

  beforeEach(() => {
    room = new GameRoom({} as never, {} as never);
    vi.clearAllMocks();
  });

  function joinPlayer(conn: FakeConn, playerId: string, displayName: string) {
    room.onMessage(conn as never, JSON.stringify({ type: "hello", playerId, displayName }));
    vi.clearAllMocks();
  }

  function getBroadcast() {
    return (room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast;
  }

  it("submitWord adds word and broadcasts wordAdded", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");

    room.onMessage(conn as never, JSON.stringify({ type: "submitWord", text: "Synergy" }));

    expect(getBroadcast()).toHaveBeenCalledOnce();
    const msg = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(msg.type).toBe("wordAdded");
    expect(msg.word.text).toBe("Synergy");
    expect(msg.word.submittedBy).toBe("p1");
    expect(typeof msg.word.wordId).toBe("string");
  });

  it("submitWord duplicate (case-insensitive) sends error to submitter only", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");

    room.onMessage(conn as never, JSON.stringify({ type: "submitWord", text: "Synergy" }));
    vi.clearAllMocks();
    conn._sent.length = 0;

    room.onMessage(conn as never, JSON.stringify({ type: "submitWord", text: "synergy" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
    expect(conn._sent).toHaveLength(1);
    const err = JSON.parse(conn._sent[0]);
    expect(err.type).toBe("error");
    expect(err.code).toBe("duplicate_word");
  });

  it("submitWord trims whitespace", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");

    room.onMessage(conn as never, JSON.stringify({ type: "submitWord", text: "  Synergy  " }));

    const msg = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(msg.word.text).toBe("Synergy");
  });

  it("removeWord by owner removes and broadcasts wordRemoved", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");

    room.onMessage(conn as never, JSON.stringify({ type: "submitWord", text: "Synergy" }));
    const wordId = JSON.parse(getBroadcast().mock.calls[0][0]).word.wordId;
    vi.clearAllMocks();

    room.onMessage(conn as never, JSON.stringify({ type: "removeWord", wordId }));

    expect(getBroadcast()).toHaveBeenCalledOnce();
    const msg = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(msg.type).toBe("wordRemoved");
    expect(msg.wordId).toBe(wordId);
  });

  it("removeWord by non-owner sends not_owner error", () => {
    const conn1 = makeConn("c1");
    const conn2 = makeConn("c2");
    joinPlayer(conn1, "p1", "Alice");
    joinPlayer(conn2, "p2", "Bob");

    room.onMessage(conn1 as never, JSON.stringify({ type: "submitWord", text: "Synergy" }));
    const wordId = JSON.parse(getBroadcast().mock.calls[0][0]).word.wordId;
    vi.clearAllMocks();
    conn2._sent.length = 0;

    room.onMessage(conn2 as never, JSON.stringify({ type: "removeWord", wordId }));

    expect(getBroadcast()).not.toHaveBeenCalled();
    expect(conn2._sent).toHaveLength(1);
    const err = JSON.parse(conn2._sent[0]);
    expect(err.type).toBe("error");
    expect(err.code).toBe("not_owner");
  });

  it("removeWord for nonexistent wordId is idempotent", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");
    conn._sent.length = 0;

    room.onMessage(conn as never, JSON.stringify({ type: "removeWord", wordId: "nonexistent" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
    expect(conn._sent).toHaveLength(0);
  });

  it("loadStarterPack by host adds pack words with host's playerId", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");

    room.onMessage(conn as never, JSON.stringify({ type: "loadStarterPack", pack: "agile" }));

    // agile pack has 20 words
    expect(getBroadcast().mock.calls.length).toBe(20);
    const firstMsg = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(firstMsg.type).toBe("wordAdded");
    expect(firstMsg.word.submittedBy).toBe("p1");
  });

  it("loadStarterPack by non-host is silently ignored", () => {
    const conn1 = makeConn("c1");
    const conn2 = makeConn("c2");
    joinPlayer(conn1, "p1", "Alice");
    joinPlayer(conn2, "p2", "Bob");

    room.onMessage(conn2 as never, JSON.stringify({ type: "loadStarterPack", pack: "agile" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("loadStarterPack twice is silently ignored", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");

    room.onMessage(conn as never, JSON.stringify({ type: "loadStarterPack", pack: "agile" }));
    vi.clearAllMocks();

    room.onMessage(conn as never, JSON.stringify({ type: "loadStarterPack", pack: "agile" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("loadStarterPack silently skips duplicates already in pool", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");

    // "Sprint" is the first word in the agile pack
    room.onMessage(conn as never, JSON.stringify({ type: "submitWord", text: "Sprint" }));
    vi.clearAllMocks();

    room.onMessage(conn as never, JSON.stringify({ type: "loadStarterPack", pack: "agile" }));

    // agile pack has 20 words; 1 duplicate ("Sprint") should be skipped
    expect(getBroadcast().mock.calls.length).toBe(19);
  });

  it("startGame with < 5 words sends not_enough_words error", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");

    for (let i = 0; i < 4; i++) {
      room.onMessage(conn as never, JSON.stringify({ type: "submitWord", text: `Word${i}` }));
    }
    vi.clearAllMocks();
    conn._sent.length = 0;

    room.onMessage(conn as never, JSON.stringify({ type: "startGame" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
    expect(conn._sent).toHaveLength(1);
    const err = JSON.parse(conn._sent[0]);
    expect(err.type).toBe("error");
    expect(err.code).toBe("not_enough_words");
  });

  it("startGame with 5 words flips phase to playing and broadcasts gameStarted", () => {
    const conn = makeConn("c1");
    joinPlayer(conn, "p1", "Alice");

    for (let i = 0; i < 5; i++) {
      room.onMessage(conn as never, JSON.stringify({ type: "submitWord", text: `Word${i}` }));
    }
    vi.clearAllMocks();

    room.onMessage(conn as never, JSON.stringify({ type: "startGame" }));

    // Phase 3 change: startGame now broadcasts gameStarted (phase flip) instead of roomState.
    // Per-connection boardAssigned is sent separately via conn.send.
    expect(getBroadcast()).toHaveBeenCalled();
    const firstBroadcast = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(firstBroadcast.type).toBe("gameStarted");
  });

  it("startGame by non-host is silently ignored", () => {
    const conn1 = makeConn("c1");
    const conn2 = makeConn("c2");
    joinPlayer(conn1, "p1", "Alice");
    joinPlayer(conn2, "p2", "Bob");

    for (let i = 0; i < 5; i++) {
      room.onMessage(conn1 as never, JSON.stringify({ type: "submitWord", text: `Word${i}` }));
    }
    vi.clearAllMocks();

    room.onMessage(conn2 as never, JSON.stringify({ type: "startGame" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("roomState snapshot includes words and usedPacks", () => {
    const conn1 = makeConn("c1");
    const conn2 = makeConn("c2");
    joinPlayer(conn1, "p1", "Alice");

    room.onMessage(conn1 as never, JSON.stringify({ type: "submitWord", text: "Synergy" }));
    room.onMessage(conn1 as never, JSON.stringify({ type: "submitWord", text: "Leverage" }));
    room.onMessage(conn1 as never, JSON.stringify({ type: "loadStarterPack", pack: "agile" }));
    vi.clearAllMocks();
    conn2._sent.length = 0;

    // p2 joins — receives full snapshot
    room.onMessage(conn2 as never, JSON.stringify({ type: "hello", playerId: "p2", displayName: "Bob" }));

    expect(conn2._sent).toHaveLength(1);
    const snapshot = JSON.parse(conn2._sent[0]);
    expect(snapshot.type).toBe("roomState");
    expect(snapshot.state.words.length).toBeGreaterThan(0);
    expect(snapshot.state.usedPacks).toContain("agile");
  });
});

// ---------------------------------------------------------------------------
// Phase 3: Board generation + mark loop tests
// ---------------------------------------------------------------------------

describe("GameRoom — board & marks (Phase 3)", () => {
  let room: InstanceType<typeof GameRoom>;
  let conns: FakeConn[];

  beforeEach(() => {
    room = new GameRoom({} as never, {} as never);
    conns = [];
    // FakeServer does not provide getConnections; stub it to return the harness's conns list.
    (room as unknown as { getConnections: () => FakeConn[] }).getConnections = () => conns;
    vi.clearAllMocks();
  });

  function joinPlayer(conn: FakeConn, playerId: string, displayName: string) {
    conns.push(conn);
    room.onMessage(conn as never, JSON.stringify({ type: "hello", playerId, displayName }));
    vi.clearAllMocks();
    conn._sent.length = 0;
  }

  function addWords(conn: FakeConn, words: string[]) {
    for (const text of words) {
      room.onMessage(conn as never, JSON.stringify({ type: "submitWord", text }));
    }
  }

  function getBroadcast() {
    return (room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast;
  }

  function extractBoardFromConn(conn: FakeConn) {
    const msgStr = conn._sent.find((m) => JSON.parse(m).type === "boardAssigned");
    expect(msgStr, "conn should have received a boardAssigned message").toBeDefined();
    return JSON.parse(msgStr!) as { type: "boardAssigned"; cells: Array<{ cellId: string; wordId: string | null; text: string | null; blank: boolean }> };
  }

  it("startGame broadcasts gameStarted first, then sends per-connection boardAssigned (BOAR-01, BOAR-03)", () => {
    const host = makeConn("c1");
    const peer = makeConn("c2");
    joinPlayer(host, "p1", "Alice");
    joinPlayer(peer, "p2", "Bob");
    addWords(host, ["W1", "W2", "W3", "W4", "W5"]);
    vi.clearAllMocks();
    host._sent.length = 0; peer._sent.length = 0;

    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));

    // Broadcast fired with gameStarted
    expect(getBroadcast()).toHaveBeenCalled();
    const firstBroadcast = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(firstBroadcast.type).toBe("gameStarted");

    // Each connection received its own boardAssigned via conn.send (not broadcast)
    const hostBoard = extractBoardFromConn(host);
    const peerBoard = extractBoardFromConn(peer);
    expect(hostBoard.type).toBe("boardAssigned");
    expect(peerBoard.type).toBe("boardAssigned");
    // Per-player nanoid cellIds guarantee difference even if same permutation
    expect(hostBoard.cells[0].cellId).not.toBe(peerBoard.cells[0].cellId);
  });

  it("board has cellCount cells with blanks filling the remainder (BOAR-04)", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    addWords(host, ["W1", "W2", "W3", "W4", "W5"]);
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));

    const board = extractBoardFromConn(host);
    // 5 words → 3x3 tier → 9 cells. 5 words + 4 blanks.
    expect(board.cells).toHaveLength(9);
    const wordCells = board.cells.filter((c) => !c.blank);
    const blankCells = board.cells.filter((c) => c.blank);
    expect(wordCells).toHaveLength(5);
    expect(blankCells).toHaveLength(4);
    wordCells.forEach((c) => {
      expect(c.wordId).not.toBeNull();
      expect(c.text).not.toBeNull();
    });
    blankCells.forEach((c) => {
      expect(c.wordId).toBeNull();
      expect(c.text).toBeNull();
    });
  });

  it("two connections receive different boards — independent shuffles (BOAR-01, BOAR-02)", () => {
    const host = makeConn("c1");
    const peer = makeConn("c2");
    joinPlayer(host, "p1", "Alice");
    joinPlayer(peer, "p2", "Bob");
    // 21 words → 5x5 tier → 25 cells (4 blanks). Bigger search space → shuffle collision chance ≈ 1/25!
    const words = Array.from({ length: 21 }, (_, i) => `Word${i}`);
    addWords(host, words);
    host._sent.length = 0; peer._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));

    const hostBoard = extractBoardFromConn(host).cells.map((c) => c.wordId ?? "BLANK");
    const peerBoard = extractBoardFromConn(peer).cells.map((c) => c.wordId ?? "BLANK");
    expect(hostBoard).not.toEqual(peerBoard);
  });

  it("markWord on a valid word cell toggles mark and broadcasts wordMarked with minimal payload (BOAR-05, BOAR-06)", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    // 9 words → 3x3 full, zero blanks. A single mark cannot complete any line
    // (every line requires 3 marks), so the new Phase 4 win detection never
    // fires here — isolating the Phase 3 wordMarked broadcast contract.
    addWords(host, ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9"]);
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));

    const board = extractBoardFromConn(host);
    const firstWordCell = board.cells.find((c) => !c.blank)!;
    vi.clearAllMocks();

    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: firstWordCell.cellId }));

    expect(getBroadcast()).toHaveBeenCalledOnce();
    const payload = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(payload).toEqual({ type: "wordMarked", playerId: "p1", markCount: 1 });
    // Strict key check — no cellId, text, wordId, or other fields leaked
    expect(Object.keys(payload).sort()).toEqual(["markCount", "playerId", "type"]);
  });

  it("markWord second time on same cell unmarks (toggle idempotency)", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    // 9 words → 3x3 full, zero blanks. No single mark can win (requires 3).
    addWords(host, ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9"]);
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    const board = extractBoardFromConn(host);
    const cell = board.cells.find((c) => !c.blank)!;

    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: cell.cellId }));
    vi.clearAllMocks();
    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: cell.cellId }));

    expect(getBroadcast()).toHaveBeenCalledOnce();
    const payload = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(payload).toEqual({ type: "wordMarked", playerId: "p1", markCount: 0 });
  });

  it("markWord on a blank cellId is silently dropped (no broadcast)", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    addWords(host, ["W1", "W2", "W3", "W4", "W5"]);
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    const board = extractBoardFromConn(host);
    const blankCell = board.cells.find((c) => c.blank)!;
    vi.clearAllMocks();

    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: blankCell.cellId }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("markWord on a cellId not on the player's own board is silently dropped (authorization)", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    addWords(host, ["W1", "W2", "W3", "W4", "W5"]);
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    vi.clearAllMocks();

    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: "nonexistent-cell-id" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("markWord when phase is 'lobby' is silently dropped", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    vi.clearAllMocks();

    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: "any" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("markWord by a pre-hello connection (no playerId in conn.state) is silently dropped", () => {
    const stranger = makeConn("c-stranger");
    // Do NOT call joinPlayer — conn.state stays null/undefined
    conns.push(stranger);
    vi.clearAllMocks();

    room.onMessage(stranger as never, JSON.stringify({ type: "markWord", cellId: "any" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("startGame skips connections that have not sent hello (Pitfall 4)", () => {
    const host = makeConn("c1");
    const stranger = makeConn("c-stranger");
    joinPlayer(host, "p1", "Alice");
    conns.push(stranger); // pushed but never sent hello
    addWords(host, ["W1", "W2", "W3", "W4", "W5"]);
    host._sent.length = 0; stranger._sent.length = 0;

    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));

    const hostMsgs = host._sent.map((m) => JSON.parse(m).type);
    const strangerMsgs = stranger._sent.map((m) => JSON.parse(m).type);
    expect(hostMsgs).toContain("boardAssigned");
    expect(strangerMsgs).not.toContain("boardAssigned"); // pre-hello conn skipped
  });

  it("wordMarked broadcast payload contains only type, playerId, markCount keys — nothing else", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    // 9 words → 3x3 full, zero blanks. Avoids the Phase-4 single-mark-via-blanks
    // edge case (Pitfall 5) so the first broadcast is strictly wordMarked.
    addWords(host, ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9"]);
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    const board = extractBoardFromConn(host);
    const wordCell = board.cells.find((c) => !c.blank)!;
    vi.clearAllMocks();

    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: wordCell.cellId }));

    const payload = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(Object.keys(payload).sort()).toEqual(["markCount", "playerId", "type"]);
  });

  // -------------------------------------------------------------------------
  // Hibernation rehydration (regression for start-game-button-no-board)
  // -------------------------------------------------------------------------

  it('rehydrates hostId/players/words/phase from storage on wake (startGame survives hibernation)', async () => {
    // Arrange: pretend the room had state BEFORE hibernation by stuffing the
    // storage.get mock to return the pre-hibernation values.
    const preHostId = 'p1';
    const prePlayers = [
      { playerId: 'p1', displayName: 'Alice', isHost: true, joinedAt: 100 },
    ];
    const preWords = Array.from({ length: 5 }, (_, i) => ({
      wordId: 'w' + i,
      text: 'Word' + i,
      submittedBy: 'p1',
    }));
    const getMock = room.ctx.storage.get as ReturnType<typeof vi.fn>;
    getMock.mockImplementation((key: string) => {
      switch (key) {
        case 'active': return Promise.resolve(true);
        case 'hostId': return Promise.resolve(preHostId);
        case 'players': return Promise.resolve(prePlayers);
        case 'words': return Promise.resolve(preWords);
        case 'phase': return Promise.resolve('lobby');
        case 'usedPacks': return Promise.resolve([]);
        case 'boards': return Promise.resolve([]);
        case 'marks': return Promise.resolve([]);
        default: return Promise.resolve(undefined);
      }
    });

    // Simulate waking from hibernation.
    await (room as unknown as { onStart: () => Promise<void> }).onStart();

    // A connection that reconnected after hibernation already has conn.state
    // (hibernation API persists it) but the in-memory class state was wiped.
    // The fix must have rehydrated #hostId so the host-only guard passes.
    const host = makeConn('c1');
    host.state = { playerId: 'p1' };
    conns.push(host);

    vi.clearAllMocks();
    host._sent.length = 0;

    // Act: host clicks Start Game after hibernation.
    room.onMessage(host as never, JSON.stringify({ type: 'startGame' }));

    // Assert: gameStarted broadcast fires (not silently dropped by host guard).
    expect(getBroadcast()).toHaveBeenCalled();
    const firstBroadcast = JSON.parse(getBroadcast().mock.calls[0][0]);
    expect(firstBroadcast.type).toBe('gameStarted');

    // Assert: host received boardAssigned.
    const types = host._sent.map((m) => JSON.parse(m).type);
    expect(types).toContain('boardAssigned');
  });

});

// ---------------------------------------------------------------------------
// Phase 4: Win detection & play-again reset
// ---------------------------------------------------------------------------

describe("GameRoom — win & reset (Phase 4)", () => {
  let room: InstanceType<typeof GameRoom>;
  let conns: FakeConn[];

  beforeEach(() => {
    room = new GameRoom({} as never, {} as never);
    conns = [];
    (room as unknown as { getConnections: () => FakeConn[] }).getConnections = () => conns;
    vi.clearAllMocks();
  });

  function joinPlayer(conn: FakeConn, playerId: string, displayName: string) {
    conns.push(conn);
    room.onMessage(conn as never, JSON.stringify({ type: "hello", playerId, displayName }));
    vi.clearAllMocks();
    conn._sent.length = 0;
  }

  function getBroadcast() {
    return (room as unknown as { broadcast: ReturnType<typeof vi.fn> }).broadcast;
  }

  // Private fields (#boards, #marks, #players) are inaccessible from outside
  // the class, so we drive the DO via public messages. For a 3x3 board with
  // 5 words + 4 blanks, marking every word cell guarantees at least one line
  // completes (there are 8 lines: 3 rows, 3 cols, 2 diagonals; the line whose
  // word-cells are all marked AND whose blank-cells are "pre-satisfied" wins).
  // We don't need to predict WHICH line completes — we only need to observe
  // the server's broadcast behaviour.

  function extractBoardFromConn(conn: FakeConn) {
    const msgStr = conn._sent.find((m) => JSON.parse(m).type === "boardAssigned");
    expect(msgStr, "conn should have received a boardAssigned message").toBeDefined();
    return JSON.parse(msgStr!) as {
      type: "boardAssigned";
      cells: Array<{ cellId: string; wordId: string | null; text: string | null; blank: boolean }>;
    };
  }

  // Helper: submit N words, start the game, return the host's assigned board.
  // We then mark EVERY non-blank cell on that board — since a 3x3 with 5 words
  // has 5 word cells + 4 blanks, marking all 5 words guarantees at least one
  // complete line (rows + cols + diagonals cover all cells; with 4 blanks
  // distributed, some line of 3 cells must be fully satisfied).
  function setupGameWithWinnableBoard(playerId = "p1", displayName = "Alice") {
    const host = makeConn("c1");
    joinPlayer(host, playerId, displayName);
    for (let i = 0; i < 5; i++) {
      room.onMessage(host as never, JSON.stringify({ type: "submitWord", text: `W${i}` }));
    }
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    const board = extractBoardFromConn(host);
    return { host, board };
  }

  /**
   * Mark every non-blank cell on the board in order, returning the broadcast
   * calls captured from the mark that triggered the first winDeclared. If no
   * winDeclared is emitted, returns null.
   */
  function markUntilWin(host: FakeConn, board: ReturnType<typeof extractBoardFromConn>) {
    const broadcast = getBroadcast();
    const wordCells = board.cells.filter((c) => !c.blank);
    for (const cell of wordCells) {
      const beforeCallCount = broadcast.mock.calls.length;
      room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: cell.cellId }));
      const newCalls = broadcast.mock.calls.slice(beforeCallCount);
      const winDeclared = newCalls.find((args) => {
        try { return JSON.parse(args[0] as string).type === "winDeclared"; } catch { return false; }
      });
      if (winDeclared) {
        return {
          winningMark: cell,
          newCalls: newCalls.map((args) => JSON.parse(args[0] as string)),
        };
      }
    }
    return null;
  }

  // --- Win detection behaviours (W1–W8) ------------------------------------

  it("W1: a mark that completes a line triggers winDeclared broadcast with correct payload shape", () => {
    const { host, board } = setupGameWithWinnableBoard();
    const result = markUntilWin(host, board);
    expect(result, "should have detected a win after marking all words").not.toBeNull();
    const winMsg = result!.newCalls.find((m) => m.type === "winDeclared")!;
    expect(winMsg.type).toBe("winDeclared");
    expect(winMsg.winnerId).toBe("p1");
    expect(winMsg.winnerName).toBe("Alice");
    expect(winMsg.winningLine).toBeDefined();
    expect(["row", "col", "diagonal"]).toContain(winMsg.winningLine.type);
    expect(typeof winMsg.winningLine.index).toBe("number");
    expect(Array.isArray(winMsg.winningCellIds)).toBe(true);
  });

  it("W2: on the winning mark, wordMarked is broadcast BEFORE winDeclared (call order)", () => {
    const { host, board } = setupGameWithWinnableBoard();
    const result = markUntilWin(host, board);
    expect(result).not.toBeNull();
    // The NEW calls emitted by the final (winning) mark should include
    // wordMarked first, winDeclared second.
    const types = result!.newCalls.map((m) => m.type);
    expect(types.indexOf("wordMarked")).toBeGreaterThanOrEqual(0);
    expect(types.indexOf("winDeclared")).toBeGreaterThanOrEqual(0);
    expect(types.indexOf("wordMarked")).toBeLessThan(types.indexOf("winDeclared"));
  });

  it("W3: a non-completing mark triggers only wordMarked (no winDeclared)", () => {
    const { host, board } = setupGameWithWinnableBoard();
    const wordCells = board.cells.filter((c) => !c.blank);
    // Mark exactly one word cell — a single mark on a 3x3 with 5 words and
    // 4 blanks cannot complete a row, col, or diagonal on its own unless
    // every OTHER cell on that line is blank. For a 3x3 with 5 words, there
    // are at most 4 blanks; a line of 3 cells cannot be all blanks (would
    // need 3 blanks, leaving 6 words in 6 cells — but we have 5). Wait —
    // 5 words + 4 blanks = 9 cells; a line of 3 blanks is possible (4 >= 3).
    // So the first mark MIGHT win if it's on a line of 2 blanks + itself.
    //
    // To make this test deterministic, we check: after one mark, EITHER
    // a winDeclared was emitted (edge case — the single mark completed
    // a line because the other two cells were blanks), OR no winDeclared.
    // If winDeclared happened on the first mark, skip the assertion.
    const broadcast = getBroadcast();
    broadcast.mockClear();
    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: wordCells[0].cellId }));
    const msgs = broadcast.mock.calls.map((args) => JSON.parse(args[0] as string));
    const wordMarkedCount = msgs.filter((m) => m.type === "wordMarked").length;
    const winDeclaredCount = msgs.filter((m) => m.type === "winDeclared").length;
    expect(wordMarkedCount).toBe(1);
    // If this single mark happened to complete a line of blanks, a win is
    // legitimate. Otherwise, no winDeclared should fire on this non-winning mark.
    if (winDeclaredCount === 0) {
      // Non-completing mark path: exactly one broadcast (wordMarked).
      expect(msgs.length).toBe(1);
    }
  });

  it("W4: on win, #phase becomes 'ended' AND storage.put(phase, 'ended') is called when winDeclared broadcasts", () => {
    const { host, board } = setupGameWithWinnableBoard();
    const broadcast = getBroadcast();
    const storagePut = (room as unknown as { ctx: { storage: { put: ReturnType<typeof vi.fn> } } }).ctx.storage.put;

    // Mark until a win is declared. `markUntilWin` only marks each cell once,
    // so no toggle-unmark happens mid-sequence.
    const result = markUntilWin(host, board);
    expect(result, "should have detected a win").not.toBeNull();

    // After the win, storage.put must have been called with ("phase", "ended").
    const phaseEndedPut = storagePut.mock.calls.find(
      (args) => args[0] === "phase" && args[1] === "ended"
    );
    expect(phaseEndedPut, "storage.put('phase', 'ended') must be called on win").toBeDefined();

    // And winDeclared must have fired.
    const winBroadcast = broadcast.mock.calls.find((args) => {
      try { return JSON.parse(args[0] as string).type === "winDeclared"; } catch { return false; }
    });
    expect(winBroadcast, "winDeclared broadcast must fire").toBeDefined();
  });

  it("W5: after phase='ended', subsequent markWord is silently dropped (no further broadcasts)", () => {
    const { host, board } = setupGameWithWinnableBoard();
    const result = markUntilWin(host, board);
    expect(result).not.toBeNull();

    const broadcast = getBroadcast();
    broadcast.mockClear();

    // Try to mark another cell after the win.
    const wordCells = board.cells.filter((c) => !c.blank);
    const unmarkedCell = wordCells.find((c) => c.cellId !== result!.winningMark.cellId) ?? wordCells[0];
    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: unmarkedCell.cellId }));

    expect(broadcast).not.toHaveBeenCalled();
  });

  it("W6: winnerName comes from the server-side player roster, not client-supplied input", () => {
    const { host, board } = setupGameWithWinnableBoard("p1", "Alice");
    const result = markUntilWin(host, board);
    expect(result).not.toBeNull();
    const winMsg = result!.newCalls.find((m) => m.type === "winDeclared")!;
    // winnerName MUST equal the roster displayName — not any client-supplied value.
    expect(winMsg.winnerName).toBe("Alice");
  });

  it("W7: winnerName falls back to 'Someone' if players.get(playerId) returns undefined", () => {
    // Manually wire a board + marks for a player that is NOT in the #players
    // map, to exercise the fallback branch. We must run startGame as a real
    // host (to populate #boards/#marks), then simulate a mid-game player
    // removal before the winning mark.
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    for (let i = 0; i < 5; i++) {
      room.onMessage(host as never, JSON.stringify({ type: "submitWord", text: `W${i}` }));
    }
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    const board = extractBoardFromConn(host);

    // Remove the player from the roster but keep their board + marks —
    // this is the race condition captured by the behavior spec (W7).
    // We do it by simulating onClose which deletes from #players but leaves
    // #boards and #marks intact (onClose does NOT clear boards/marks).
    room.onClose(host as never, 1000, "", true);

    // Reconstruct #players deletion effect: the player is gone but their
    // board/marks remain. The onClose handler broadcasts playerLeft, so
    // clear broadcast history before the final mark.
    const broadcast = getBroadcast();
    broadcast.mockClear();

    // Mark until win (host is no longer in #players).
    const result = markUntilWin(host, board);
    expect(result, "win should still be declared even if player row was removed").not.toBeNull();
    const winMsg = result!.newCalls.find((m) => m.type === "winDeclared")!;
    expect(winMsg.winnerName).toBe("Someone");
  });

  it("W8: storage rehydration — phase='ended' in storage loads cleanly via onStart (no type error)", async () => {
    const getMock = (room as unknown as { ctx: { storage: { get: ReturnType<typeof vi.fn> } } }).ctx.storage.get;
    getMock.mockImplementation((key: string) => {
      switch (key) {
        case "active": return Promise.resolve(true);
        case "hostId": return Promise.resolve("p1");
        case "players": return Promise.resolve([{ playerId: "p1", displayName: "Alice", isHost: true, joinedAt: 100 }]);
        case "words": return Promise.resolve([]);
        case "phase": return Promise.resolve("ended");
        case "usedPacks": return Promise.resolve([]);
        case "boards": return Promise.resolve([]);
        case "marks": return Promise.resolve([]);
        default: return Promise.resolve(undefined);
      }
    });

    await (room as unknown as { onStart: () => Promise<void> }).onStart();

    // After rehydration, a markWord from a connection should be silently dropped
    // because phase === "ended" (post-hibernation integrity — Pitfall 2).
    const host = makeConn("c1");
    host.state = { playerId: "p1" };
    conns.push(host);
    vi.clearAllMocks();

    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: "any" }));
    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  // --- Play-again reset behaviours (R1–R11) --------------------------------
  // startNewGame returns the room to phase="lobby" but RETAINS players, words,
  // and usedPacks. Only the host may issue it (WIN-05, D-09/D-13).

  /** Drive the room to phase="ended" and clear broadcast history. */
  function setupEndedGame(playerId = "p1", displayName = "Alice") {
    const host = makeConn("c1");
    joinPlayer(host, playerId, displayName);
    for (let i = 0; i < 5; i++) {
      room.onMessage(host as never, JSON.stringify({ type: "submitWord", text: `W${i}` }));
    }
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    const board = extractBoardFromConn(host);
    const result = markUntilWin(host, board);
    expect(result, "expected to reach phase=ended via win").not.toBeNull();
    getBroadcast().mockClear();
    (room as unknown as { ctx: { storage: { put: ReturnType<typeof vi.fn> } } }).ctx.storage.put.mockClear();
    return { host };
  }

  it("R1: startNewGame from the host broadcasts gameReset", () => {
    const { host } = setupEndedGame();
    room.onMessage(host as never, JSON.stringify({ type: "startNewGame" }));
    const calls = getBroadcast().mock.calls.map((a) => JSON.parse(a[0] as string));
    const gameReset = calls.find((m) => m.type === "gameReset");
    expect(gameReset, "gameReset must broadcast on host startNewGame").toBeDefined();
    // gameReset payload shape: { type: "gameReset" } — no other keys (D-14).
    expect(Object.keys(gameReset!).sort()).toEqual(["type"]);
  });

  it("R2: startNewGame from a non-host is silently dropped (no broadcast)", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    for (let i = 0; i < 5; i++) {
      room.onMessage(host as never, JSON.stringify({ type: "submitWord", text: `W${i}` }));
    }
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    // Second player (not host)
    const other = makeConn("c2");
    joinPlayer(other, "p2", "Bob");
    getBroadcast().mockClear();

    room.onMessage(other as never, JSON.stringify({ type: "startNewGame" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("R3: startNewGame from a pre-hello connection is silently dropped", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    for (let i = 0; i < 5; i++) {
      room.onMessage(host as never, JSON.stringify({ type: "submitWord", text: `W${i}` }));
    }
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));

    const stranger = makeConn("c-stranger");
    conns.push(stranger); // never sent hello → conn.state is null
    getBroadcast().mockClear();

    room.onMessage(stranger as never, JSON.stringify({ type: "startNewGame" }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("R4: startNewGame persists phase='lobby' to storage", () => {
    const { host } = setupEndedGame();
    const storagePut = (room as unknown as { ctx: { storage: { put: ReturnType<typeof vi.fn> } } }).ctx.storage.put;

    room.onMessage(host as never, JSON.stringify({ type: "startNewGame" }));

    const phaseLobbyPut = storagePut.mock.calls.find(
      (args) => args[0] === "phase" && args[1] === "lobby"
    );
    expect(phaseLobbyPut, "storage.put('phase', 'lobby') must fire on startNewGame").toBeDefined();
  });

  it("R5: startNewGame persists an empty boards array to storage", () => {
    const { host } = setupEndedGame();
    const storagePut = (room as unknown as { ctx: { storage: { put: ReturnType<typeof vi.fn> } } }).ctx.storage.put;

    room.onMessage(host as never, JSON.stringify({ type: "startNewGame" }));

    const boardsPut = storagePut.mock.calls.find((args) => args[0] === "boards");
    expect(boardsPut, "storage.put('boards', ...) must fire on startNewGame").toBeDefined();
    expect(boardsPut![1]).toEqual([]);
  });

  it("R6: startNewGame persists an empty marks array to storage", () => {
    const { host } = setupEndedGame();
    const storagePut = (room as unknown as { ctx: { storage: { put: ReturnType<typeof vi.fn> } } }).ctx.storage.put;

    room.onMessage(host as never, JSON.stringify({ type: "startNewGame" }));

    const marksPut = storagePut.mock.calls.find((args) => args[0] === "marks");
    expect(marksPut, "storage.put('marks', ...) must fire on startNewGame").toBeDefined();
    expect(marksPut![1]).toEqual([]);
  });

  it("R7: after startNewGame, markWord is silently dropped (phase back to lobby)", () => {
    const { host } = setupEndedGame();
    // Capture a word cellId BEFORE the reset wipes boards.
    const boardBefore = extractBoardFromConn(host);
    const someWordCell = boardBefore.cells.find((c) => !c.blank)!;

    room.onMessage(host as never, JSON.stringify({ type: "startNewGame" }));
    getBroadcast().mockClear();

    room.onMessage(host as never, JSON.stringify({ type: "markWord", cellId: someWordCell.cellId }));

    expect(getBroadcast()).not.toHaveBeenCalled();
  });

  it("R8: startNewGame retains #words — starting a new game yields a board", () => {
    const { host } = setupEndedGame();
    // Remember word count before reset (the host has 5 submitted words).
    room.onMessage(host as never, JSON.stringify({ type: "startNewGame" }));
    host._sent.length = 0;
    getBroadcast().mockClear();

    // Now host issues startGame again; the retained words should still be
    // available so the board regenerates successfully.
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));

    const types = host._sent.map((m) => JSON.parse(m).type);
    expect(types).toContain("boardAssigned");
    // Also: gameStarted should have been broadcast (host guard + words present).
    const gameStarted = getBroadcast().mock.calls
      .map((a) => JSON.parse(a[0] as string))
      .find((m) => m.type === "gameStarted");
    expect(gameStarted).toBeDefined();
  });

  it("R9: startNewGame retains #players and #hostId — host can still operate post-reset", () => {
    const { host } = setupEndedGame();
    const storagePut = (room as unknown as { ctx: { storage: { put: ReturnType<typeof vi.fn> } } }).ctx.storage.put;

    room.onMessage(host as never, JSON.stringify({ type: "startNewGame" }));

    // No storage.put call for "hostId" or "players" should fire on reset —
    // those are retained (not rewritten) per plan frontmatter.
    const hostIdPuts = storagePut.mock.calls.filter((args) => args[0] === "hostId");
    const playersPuts = storagePut.mock.calls.filter((args) => args[0] === "players");
    expect(hostIdPuts.length, "hostId must NOT be re-persisted on reset").toBe(0);
    expect(playersPuts.length, "players must NOT be re-persisted on reset").toBe(0);

    // And the host can still issue startGame (proves #hostId still matches).
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    const types = host._sent.map((m) => JSON.parse(m).type);
    expect(types).toContain("boardAssigned");
  });

  it("R10: startNewGame does NOT re-persist #words or #usedPacks (retention only)", () => {
    const { host } = setupEndedGame();
    const storagePut = (room as unknown as { ctx: { storage: { put: ReturnType<typeof vi.fn> } } }).ctx.storage.put;

    room.onMessage(host as never, JSON.stringify({ type: "startNewGame" }));

    const wordsPuts = storagePut.mock.calls.filter((args) => args[0] === "words");
    const usedPacksPuts = storagePut.mock.calls.filter((args) => args[0] === "usedPacks");
    expect(wordsPuts.length, "words must NOT be re-persisted on reset").toBe(0);
    expect(usedPacksPuts.length, "usedPacks must NOT be re-persisted on reset").toBe(0);
  });

  it("R11: startNewGame works from phase='playing' too (not just ended) — host can reset mid-game", () => {
    const host = makeConn("c1");
    joinPlayer(host, "p1", "Alice");
    for (let i = 0; i < 5; i++) {
      room.onMessage(host as never, JSON.stringify({ type: "submitWord", text: `W${i}` }));
    }
    host._sent.length = 0;
    room.onMessage(host as never, JSON.stringify({ type: "startGame" }));
    // Now phase === "playing" but no win yet.
    getBroadcast().mockClear();
    const storagePut = (room as unknown as { ctx: { storage: { put: ReturnType<typeof vi.fn> } } }).ctx.storage.put;
    storagePut.mockClear();

    room.onMessage(host as never, JSON.stringify({ type: "startNewGame" }));

    const calls = getBroadcast().mock.calls.map((a) => JSON.parse(a[0] as string));
    expect(calls.find((m) => m.type === "gameReset"), "gameReset must fire from playing phase too").toBeDefined();
    expect(
      storagePut.mock.calls.find((a) => a[0] === "phase" && a[1] === "lobby"),
      "phase must drop back to 'lobby' from 'playing'"
    ).toBeDefined();
  });
});
