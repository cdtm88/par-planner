import { nanoid } from "nanoid";

export type PlayerSession = { playerId: string; displayName: string };

export function getOrCreatePlayer(code: string): PlayerSession {
  const key = `bsbingo_player_${code}`;
  const existing = sessionStorage.getItem(key);
  if (existing) return JSON.parse(existing);
  const p: PlayerSession = { playerId: nanoid(), displayName: "" };
  sessionStorage.setItem(key, JSON.stringify(p));
  return p;
}

export function setDisplayName(code: string, displayName: string): void {
  const key = `bsbingo_player_${code}`;
  const cur = getOrCreatePlayer(code);
  sessionStorage.setItem(key, JSON.stringify({ ...cur, displayName }));
}
