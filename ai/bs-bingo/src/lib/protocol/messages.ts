import * as v from "valibot";

export const Player = v.object({
  playerId: v.pipe(v.string(), v.minLength(1)),
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
  isHost: v.boolean(),
  joinedAt: v.number(),
});
export type Player = v.InferOutput<typeof Player>;

export const WordEntry = v.object({
  wordId: v.string(),
  text: v.string(),
  submittedBy: v.string(), // playerId (host's id for pack words)
});
export type WordEntry = v.InferOutput<typeof WordEntry>;

export const RoomState = v.object({
  code: v.string(),
  phase: v.union([v.literal("lobby"), v.literal("playing")]),
  hostId: v.nullable(v.string()),
  players: v.array(Player),
  words: v.array(WordEntry),
  usedPacks: v.array(v.string()),
});
export type RoomState = v.InferOutput<typeof RoomState>;

export const ClientMessage = v.variant("type", [
  v.object({
    type: v.literal("hello"),
    playerId: v.pipe(v.string(), v.minLength(1)),
    displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
  }),
  v.object({ type: v.literal("ping") }),
  v.object({
    type: v.literal("submitWord"),
    text: v.pipe(v.string(), v.minLength(1), v.maxLength(30)),
  }),
  v.object({
    type: v.literal("removeWord"),
    wordId: v.string(),
  }),
  v.object({
    type: v.literal("loadStarterPack"),
    pack: v.picklist(["corporate-classics", "agile", "sales"]),
  }),
  v.object({ type: v.literal("startGame") }),
]);
export type ClientMessage = v.InferOutput<typeof ClientMessage>;

export const ServerMessage = v.variant("type", [
  v.object({ type: v.literal("roomState"), state: RoomState }),
  v.object({ type: v.literal("playerJoined"), player: Player }),
  v.object({ type: v.literal("playerLeft"), playerId: v.string() }),
  v.object({ type: v.literal("error"), code: v.string(), message: v.optional(v.string()) }),
  v.object({ type: v.literal("pong") }),
  v.object({ type: v.literal("wordAdded"), word: WordEntry }),
  v.object({ type: v.literal("wordRemoved"), wordId: v.string() }),
  v.object({ type: v.literal("gameStarted") }),
]);
export type ServerMessage = v.InferOutput<typeof ServerMessage>;

// Kebab-cased binding name — must match wrangler.jsonc durable_objects binding name.
// See RESEARCH.md Pitfall 6.
export const PARTY_NAME = "game-room";
