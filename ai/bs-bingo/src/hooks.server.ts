/**
 * SvelteKit server hooks.
 *
 * handleError: sanitizes server errors so stack traces are never leaked to
 * the client (ASVS V11 / T-01-02-09 in the threat model).
 * In production, errors should be routed to an observability service (Sentry
 * etc.) — for Phase 1 we log to console.error.
 */

import type { HandleServerError } from "@sveltejs/kit";

export const handleError: HandleServerError = ({ error, event }) => {
  // Log full details server-side for debugging; never send to client.
  console.error("Server error:", error, "at", event.url.pathname);
  return { message: "An unexpected error occurred." };
};
