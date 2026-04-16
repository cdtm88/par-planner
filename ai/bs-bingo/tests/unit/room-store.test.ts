import { describe, it, expect, vi, beforeEach } from "vitest";

// Track PartySocket instances for test access
let lastInstance: MockPartySocket | null = null;

class MockPartySocket {
  private listeners: Record<string, ((e: any) => void)[]> = {};
  lastSent: string | null = null;
  closed = false;
  opts: any;

  constructor(opts: any) {
    this.opts = opts;
    lastInstance = this;
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
    lastInstance = null;
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
    expect(lastInstance).not.toBeNull();
    expect(lastInstance!.opts.party).toBe("game-room");
    expect(lastInstance!.opts.room).toBe("ABC123");
  });

  it("status becomes 'open' and sends hello when open fires", () => {
    const store = createRoomStore("ABC123");
    expect(store.status).toBe("connecting");

    lastInstance!.emit("open", {});

    expect(store.status).toBe("open");
    expect(lastInstance!.lastSent).not.toBeNull();

    const sent = JSON.parse(lastInstance!.lastSent!);
    expect(sent.type).toBe("hello");
    expect(sent.playerId).toBe("test-player-id");
    expect(sent.displayName).toBe("Tester");
  });

  it("populates state when roomState message is received", () => {
    const store = createRoomStore("ABC123");
    lastInstance!.emit("open", {});

    const roomState = {
      code: "ABC123",
      phase: "lobby",
      hostId: "test-player-id",
      players: [
        { playerId: "test-player-id", displayName: "Tester", isHost: true, joinedAt: 1000 },
      ],
    };

    lastInstance!.emit("message", { data: JSON.stringify({ type: "roomState", state: roomState }) });

    expect(store.state).not.toBeNull();
    expect(store.state!.code).toBe("ABC123");
    expect(store.state!.players).toHaveLength(1);
  });

  it("appends a player when playerJoined message is received", () => {
    const store = createRoomStore("ABC123");
    lastInstance!.emit("open", {});

    // Set initial state first
    const roomState = {
      code: "ABC123",
      phase: "lobby",
      hostId: "test-player-id",
      players: [
        { playerId: "test-player-id", displayName: "Tester", isHost: true, joinedAt: 1000 },
      ],
    };
    lastInstance!.emit("message", { data: JSON.stringify({ type: "roomState", state: roomState }) });
    expect(store.state!.players).toHaveLength(1);

    // Now emit playerJoined
    const newPlayer = { playerId: "player-2", displayName: "Bob", isHost: false, joinedAt: 2000 };
    lastInstance!.emit("message", { data: JSON.stringify({ type: "playerJoined", player: newPlayer }) });

    expect(store.state!.players).toHaveLength(2);
    expect(store.state!.players[1].playerId).toBe("player-2");
  });

  it("removes a player when playerLeft message is received", () => {
    const store = createRoomStore("ABC123");
    lastInstance!.emit("open", {});

    const roomState = {
      code: "ABC123",
      phase: "lobby",
      hostId: "test-player-id",
      players: [
        { playerId: "test-player-id", displayName: "Tester", isHost: true, joinedAt: 1000 },
        { playerId: "player-2", displayName: "Bob", isHost: false, joinedAt: 2000 },
      ],
    };
    lastInstance!.emit("message", { data: JSON.stringify({ type: "roomState", state: roomState }) });
    expect(store.state!.players).toHaveLength(2);

    lastInstance!.emit("message", { data: JSON.stringify({ type: "playerLeft", playerId: "player-2" }) });

    expect(store.state!.players).toHaveLength(1);
    expect(store.state!.players[0].playerId).toBe("test-player-id");
  });

  it("status becomes 'reconnecting' when close fires", () => {
    const store = createRoomStore("ABC123");
    lastInstance!.emit("open", {});
    expect(store.status).toBe("open");

    lastInstance!.emit("close", {});
    expect(store.status).toBe("reconnecting");
  });

  it("drops messages with unknown shape (invalid Valibot parse)", () => {
    const store = createRoomStore("ABC123");
    lastInstance!.emit("open", {});

    // This message has no valid 'type' field matching ServerMessage
    lastInstance!.emit("message", { data: JSON.stringify({ type: "unknown_type", garbage: true }) });

    // State should remain null (no state change for bad message)
    expect(store.state).toBeNull();
  });

  it("disconnect() closes the WebSocket", () => {
    const store = createRoomStore("ABC123");
    store.disconnect();
    expect(lastInstance!.closed).toBe(true);
  });
});
