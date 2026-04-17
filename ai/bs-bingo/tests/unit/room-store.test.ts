import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs before vi.mock factory, solving hoisting issues
const { MockPartySocket, getLastInstance, resetInstance } = vi.hoisted(() => {
  let _lastInstance: any = null;

  class MockPartySocket {
    listeners: Record<string, ((e: any) => void)[]> = {};
    lastSent: string | null = null;
    closed = false;
    opts: any;

    constructor(opts: any) {
      this.opts = opts;
      _lastInstance = this;
    }

    addEventListener(evt: string, fn: (e: any) => void) {
      (this.listeners[evt] ??= []).push(fn);
    }

    send(data: string) {
      this.lastSent = data;
    }

    close() {
      this.closed = true;
    }

    emit(evt: string, data: any) {
      (this.listeners[evt] ?? []).forEach((fn) => fn(data));
    }
  }

  return {
    MockPartySocket,
    getLastInstance: () => _lastInstance as InstanceType<typeof MockPartySocket> | null,
    resetInstance: () => { _lastInstance = null; },
  };
});

vi.mock("partysocket", () => ({
  PartySocket: MockPartySocket,
}));

vi.mock("../../src/lib/session", () => ({
  getOrCreatePlayer: vi.fn(() => ({
    playerId: "test-player-id",
    displayName: "Tester",
  })),
}));

import { createRoomStore, PARTY_NAME } from "../../src/lib/stores/room.svelte";

describe("PARTY_NAME", () => {
  it("equals 'game-room'", () => {
    expect(PARTY_NAME).toBe("game-room");
  });
});

