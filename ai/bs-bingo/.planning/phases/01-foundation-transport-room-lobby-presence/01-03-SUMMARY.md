---
phase: "01"
plan: "03"
subsystem: "ui-chrome"
tags: ["svelte5", "tailwind4", "components", "home-page", "join-flow"]
dependency_graph:
  requires: ["01-01"]
  provides: ["Button", "TextInput", "Modal", "Badge", "PlayerRow", "Banner", "ErrorPage", "home-page", "join-by-link-route"]
  affects: ["01-04"]
tech_stack:
  added: []
  patterns:
    - "Svelte 5 $props() runes for all component props"
    - "Tailwind v4 CSS custom property references via bg-[var(--color-...)]"
    - "Svelte snippet slots for icon + children composition"
    - "normalizeCode on every keystroke to strip ambiguous chars and uppercase join input"
    - "setDisplayName + goto pattern for session persistence before navigation"
key_files:
  created:
    - src/lib/components/Button.svelte
    - src/lib/components/TextInput.svelte
    - src/lib/components/Modal.svelte
    - src/lib/components/Badge.svelte
    - src/lib/components/PlayerRow.svelte
    - src/lib/components/Banner.svelte
    - src/lib/components/ErrorPage.svelte
    - src/routes/+page.svelte
    - src/routes/join/[code]/+page.svelte
  modified:
    - src/routes/+layout.svelte
decisions:
  - "TextInput forwards oninput as a prop (not native event forwarding) so callers control value normalization — join code input uses this to call normalizeCode on every keystroke"
  - "page.params.code nullish-coalesced to empty string before normalizeCode to satisfy TypeScript strict null check"
  - "Components were already created by Plan 01-01 parallel worktree; Task 1 committed them from this worktree's perspective"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  files_created: 9
  files_modified: 1
---

# Phase 1 Plan 3: UI Chrome — Design System Components + Home + Join Routes Summary

