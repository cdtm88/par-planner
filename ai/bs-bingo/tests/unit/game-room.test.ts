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
    ctx: { storage: { setAlarm: ReturnType<typeof vi.fn>; deleteAll: ReturnType<typeof vi.fn> } };
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
