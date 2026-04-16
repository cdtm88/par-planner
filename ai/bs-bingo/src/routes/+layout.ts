// Disable SSR — app runs as SPA. PartySocket needs the browser's WebSocket API.
// See RESEARCH.md Pitfall 3.
export const ssr = false;
export const prerender = false;
export const csr = true;
