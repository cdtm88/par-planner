const EMOJIS = [
  "🦊", "🐸", "🦋", "🐙", "🦄", "🐼", "🦁", "🐯",
  "🦅", "🐬", "🦩", "🐝", "🐻", "🦉", "🦓", "🦒",
  "🐧", "🦜", "🦈", "🐺", "🦦", "🦥", "🐡", "🦞",
];

export function getPlayerEmoji(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = ((hash << 5) - hash + playerId.charCodeAt(i)) | 0;
  }
  return EMOJIS[Math.abs(hash) % EMOJIS.length];
}
