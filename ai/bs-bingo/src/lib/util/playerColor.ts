const PLAYER_COLORS = [
  "#7DD3FC", "#FCA5A5", "#86EFAC", "#FDE68A",
  "#C4B5FD", "#F9A8D4", "#A5B4FC", "#FDBA74",
] as const;

/** Deterministic hash: same playerId → same color index on all clients. */
export function getPlayerColor(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
  }
  return PLAYER_COLORS[hash % PLAYER_COLORS.length];
}
