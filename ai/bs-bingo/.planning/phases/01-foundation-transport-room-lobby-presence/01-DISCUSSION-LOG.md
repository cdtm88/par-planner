# Phase 1: Foundation — Transport, Room, Lobby, Presence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 01-foundation-transport-room-lobby-presence
**Mode:** --auto (all choices made autonomously with recommended defaults)
**Areas discussed:** Join flow UX, Display name & identity, Lobby layout & presence, Connection state, Error states

---

## Join Flow UX

| Option | Description | Selected |
|--------|-------------|----------|
| Single page (Create + Join) | One page with two CTAs — lowest friction | ✓ |
| Separate pages | /create and /join as distinct routes | |
| Modal-first | Home prompts for intent immediately | |

**Auto-selected:** Single page with two prominent CTAs
**Notes:** Reduces routing complexity and keeps time-to-first-action minimal — users never have to navigate before knowing their options.

---

## Display Name & Identity

| Option | Description | Selected |
|--------|-------------|----------|
| Required on action (modal/sheet) | Name collected before entering lobby | ✓ |
| Optional — join as Guest | Allow anon players with generated names | |
| Persistent across sessions | localStorage, remembers name | |

**Auto-selected:** Required inline modal on first action; sessionStorage per room; max 20 chars
**Notes:** sessionStorage (not localStorage) decouples identity from the room code — per ARCHITECTURE.md guidance, enables Phase 5 reconnection without leaking identity across rooms.

---

## Lobby Layout & Presence

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical list with initials avatars | Colored circle + initials + host badge | ✓ |
| Name-only list | Plain text list, no visual differentiation | |
| Grid layout | Card-per-player in a grid | |

**Auto-selected:** Vertical list, auto-colored initials, crown badge for host, join-time ordering
**Notes:** Lightweight and mobile-friendly. No image uploads needed.

---

## Connection State

| Option | Description | Selected |
|--------|-------------|----------|
| Silent on success, banner on drop | Non-blocking top banner only when disconnected | ✓ |
| Always-visible status indicator | Persistent dot/icon showing connection state | |
| Full-screen overlay on disconnect | Blocks interaction until reconnected | |

**Auto-selected:** Silent happy path; non-blocking banner on disconnect
**Notes:** Phase 5 implements full reconnection UX. Phase 1 just needs to not silently fail — the banner is sufficient.

---

## Error States

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated error page | Clear message + "Create a new game" CTA | ✓ |
| Redirect to home with toast | Silently redirect, show toast explaining why | |
| Broken lobby state | Leave user in lobby that won't load | |

**Auto-selected:** Dedicated error page (human-readable message, single CTA)
**Notes:** Covers SESS-07. Phase 1 only handles cold-entry failures — reconnect/resume is Phase 5.

---

## Claude's Discretion

- Visual design system (colors, typography, spacing) — Tailwind 4, minimal, mobile-first
- Copy-code vs copy-link: one or two buttons
- Exact animation timing for player list updates
- Error message copy

## Deferred Ideas

- Host transfer (Phase 5 — RESI-05)
- Reconnection/resume (Phase 5 — RESI-01–04)
- Spectator mode (v2)
- QR codes (v2)
