import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { ClientMessage, ServerMessage, Player, RoomState } from "../../src/lib/protocol/messages";

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
        players: []
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
      players: []
    });
    expect(result.success).toBe(true);
  });
});