describe("createRoomStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetInstance();
  });

  it("initial status is 'connecting'", () => {
    const store = createRoomStore("ABC123");
    expect(store.status).toBe("connecting");
  });

  it("initial state is null", () => {
    const store = createRoomStore("ABC123");
    expect(store.state).toBeNull();
  });

  it("creates a PartySocket with party: PARTY_NAME and room: code", () => {
    createRoomStore("ABC123");
    const ws = getLastInstance();
    expect(ws).not.toBeNull();
    expect(ws!.opts.party).toBe("game-room");
    expect(ws!.opts.room).toBe("ABC123");
  });

  it("status becomes 'open' and sends hello when open fires", () => {
    const store = createRoomStore("ABC123");
    expect(store.status).toBe("connecting");

    const ws = getLastInstance()!;
    ws.emit("open", {});

    expect(store.status).toBe("open");
    expect(ws.lastSent).not.toBeNull();

    const sent = JSON.parse(ws.lastSent!);
    expect(sent.type).toBe("hello");
    expect(sent.playerId).toBe("test-player-id");
    expect(sent.displayName).toBe("Tester");
  });

  it("populates state when roomState message is received", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    const roomState = {
      code: "ABC123",
      phase: "lobby",
      hostId: "test-player-id",
      players: [
        { playerId: "test-player-id", displayName: "Tester", isHost: true, joinedAt: 1000 },
      ],
      words: [],
      usedPacks: [],
    };

    ws.emit("message", { data: JSON.stringify({ type: "roomState", state: roomState }) });

    expect(store.state).not.toBeNull();
    expect(store.state!.code).toBe("ABC123");
    expect(store.state!.players).toHaveLength(1);
  });

  it("appends a player when playerJoined message is received", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    const roomState = {
      code: "ABC123",
      phase: "lobby",
      hostId: "test-player-id",
      players: [
        { playerId: "test-player-id", displayName: "Tester", isHost: true, joinedAt: 1000 },
      ],
      words: [],
      usedPacks: [],
    };
    ws.emit("message", { data: JSON.stringify({ type: "roomState", state: roomState }) });
    expect(store.state!.players).toHaveLength(1);

    const newPlayer = { playerId: "player-2", displayName: "Bob", isHost: false, joinedAt: 2000 };
    ws.emit("message", { data: JSON.stringify({ type: "playerJoined", player: newPlayer }) });

    expect(store.state!.players).toHaveLength(2);
    expect(store.state!.players[1].playerId).toBe("player-2");
  });

  it("removes a player when playerLeft message is received", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    const roomState = {
      code: "ABC123",
      phase: "lobby",
      hostId: "test-player-id",
      players: [
        { playerId: "test-player-id", displayName: "Tester", isHost: true, joinedAt: 1000 },
        { playerId: "player-2", displayName: "Bob", isHost: false, joinedAt: 2000 },
      ],
      words: [],
      usedPacks: [],
    };
    ws.emit("message", { data: JSON.stringify({ type: "roomState", state: roomState }) });
    expect(store.state!.players).toHaveLength(2);

    ws.emit("message", { data: JSON.stringify({ type: "playerLeft", playerId: "player-2" }) });

    expect(store.state!.players).toHaveLength(1);
    expect(store.state!.players[0].playerId).toBe("test-player-id");
  });

  it("status becomes 'reconnecting' when close fires", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});
    expect(store.status).toBe("open");

    ws.emit("close", {});
    expect(store.status).toBe("reconnecting");
  });

  it("drops messages with unknown shape (invalid Valibot parse)", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    ws.emit("message", { data: JSON.stringify({ type: "unknown_type", garbage: true }) });

    expect(store.state).toBeNull();
  });

  it("disconnect() closes the WebSocket", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    store.disconnect();
    expect(ws.closed).toBe(true);
  });

  it("initial board is null", () => {
    const store = createRoomStore("ABC123");
    expect(store.board).toBeNull();
  });

  it("initial playerMarks is empty object", () => {
    const store = createRoomStore("ABC123");
    expect(Object.keys(store.playerMarks)).toHaveLength(0);
  });

  it("initial markedCellIds is empty Set", () => {
    const store = createRoomStore("ABC123");
    expect(store.markedCellIds).toBeInstanceOf(Set);
    expect(store.markedCellIds.size).toBe(0);
  });

  it("sets board when boardAssigned message is received", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    const cells = [
      { cellId: "c1", wordId: "w1", text: "Synergy", blank: false },
      { cellId: "c2", wordId: null, text: null, blank: true },
    ];
    ws.emit("message", { data: JSON.stringify({ type: "boardAssigned", cells }) });

    expect(store.board).toEqual(cells);
  });

  it("resets markedCellIds to empty Set when boardAssigned is received", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    // Pre-populate markedCellIds
    store.toggleMark("some-old-cell");
    expect(store.markedCellIds.size).toBe(1);

    const cells = [{ cellId: "c1", wordId: "w1", text: "New", blank: false }];
    ws.emit("message", { data: JSON.stringify({ type: "boardAssigned", cells }) });

    expect(store.markedCellIds.size).toBe(0);
  });

  it("updates playerMarks when wordMarked message is received", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    ws.emit("message", { data: JSON.stringify({ type: "wordMarked", playerId: "p1", markCount: 3 }) });

    expect(store.playerMarks["p1"]).toBe(3);
  });

  it("wordMarked updates reassign the playerMarks object (immutable, Pitfall 3 analog)", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    const ref1 = store.playerMarks;
    ws.emit("message", { data: JSON.stringify({ type: "wordMarked", playerId: "p1", markCount: 1 }) });
    const ref2 = store.playerMarks;

    expect(ref1).not.toBe(ref2);
    expect(ref2["p1"]).toBe(1);
  });

  it("wordMarked for multiple players keeps entries independent", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    ws.emit("message", { data: JSON.stringify({ type: "wordMarked", playerId: "p1", markCount: 2 }) });
    ws.emit("message", { data: JSON.stringify({ type: "wordMarked", playerId: "p2", markCount: 5 }) });

    expect(store.playerMarks["p1"]).toBe(2);
    expect(store.playerMarks["p2"]).toBe(5);
  });

  it("toggleMark adds cellId to markedCellIds (optimistic) and sends markWord", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});
    ws.lastSent = null;

    store.toggleMark("cell-1");

    expect(store.markedCellIds.has("cell-1")).toBe(true);
    expect(ws.lastSent).not.toBeNull();
    expect(JSON.parse(ws.lastSent!)).toEqual({ type: "markWord", cellId: "cell-1" });
  });

  it("toggleMark a second time removes cellId from markedCellIds (toggle)", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    store.toggleMark("cell-1");
    expect(store.markedCellIds.has("cell-1")).toBe(true);
    store.toggleMark("cell-1");
    expect(store.markedCellIds.has("cell-1")).toBe(false);
  });

  it("toggleMark reassigns markedCellIds Set reference on each call (Pitfall 3)", () => {
    const store = createRoomStore("ABC123");
    const ws = getLastInstance()!;
    ws.emit("open", {});

    const ref1 = store.markedCellIds;
    store.toggleMark("cell-1");
    const ref2 = store.markedCellIds;

    expect(ref1).not.toBe(ref2);
  });
});