**One-liner:** Seven first-party Svelte 5 components (Button, TextInput, Modal, Badge, PlayerRow, Banner, ErrorPage) plus the home page create/join flows and `/join/[code]` share-link pre-fill route.

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Build 7 design-system components + global layout | `0ad6079` | src/lib/components/*.svelte, src/routes/+layout.svelte |
| 2 | Build home page + /join/[code] pre-fill route | `7c4c3b2` | src/routes/+page.svelte, src/routes/join/[code]/+page.svelte |

---

## Components Shipped

### Button.svelte
Props: `variant = "primary" | "secondary" | "icon"`, `type`, `disabled`, `onclick`, `children` snippet, optional `leadingIcon` / `trailingIcon` snippets.
- Primary: accent fill, brightness-110 hover, translateY-px active, 2px outline focus-visible
- Secondary: surface bg + divider border, border-[#3A3A48] hover
- Icon: 44×44 min tap target, surface bg, #2A2A36 hover, scale-0.97 active
- All: `motion-reduce:transition-none`, `min-h-11`, disabled opacity-40 + cursor-not-allowed

### TextInput.svelte
Props: `label`, `value` (bindable), `variant = "default" | "code"`, `maxlength`, `placeholder`, `helper`, `error`, `autofocus`, `onsubmit`, `oninput`, `id`.
- Default: surface bg, divider border, focus:border-ink-secondary + outline-2
- Code variant: adds `font-mono uppercase tracking-[0.2em] text-center text-lg`
- Enter keydown calls `onsubmit` prop
- Error shown in destructive color; helper in secondary color (error takes priority)
- **Contract extension:** `oninput` prop added (not in original interface) so callers control value normalization

### Modal.svelte
Props: `open` (bindable), `title`, `onclose`, `children` snippet, optional `footer` snippet.
- Overlay: fixed inset-0, bg-[var(--color-bg)]/80, flex centered
- Sheet: max-w-[480px], surface bg, rounded-xl, p-6
- Focus trap via Tab keydown listener on `svelte:window`
- Escape dismiss via `svelte:window onkeydown`
- Backdrop click dismiss via `onclick` on overlay checking `e.target === e.currentTarget`
- Autofocuses first focusable element on open via `$effect`

### Badge.svelte
Props: optional `icon` snippet, `children` snippet.
- Accent background, ink-inverse text, xs font-semibold, rounded-md

### PlayerRow.svelte
Props: `player: { playerId, displayName, isHost }`.
- 40px color circle with initials derived from `getPlayerColor(playerId)` + `getInitials(displayName)`
- Host badge with Crown icon via Badge component
- `in:fade` / `out:fade` 120ms transitions

### Banner.svelte
Props: `visible`, `children` snippet.
- Fixed top-0, full width, surface bg + divider border-b
- `transition:fly={{ y: -40, duration: 150 }}` on `{#if visible}` block

### ErrorPage.svelte
Props: optional `icon` snippet, `heading`, `body`, `primaryAction: { label, href }`.
- Full-page centered, max-w-[480px], destructive icon color
- Primary CTA wrapped in `<a href>` + `<Button variant="primary">`

---

## Routes Delivered

### src/routes/+page.svelte (Home `/`)
- "Bullshit Bingo." wordmark (Space Grotesk display, accent dot), tagline
- `Create a game` primary button → opens display-name modal (create mode)
- `or` divider
- Join-with-code form: `TextInput variant="code"` + `normalizeCode` on every keystroke + `Join` submit button (disabled until exactly 6 valid chars)
- Display-name modal (shared): `What should we call you?` title, autofocus input, `Create game →` / `Join game →` submit label depending on mode
- Create flow: POST `/api/rooms` → `setDisplayName(code, name)` → `goto(/room/{code})`
- Join flow: `setDisplayName(pendingJoinCode, name)` → `goto(/room/{code})`
- Empty name shows `Pick a name first.` inline error without closing modal
- Generic catch shows `Something went wrong. Try again.`

### src/routes/join/[code]/+page.svelte
- Derives code from `page.params.code` via `normalizeCode` (with `?? ""` null guard)
- Modal opens immediately (`modalOpen = $state(true)`)
- Shows `Joining room {code}` in accent color inside modal
- On submit: `setDisplayName(code, name)` → `goto(/room/{code})`
- Backdrop/Esc dismiss: `goto("/")`

---

## TextInput Contract Extensions

The original interface declared `onsubmit` but not `oninput`. This plan adds:
```typescript
oninput?: (e: Event) => void;  // added — callers control value normalization
id?: string;                   // added — for external label association
```
Plan 04 can use `oninput` in the same way for any future inputs that need keystroke normalization.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript null check on page.params.code**
- **Found during:** Task 2, svelte-check run
- **Issue:** `page.params.code` is typed `string | undefined` in SvelteKit; passing it directly to `normalizeCode(string)` fails strict TS check
- **Fix:** Added nullish coalescing `page.params.code ?? ""` before normalizeCode call
- **Files modified:** src/routes/join/[code]/+page.svelte
- **Commit:** `7c4c3b2`

**2. [Context] Components pre-created by Plan 01-01 parallel worktree**
- Plans 01-01 and 01-03 ran in parallel Wave 1. Plan 01-01 created the 7 components and layout as part of its scaffold work. This plan committed those files from this worktree's perspective and verified all acceptance criteria independently. No re-implementation was needed.

---

## Threat Surface Scan

No new network endpoints introduced by this plan. Threat mitigations implemented per plan threat model:

| T-ID | Mitigation | Status |
|------|-----------|--------|
| T-01-03-01 | Display name: `maxlength=20` on TextInput + `.trim()` before submit | Implemented |
| T-01-03-02 | Join code: `normalizeCode()` on every keystroke + submit disabled until 6 chars | Implemented |
| T-01-03-03 | Error response: generic "Something went wrong" — no raw server error exposed | Implemented |
| T-01-03-04 | `/api/rooms` response cast to `{code, shareUrl}` — tolerable 404 failure mode | Implemented |

---

## Known Stubs

None. All flows are wired: create posts to `/api/rooms` (implemented in Plan 02), join uses the validated code, session is persisted via `setDisplayName` before navigation. The `/room/{code}` destination is Plan 04's lobby — navigation to it is correct; the lobby rendering is not this plan's scope.

---

## Self-Check: PASSED

All 9 files exist on disk. Both task commits (0ad6079, 7c4c3b2) confirmed in git log. svelte-check exits with 0 errors.
