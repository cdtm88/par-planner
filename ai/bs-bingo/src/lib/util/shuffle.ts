// src/lib/util/shuffle.ts
// Cryptographically unbiased Fisher–Yates shuffle.
// Runs on Cloudflare Workers (Web Crypto is available) and in Vitest (jsdom).
// Used by party/game-room.ts for per-player board generation (BOAR-02).
// Reference: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle

/**
 * Cryptographically unbiased integer in [0, n). Uses rejection sampling over
 * Uint32 to eliminate modulo bias. Safe on Cloudflare Workers runtime.
 */
function randomIntBelow(n: number): number {
  if (n <= 0) throw new Error("n must be > 0");
  const buf = new Uint32Array(1);
  // Largest multiple of n that fits in 2^32 (0xffffffff + 1 = 2^32, so use 0xffffffff as upper bound)
  const max = Math.floor(0xffffffff / n) * n;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= max);
  return x % n;
}

/**
 * In-place Fisher–Yates shuffle. Returns the same array for chaining.
 * Callers must `shuffle([...source])` if they need to preserve the input.
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIntBelow(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
