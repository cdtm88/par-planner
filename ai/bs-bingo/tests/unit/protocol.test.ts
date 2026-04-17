import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { ClientMessage, ServerMessage, Player, RoomState, WordEntry } from "../../src/lib/protocol/messages";

describe("ClientMessage", () => {
  it("accepts a valid hello message", () => {
    const result = v.safeParse(ClientMessage, {
      type: "hello",
      playerId: "p1",
      displayName: "Alice"
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid ping message", () => {
    const result = v.safeParse(ClientMessage, { type: "ping" });
    expect(result.success).toBe(true);
  });

  it("rejects hello with empty displayName", () => {
    const result = v.safeParse(ClientMessage, {
      type: "hello",
      playerId: "p1",
      displayName: ""
    });
    expect(result.success).toBe(false);
  });

  it("rejects hello with missing playerId", () => {
    const result = v.safeParse(ClientMessage, {
      type: "hello",
      displayName: "Alice"
    });
    expect(result.success).toBe(false);
  });

  it("rejects hello with displayName exceeding 20 chars", () => {
    const result = v.safeParse(ClientMessage, {
      type: "hello",
      playerId: "p1",
      displayName: "A".repeat(21)
    });
    expect(result.success).toBe(false);
  });

  it("accepts hello with displayName at exactly 20 chars", () => {
    const result = v.safeParse(ClientMessage, {
      type: "hello",
      playerId: "p1",
      displayName: "A".repeat(20)
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown discriminant", () => {
    const result = v.safeParse(ClientMessage, { type: "unknown" });
    expect(result.success).toBe(false);
  });

  it("accepts submitWord with text 1–30 chars", () => {
    const r = v.safeParse(ClientMessage, { type: "submitWord", text: "Synergy" });
    expect(r.success).toBe(true);
  });
  it("rejects submitWord with empty text", () => {
    const r = v.safeParse(ClientMessage, { type: "submitWord", text: "" });
    expect(r.success).toBe(false);
  });
  it("rejects submitWord with text > 30 chars", () => {
    const r = v.safeParse(ClientMessage, { type: "submitWord", text: "a".repeat(31) });
    expect(r.success).toBe(false);
  });
  it("accepts submitWord with exactly 30 chars", () => {
    const r = v.safeParse(ClientMessage, { type: "submitWord", text: "a".repeat(30) });
    expect(r.success).toBe(true);
  });
  it("accepts removeWord with wordId", () => {
    const r = v.safeParse(ClientMessage, { type: "removeWord", wordId: "abc123" });
    expect(r.success).toBe(true);
  });
  it("accepts loadStarterPack with valid pack name", () => {
    const r = v.safeParse(ClientMessage, { type: "loadStarterPack", pack: "agile" });
    expect(r.success).toBe(true);
  });
  it("rejects loadStarterPack with unknown pack name", () => {
    const r = v.safeParse(ClientMessage, { type: "loadStarterPack", pack: "unknown" });
    expect(r.success).toBe(false);
  });
  it("accepts startGame", () => {
    const r = v.safeParse(ClientMessage, { type: "startGame" });
    expect(r.success).toBe(true);
  });
});

describe("ServerMessage", () => {
  it("accepts a valid playerJoined message", () => {
    const result = v.safeParse(ServerMessage, {
      type: "playerJoined",
      player: {
        playerId: "p1",
        displayName: "Alice",
        isHost: false,
        joinedAt: 1
      }
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid roomState message", () => {
    const result = v.safeParse(ServerMessage, {
      type: "roomState",
      state: {
        code: "ABC234",
        phase: "lobby",
        hostId: "p1",
        players: [],
        words: [],
        usedPacks: [],
      }
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid playerLeft message", () => {
    const result = v.safeParse(ServerMessage, {
      type: "playerLeft",
      playerId: "p1"
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid pong message", () => {
    const result = v.safeParse(ServerMessage, { type: "pong" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid error message with optional message", () => {
    const result = v.safeParse(ServerMessage, {
      type: "error",
      code: "bad_message",
      message: "Invalid payload"
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown discriminant", () => {
    const result = v.safeParse(ServerMessage, { type: "unknown" });
    expect(result.success).toBe(false);
  });

  it("accepts wordAdded message", () => {
    const r = v.safeParse(ServerMessage, {
      type: "wordAdded",
      word: { wordId: "w1", text: "Synergy", submittedBy: "p1" },
    });
    expect(r.success).toBe(true);
  });
  it("accepts wordRemoved message", () => {
    const r = v.safeParse(ServerMessage, { type: "wordRemoved", wordId: "w1" });
    expect(r.success).toBe(true);
  });
  it("accepts gameStarted message", () => {
    const r = v.safeParse(ServerMessage, { type: "gameStarted" });
    expect(r.success).toBe(true);
  });
});

describe("Player schema", () => {
  it("rejects player with empty playerId", () => {
    const result = v.safeParse(Player, {
      playerId: "",
      displayName: "Alice",
      isHost: false,
      joinedAt: 1
    });
    expect(result.success).toBe(false);
  });

  it("rejects player with displayName over 20 chars", () => {
    const result = v.safeParse(Player, {
      playerId: "p1",
      displayName: "A".repeat(21),
      isHost: false,
      joinedAt: 1
    });
    expect(result.success).toBe(false);
  });
});

describe("RoomState schema", () => {
  it("accepts valid room state with null hostId", () => {
    const result = v.safeParse(RoomState, {
      code: "ABC234",
      phase: "lobby",
      hostId: null,
      players: [],
      words: [],
      usedPacks: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("RoomState — Phase 2 fields", () => {
  it("accepts roomState with phase 'lobby' and empty words/usedPacks", () => {
    const r = v.safeParse(RoomState, {
      code: "ABC234", phase: "lobby", hostId: "p1",
      players: [], words: [], usedPacks: [],
    });
    expect(r.success).toBe(true);
  });
  it("accepts roomState with phase 'playing'", () => {
    const r = v.safeParse(RoomState, {
      code: "ABC234", phase: "playing", hostId: "p1",
      players: [], words: [{ wordId: "w1", text: "Synergy", submittedBy: "p1" }],
      usedPacks: ["agile"],
    });
    expect(r.success).toBe(true);
  });
  it("rejects roomState without words field", () => {
    const r = v.safeParse(RoomState, {
      code: "ABC234", phase: "lobby", hostId: null, players: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("WordEntry schema", () => {
  it("accepts valid WordEntry", () => {
    const r = v.safeParse(WordEntry, { wordId: "w1", text: "Synergy", submittedBy: "p1" });
    expect(r.success).toBe(true);
  });
});
