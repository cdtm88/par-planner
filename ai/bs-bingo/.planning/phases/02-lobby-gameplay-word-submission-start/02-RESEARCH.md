# Phase 2: Lobby Gameplay — Word Submission & Start - Research

**Researched:** 2026-04-17
**Domain:** Real-time collaborative word pool — Svelte 5 reactive state + PartyServer DO + Valibot wire protocol
**Confidence:** HIGH

---

## Summary

Phase 2 builds entirely on top of the Phase 1 infrastructure without introducing new libraries. The stack is fully validated and running. The implementation is an extension of existing patterns: new Valibot message variants in `messages.ts`, new fields in `RoomState`, new handler branches in `GameRoom.onMessage`, and new UI components in `src/lib/components/`. All decisions are locked in CONTEXT.md and the UI design contract is approved in `02-UI-SPEC.md`.

The primary technical question is **broadcast strategy**: whether the server sends incremental deltas (`wordAdded`, `wordRemoved`) or always broadcasts a full `roomState` snapshot. This has been answered by the existing codebase — Phase 1 uses a hybrid: full snapshot to the newcomer + targeted deltas (`playerJoined`, `playerLeft`) to others. Phase 2 should follow the same pattern for word events, keeping incremental deltas because they are simpler to handle in the client store and maintain the same latency profile.

The `startGame` event is a phase transition signal only — no board generation happens in this phase. The DO should flip `phase` to `"playing"` and broadcast `roomState` with the updated phase so clients can navigate. Board generation is Phase 3's job.

**Primary recommendation:** Extend existing DO + protocol + store + lobby page. Four new UI components (`WordChip`, `WordPool`, `PackPills`, `GridProgress`). No new libraries, no new routes.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Word Pool Display**
- D-01: Words displayed as chips/tags in wrapping flow layout. Chip shows word text only — no submitter attribution at rest.
- D-02: Player's own words get × delete button. Others' words have no ×. Ownership tracked per player session.
- D-03: Pool section header shows live word count: "Words (12)".

**Word Submission Input**
- D-04: Inline input field + Add button, always visible (no extra tap). Submit on Enter or Add.
- D-05: Max 30 characters per entry. Multi-word phrases allowed — no space restriction.
- D-06: Duplicate rejection shown as: input shakes + inline error "'Synergy' is already in the pool". Error clears on next keystroke.

**Starter Pack UX (host-only)**
- D-07: Three inline pill buttons visible only to host: "Corporate Classics", "Agile", "Sales". Host-only section labeled "Seed from a starter pack:".
- D-08: Loading a pack merges words into existing pool. Duplicates silently skipped — no error.
- D-09: Each pack button can only be used once per session. After loading: greyed out + checkmark icon. Re-tapping does nothing.

**Grid Threshold & Start Game Affordance**
- D-10: Grid tiers: 3×3 = 5–11 words minimum, 4×4 = 12–20 words, 5×5 = 21+ words.
- D-11: Visual progress bar with tier markers (3×3 → 4×4 → 5×5) near Start Game control. Updates live.
- D-12: Start Game button: visible only to host. Disabled while minimum word count unmet. Enabled instantly when threshold crossed.
- D-13: Non-hosts see "Waiting for [HostName] to start the game…" in subdued text. No disabled button for non-hosts.

### Claude's Discretion
- Exact chip styling (border radius, padding, background color within Phase 1 design system)
- Word pool empty state copy
- Exact wording of the threshold hint
- Animation behavior when a pack is loaded (chips appear all at once — resolved in UI-SPEC)
- Whether the word pool scrolls independently or page scrolls as one unit (resolved: page scrolls as one unit)

### Deferred Ideas (OUT OF SCOPE)
- Per-word voting / democratic removal (MODR-02)
- Word character validation beyond length (profanity filter)
- Mid-game word pool modifications — pool is frozen on start
- Multiple starter pack loads / pack management
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOBB-01 | Players can submit words they expect to hear during the meeting | `submitWord` ClientMessage → DO dedupe → `wordAdded` ServerMessage broadcast |
| LOBB-02 | Duplicate words (case-insensitive) are rejected with a clear message | DO performs `.toLowerCase()` comparison against `#words` Map keys; sends `error` back to submitter |
| LOBB-03 | Players can remove words they personally submitted | `removeWord` ClientMessage; DO checks `submittedBy === conn.state.playerId`; broadcasts `wordRemoved` |
| LOBB-04 | Host can choose from starter buzzword packs to pre-seed word pool | `loadStarterPack` ClientMessage (host-only guard); pack content defined server-side in DO constants |
| LOBB-05 | Grid size auto-derived from word count (3×3 for 5–11, 4×4 for 12–20, 5×5 for 21+) | Pure derivation in `GridProgress` component from `words.length`; no server state needed |
| LOBB-06 | Host cannot start the game until minimum word count for selected grid is reached | DO guards `startGame` handler: `if (#words.size < 5) { send error }` |
| LOBB-07 | Host can start the game; non-hosts see waiting state | `startGame` ClientMessage → DO flips `phase: "playing"` → broadcasts full `roomState` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Word deduplication | Durable Object | — | Server-authoritative; client cannot be trusted for uniqueness across concurrent submitters |
| Word ownership tracking | Durable Object | Client (display only) | DO stores `submittedBy: playerId`; client uses it to conditionally render × button |
| Pack word definitions | Durable Object | — | Server-side only to prevent client tampering (CONTEXT.md `<specifics>`) |
| Start game guard (min word count) | Durable Object | — | Authoritative state lives in DO; client button is UX-only, not a security gate |
| Grid tier derivation | Client (derived) | — | Pure function of `words.length`; no server state needed — both client and Phase 3 derive it the same way |
| Word pool reactive state | Client (room store) | — | `$state` rune in `room.svelte.ts`; updated from server delta messages |
| Pack used-once tracking | Client (`sessionStorage`) | DO (implicit) | DO will silently skip re-loads; client tracks `usedPacks` Set to grey the pill immediately without a round-trip |

---

## Standard Stack

### Core (all verified — present in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| partyserver | 0.4.1 | DO class extension, WS broadcast | Phase 1 baseline [VERIFIED: package.json] |
| partysocket | 1.1.16 | Client WS with reconnect | Phase 1 baseline [VERIFIED: package.json] |
| valibot | 1.3.1 | Message schema validation | Phase 1 baseline [VERIFIED: package.json] |
| nanoid | 5.1.9 | `wordId` generation | Phase 1 baseline, already installed [VERIFIED: package.json] |
| svelte | 5.55.4 | UI + `$state` runes | Phase 1 baseline [VERIFIED: package.json] |
| lucide-svelte | ^0.454.0 | `X`, `Check`, `Play` icons | Phase 1 baseline [VERIFIED: 01-UI-SPEC.md] |

**No new libraries needed for Phase 2.** All capabilities are covered by existing dependencies.

### Installation
```bash
# Nothing new to install
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Svelte 5)                    Cloudflare DO (GameRoom)
─────────────────────                 ────────────────────────
[+page.svelte lobby]                  #words: Map<wordId, WordEntry>
       │                              #hostId: string | null
       │  createRoomStore(code)        #usedPacks: Set<PackName>
       ▼
[room.svelte.ts store]  ◄──WS──►  [party/game-room.ts]
  $state: words[]                      onMessage():
  $state: phase                          "submitWord" → dedupe → wordAdded broadcast
  $state: usedPacks                      "removeWord" → ownership check → wordRemoved broadcast
       │                                 "loadStarterPack" → host guard → merge → wordAdded* broadcast
       ▼                                 "startGame" → min-count guard → phase→playing → roomState broadcast
[WordPool component]
[PackPills component]   (host only)
[GridProgress component]
[Start Game button]     (host only)
```

**Data flow — word submit:**
1. Player types word, taps Add → store calls `ws.send({ type: "submitWord", text })`
2. DO validates (length, dedupe) → broadcasts `{ type: "wordAdded", word: WordEntry }` to all
3. All stores receive `wordAdded` → append to `$state` words array → chips re-render

**Data flow — start game:**
1. Host taps Start Game → store sends `{ type: "startGame" }`
2. DO checks `#words.size >= 5` → updates `#phase = "playing"` → broadcasts full `roomState`
3. All stores receive `roomState` with `phase: "playing"` → page navigates to game screen (Phase 3)

### Recommended Project Structure (Phase 2 additions)

```
src/
├── lib/
│   ├── components/
│   │   ├── WordChip.svelte       # NEW — chip with optional × delete
│   │   ├── WordPool.svelte       # NEW — wrapping container + section header
│   │   ├── PackPills.svelte      # NEW — host-only pack pill row
│   │   ├── GridProgress.svelte   # NEW — progress bar + tier markers + hint
│   │   ├── TextInput.svelte      # MODIFY — add shake prop
│   │   └── ...                   # unchanged
│   ├── protocol/
│   │   └── messages.ts           # MODIFY — add WordEntry, new msg variants, phase union
│   ├── stores/
│   │   └── room.svelte.ts        # MODIFY — add words state + new msg handlers
│   └── util/
│       └── starterPacks.ts       # NEW — pack word lists (shared constants)
party/
└── game-room.ts                  # MODIFY — add #words Map, word handlers, startGame
```

### Pattern 1: Extending the Valibot Protocol

`messages.ts` is the single source of truth for the wire format. Phase 2 adds to each discriminated union.

```typescript
// Source: src/lib/protocol/messages.ts (existing pattern — extend in-place)
import * as v from "valibot";

// New shared type — used by both RoomState and delta messages
export const WordEntry = v.object({
  wordId: v.string(),
  text: v.string(),
  submittedBy: v.string(), // playerId or "pack"
});
export type WordEntry = v.InferOutput<typeof WordEntry>;

// Extend RoomState — add words array
export const RoomState = v.object({
  code: v.string(),
  phase: v.union([v.literal("lobby"), v.literal("playing")]),
  hostId: v.nullable(v.string()),
  players: v.array(Player),
  words: v.array(WordEntry),           // NEW
});

// Extend ClientMessage variant list
export const ClientMessage = v.variant("type", [
  // ... existing hello, ping variants ...
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

// Extend ServerMessage variant list
export const ServerMessage = v.variant("type", [
  // ... existing variants ...
  v.object({ type: v.literal("wordAdded"), word: WordEntry }),
  v.object({ type: v.literal("wordRemoved"), wordId: v.string() }),
  v.object({ type: v.literal("gameStarted") }), // Phase 3 will act on this
]);
```

**CRITICAL:** `phase` in `RoomState` must be expanded from `v.literal("lobby")` to `v.union([v.literal("lobby"), v.literal("playing")])`. Phase 3 board generation depends on this.

### Pattern 2: Extending the GameRoom DO

```typescript
// Source: party/game-room.ts (existing pattern — add to in-place)
import { STARTER_PACKS } from "../src/lib/util/starterPacks.js";
import { nanoid } from "nanoid";

export class GameRoom extends Server<Env> {
  // Existing fields: #hostId, #players, #createdAt, #active

  // NEW
  #words = new Map<string, WordEntry>(); // wordId → entry
  #phase: "lobby" | "playing" = "lobby";
  #usedPacks = new Set<PackName>();

  // Inside onMessage switch:
  case "submitWord": {
    const { text } = result.output;
    const normalized = text.trim();
    // Dedupe: case-insensitive comparison across all existing words
    const exists = [...this.#words.values()].some(
      (w) => w.text.toLowerCase() === normalized.toLowerCase()
    );
    if (exists) {
      conn.send(JSON.stringify({
        type: "error",
        code: "duplicate_word",
        message: `"${normalized}" is already in the pool`,
      }));
      return;
    }
    const wordId = nanoid();
    const state = conn.state as { playerId?: string } | null;
    const entry: WordEntry = {
      wordId,
      text: normalized,
      submittedBy: state?.playerId ?? "unknown",
    };
    this.#words.set(wordId, entry);
    this.broadcast(JSON.stringify({ type: "wordAdded", word: entry }));
    return;
  }

  case "removeWord": {
    const { wordId } = result.output;
    const entry = this.#words.get(wordId);
    if (!entry) return; // idempotent
    const state = conn.state as { playerId?: string } | null;
    if (entry.submittedBy !== state?.playerId) {
      conn.send(JSON.stringify({ type: "error", code: "not_owner" }));
      return;
    }
    this.#words.delete(wordId);
    this.broadcast(JSON.stringify({ type: "wordRemoved", wordId }));
    return;
  }

  case "loadStarterPack": {
    const state = conn.state as { playerId?: string } | null;
    if (state?.playerId !== this.#hostId) return; // host-only, silent ignore
    const { pack } = result.output;
    if (this.#usedPacks.has(pack)) return; // once-per-session
    this.#usedPacks.add(pack);
    const packWords = STARTER_PACKS[pack];
    for (const text of packWords) {
      const alreadyIn = [...this.#words.values()].some(
        (w) => w.text.toLowerCase() === text.toLowerCase()
      );
      if (alreadyIn) continue;
      const wordId = nanoid();
      const entry: WordEntry = { wordId, text, submittedBy: "pack" };
      this.#words.set(wordId, entry);
      this.broadcast(JSON.stringify({ type: "wordAdded", word: entry }));
    }
    return;
  }

  case "startGame": {
    const state = conn.state as { playerId?: string } | null;
    if (state?.playerId !== this.#hostId) return;
    if (this.#words.size < 5) {
      conn.send(JSON.stringify({ type: "error", code: "not_enough_words" }));
      return;
    }
    this.#phase = "playing";
    this.broadcast(JSON.stringify({
      type: "roomState",
      state: this.#snapshot(),
    }));
    return;
  }
```

### Pattern 3: Extending the Room Store

```typescript
// Source: src/lib/stores/room.svelte.ts (existing pattern — add to in-place)

// Add to existing $state declarations:
let words = $state<WordEntry[]>([]);
let usedPacks = $state<Set<string>>(new Set());

// Add to message handler switch:
case "wordAdded":
  if (!words.some((w) => w.wordId === msg.word.wordId)) {
    words = [...words, msg.word];
  }
  break;
case "wordRemoved":
  words = words.filter((w) => w.wordId !== msg.wordId);
  break;

// Handle roomState snapshot — populate words:
case "roomState":
  state = msg.state;
  words = msg.state.words ?? [];  // hydrate on reconnect
  break;

// Expose from store return:
return {
  get state() { return state; },
  get status() { return status; },
  get words() { return words; },
  get usedPacks() { return usedPacks; },
  send(msg: ClientMessage) { ws.send(JSON.stringify(msg)); },
  disconnect() { ws.close(); connection.status = "closed"; },
};
```

**Note:** The store currently does not expose a `send` method — the page constructs messages directly. Phase 2 should add a typed `send(msg: ClientMessage)` wrapper to the store return for clean component-to-socket communication.

### Pattern 4: WordChip component

```svelte
<!-- Source: 02-UI-SPEC.md Component Inventory, Interaction Contracts -->
<script lang="ts">
  import { X } from "lucide-svelte";
  type Props = { word: string; canDelete?: boolean; onDelete?: () => void; };
  let { word, canDelete = false, onDelete }: Props = $props();
</script>

<span class="inline-flex items-center gap-1 px-3 py-2 rounded-lg
  bg-[var(--color-surface)] border border-[var(--color-divider)]
  text-[var(--color-ink-primary)] text-sm">
  {word}
  {#if canDelete}
    <button
      onclick={onDelete}
      aria-label={`Remove "${word}"`}
      class="... min-h-11 min-w-11 flex items-center justify-center
             text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]
             active:scale-[0.92] transition-transform"
    >
      <X size={14} />
    </button>
  {/if}
</span>
```

### Pattern 5: Starter Pack Constants

```typescript
// src/lib/util/starterPacks.ts — server-side word definitions
// Imported by party/game-room.ts ONLY (prevent client inspection)

export const PACK_NAMES = ["corporate-classics", "agile", "sales"] as const;
export type PackName = typeof PACK_NAMES[number];

export const STARTER_PACKS: Record<PackName, string[]> = {
  "corporate-classics": [
    "Synergy", "Circle back", "Move the needle", "Low-hanging fruit",
    "Deep dive", "Bandwidth", "Alignment", "Leverage", "Pain point",
    "Boil the ocean", "Paradigm shift", "Action item", "Touch base",
    "Blue-sky thinking", "Drill down", "Holistic approach", "Take offline",
    "Best practices", "Core competency", "Value add",
  ],
  "agile": [
    "Sprint", "Velocity", "Backlog", "Stand-up", "Retrospective",
    "Story points", "Kanban", "Scrum", "Epic", "User story",
    "Definition of done", "MVP", "Iterative", "Pivot", "Ship it",
    "Two-pizza team", "Fail fast", "Continuous delivery", "DevOps", "Stakeholder",
  ],
  "sales": [
    "Pipeline", "Closing", "Quota", "Prospect", "Discovery call",
    "Champion", "ROI", "Upsell", "Churn", "Conversion",
    "Elevator pitch", "Decision maker", "BANT", "Objection handling",
    "Solution selling", "Land and expand", "Net new", "MRR", "ARR", "Forecasting",
  ],
};
```

**Note:** Pack words are defined server-side in `starterPacks.ts`, which is imported by the DO only. Starter pack content is `[ASSUMED]` — these are placeholder words suitable for a meeting bingo game. The actual word lists can be iterated on freely since they're in one constant file.

### Anti-Patterns to Avoid

- **Client-side deduplication only:** The client can optimistically show an error, but the DO must be the authoritative gate. Never trust client-side uniqueness checks for the stored state.
- **Phase transition on client navigate:** `phase: "playing"` must be set by the DO and broadcast via `roomState`. Clients navigate in response to receiving this — never on local button click alone.
- **Storing pack content in the client:** `starterPacks.ts` is imported by `party/game-room.ts`. It must not be re-exported through `messages.ts` or any client-side module — the pack words should not be in the client bundle (prevents pack preview / cheating).
- **Using `v.literal("lobby")` only for phase:** The `RoomState.phase` field must be a union from Phase 2 onward. Keeping it as `v.literal("lobby")` will cause Valibot parse failures when the DO broadcasts `phase: "playing"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Word ID generation | Custom counter / timestamp ID | `nanoid()` (already installed) | Collision-free, URL-safe, 21-char by default |
| CSS shake animation | JS-driven position tween | CSS `@keyframes` + conditional class | GPU-accelerated, respects `prefers-reduced-motion` natively |
| Set membership for pack tracking | Array `.includes()` | `Set<string>` | O(1) lookup; pack names are string keys |
| Case-insensitive dedupe | Manual regex | `.toLowerCase()` string comparison | Sufficient for this domain |

---

## Common Pitfalls

### Pitfall 1: `#snapshot()` missing `words`
**What goes wrong:** `GameRoom.#snapshot()` returns `RoomState`. If `words` is not added to this method, reconnecting players receive a snapshot without the current word pool — their store starts empty.
**Why it happens:** Phase 1 snapshot was built before words existed; easy to forget to update it.
**How to avoid:** Update `#snapshot()` in the same commit that adds `#words` to the DO.
**Warning signs:** Reconnecting player sees empty pool while others see words.

### Pitfall 2: `RoomState` Valibot schema not updated in `room.svelte.ts` parse path
**What goes wrong:** The server broadcasts `roomState` with a `words` field, but the client's `v.safeParse(ServerMessage, ...)` fails because `RoomState` schema still has no `words` field — message is silently dropped.
**Why it happens:** Schema in `messages.ts` is changed but the `phase` union or `words` array field is missed.
**How to avoid:** Update `RoomState` schema first; run `vitest run` after — `protocol.test.ts` will catch schema mismatches.
**Warning signs:** `console.warn("Server error:", ...)` fires for `roomState` messages.

### Pitfall 3: `submittedBy: "pack"` ownership — host cannot delete pack words
**What goes wrong:** Pack words are submitted with `submittedBy: "pack"`. The DO's `removeWord` handler checks `entry.submittedBy !== conn.state.playerId`. Since `"pack" !== hostPlayerId`, the host cannot delete pack words they just loaded.
**Why it happens:** Ownership semantics conflate "submitted by a system actor" with "submitted by a player".
**How to avoid:** In `loadStarterPack`, set `submittedBy` to the host's `playerId`, not `"pack"`. The `"pack"` sentinel is only needed if pack-word deletion should be disabled for everyone — which it isn't per CONTEXT.md D-02 (host can delete their own pack words).
**Warning signs:** Host clicks × on a pack word and gets a `not_owner` error silently.

### Pitfall 4: Concurrent word submits causing non-atomic dedupe
**What goes wrong:** Two players submit "Synergy" simultaneously. Both pass the dedupe check before either is written, resulting in two "Synergy" entries.
**Why it happens:** The DO is async internally even though connections share a single isolate.
**How to avoid:** The DO event loop is single-threaded per isolate — `onMessage` handlers are synchronous (no `await` in the dedupe + insert path). As long as the dedupe check and `#words.set()` are in the same synchronous block, this is safe. Never `await` between the check and the insert.
**Warning signs:** Duplicate chips appear in the pool for the same word.

### Pitfall 5: Progress bar thresholds off-by-one
**What goes wrong:** The 3×3 tier activates at word count ≥ 5 (not 9, not 5+1). The minimum is 5 (blanks fill remaining cells per BOAR-04). If the component uses `>= 9` as the 3×3 threshold, Start Game stays disabled too long.
**Why it happens:** Conflating "cells needed" (9) with "words needed" (5 minimum per LOBB-05).
**How to avoid:** Use exactly `[5, 12, 21]` as the tier thresholds. `wordCount >= 5` → 3×3 viable. This is locked by CONTEXT.md D-10 and LOBB-05.
**Warning signs:** Start Game stays disabled with 5–8 words in the pool.

### Pitfall 6: `usedPacks` state lost on page refresh
**What goes wrong:** Player refreshes the lobby. `usedPacks` in the client store resets to an empty Set. Pack pills reappear as unused even though the host already loaded them. Re-tapping would send `loadStarterPack` again, but the DO's `#usedPacks` Set ignores it. However, the pill appears clickable when it shouldn't.
**Why it happens:** `usedPacks` is tracked only in ephemeral client `$state`.
**How to avoid:** The server should include `usedPacks` in the `RoomState` snapshot (as an array of loaded pack names), or the client derives it from whether any words with `submittedBy: "pack"` are in the pool. The simpler solution: include `usedPacks: string[]` in `RoomState` — the DO has it and just needs to expose it in the snapshot.
**Warning signs:** After refresh, already-used pack pills appear clickable; the host tries to re-use them.

---

## Code Examples

### Grid tier derivation (pure function — use in both GridProgress and any tests)
```typescript
// Source: CONTEXT.md D-10, REQUIREMENTS.md LOBB-05
export function deriveGridTier(wordCount: number): "3x3" | "4x4" | "5x5" {
  if (wordCount >= 21) return "5x5";
  if (wordCount >= 12) return "4x4";
  return "3x3"; // includes 0–11
}

export function minimumWordsForTier(tier: "3x3" | "4x4" | "5x5"): number {
  return { "3x3": 5, "4x4": 12, "5x5": 21 }[tier];
}

export function wordsNeededToStart(wordCount: number): number {
  return Math.max(0, 5 - wordCount); // 5 is the global minimum
}
```

### CSS shake animation (add to `app.css` or component `<style>`)
```css
/* Source: 02-UI-SPEC.md Interaction Contracts — duplicate rejection */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-6px); }
  80%       { transform: translateX(6px); }
}

.shake {
  animation: shake 300ms ease-in-out;
}

@media (prefers-reduced-motion: reduce) {
  .shake { animation: none; }
}
```

### TextInput shake prop extension
```svelte
<!-- src/lib/components/TextInput.svelte — existing file, add shake prop -->
<script lang="ts">
  // Add to existing TextInputProps:
  type TextInputProps = {
    // ... existing props ...
    shake?: boolean; // triggers shake animation on duplicate rejection
  };
  let { /* ..., */ shake = false }: TextInputProps = $props();
</script>

<input
  class="{inputClasses} {shake ? 'shake' : ''}"
  ...
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `v.literal("lobby")` for phase | `v.union([v.literal("lobby"), v.literal("playing")])` | Phase 2 | Enables DO to signal game start via existing `roomState` broadcast |
| No `words` in `RoomState` | `words: v.array(WordEntry)` | Phase 2 | Client store hydrates word pool on connect/reconnect |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Starter pack word lists (20 words per pack) — content is placeholder | Pattern 5 | Low — content is in one constants file, trivially editable |
| A2 | `starterPacks.ts` is imported only by `party/game-room.ts` (not bundled to client) | Don't Hand-Roll / Anti-Patterns | Low — Vite/Wrangler tree-shaking and import path make this straightforward; verify with bundle analysis if concerned |
| A3 | The DO's `onMessage` handler is synchronous for the dedupe+insert path | Common Pitfalls §4 | LOW — Cloudflare DO docs state single-threaded isolate; no `await` in the path confirms safety [ASSUMED] |

---

## Open Questions

1. **`usedPacks` in `RoomState` vs derived from word ownership**
   - What we know: D-09 says pack button is once-per-session; DO tracks `#usedPacks`; client needs to render used state accurately after refresh.
   - What's unclear: Should `RoomState` include a `usedPacks: string[]` field, or should the client derive "pack used" by checking if any words from the pack are already in the pool?
   - Recommendation: Include `usedPacks: string[]` in `RoomState` snapshot — simpler, no inference logic required. One extra field in the snapshot.

2. **`send` method on room store**
   - What we know: The current store return doesn't expose a `send` method — the lobby page calls `ws.send` directly, but `ws` is not accessible outside the store closure.
   - What's unclear: Phase 1's lobby page doesn't need to send anything (it only receives). Phase 2 needs 4 new message types sent from components.
   - Recommendation: Add `send(msg: ClientMessage): void` to the store return object. All Phase 2 sends go through this single typed method.

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All tools (Wrangler, Node, npm) confirmed working from Phase 1 UAT.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (confirmed in package.json) |
| Config file | `vite.config.ts` (vitest config inline) |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOBB-01 | Word submitted → added to pool → broadcast | unit (DO) | `npm run test:unit -- game-room` | ❌ extend `game-room.test.ts` |
| LOBB-02 | Duplicate word (case-insensitive) → error sent to submitter | unit (DO) | `npm run test:unit -- game-room` | ❌ extend `game-room.test.ts` |
| LOBB-03 | Owner removes word → broadcast; non-owner rejected | unit (DO) | `npm run test:unit -- game-room` | ❌ extend `game-room.test.ts` |
| LOBB-04 | Host loads pack → words added; non-host ignored; second load ignored | unit (DO) | `npm run test:unit -- game-room` | ❌ extend `game-room.test.ts` |
| LOBB-05 | Grid tier derives correctly at 4, 5, 11, 12, 20, 21 words | unit (util) | `npm run test:unit -- gridTier` | ❌ new `tests/unit/gridTier.test.ts` |
| LOBB-06 | startGame with < 5 words → error; with 5+ → success | unit (DO) | `npm run test:unit -- game-room` | ❌ extend `game-room.test.ts` |
| LOBB-07 | startGame → phase becomes "playing" → roomState broadcast to all | unit (DO) | `npm run test:unit -- game-room` | ❌ extend `game-room.test.ts` |
| Protocol | New Valibot schemas parse valid/invalid word messages | unit (protocol) | `npm run test:unit -- protocol` | ❌ extend `protocol.test.ts` |

### Sampling Rate
- **Per task commit:** `npm run test:unit`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Extend `tests/unit/game-room.test.ts` — LOBB-01 through LOBB-07 DO behaviors
- [ ] New `tests/unit/gridTier.test.ts` — LOBB-05 pure function tests
- [ ] Extend `tests/unit/protocol.test.ts` — new Valibot schema variants

*(The fake server harness in `game-room.test.ts` is already established — just add test cases)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this project by design |
| V3 Session Management | no | sessionStorage identity (Phase 1, out of scope here) |
| V4 Access Control | yes | Host-only operations guarded server-side in DO |
| V5 Input Validation | yes | Valibot on every inbound WS message; maxlength 30 enforced in schema |
| V6 Cryptography | no | No cryptographic operations in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-host client sends `loadStarterPack` | Spoofing | DO checks `conn.state.playerId === this.#hostId` before executing |
| Non-host client sends `startGame` | Elevation of privilege | Same host ID check in `startGame` handler |
| Client submits word > 30 chars | Tampering | Valibot schema `v.pipe(v.string(), v.maxLength(30))` rejects before handler runs |
| Client removes another player's word | Tampering | DO checks `entry.submittedBy === conn.state.playerId`; sends `not_owner` error |
| Client sends unknown message type | Tampering | `v.safeParse` returns `success: false` → `bad_message` error response |

---

## Sources

### Primary (HIGH confidence)
- Verified codebase — `src/lib/protocol/messages.ts`, `party/game-room.ts`, `src/lib/stores/room.svelte.ts` (read 2026-04-17)
- `.planning/phases/02-lobby-gameplay-word-submission-start/02-CONTEXT.md` — locked decisions
- `.planning/phases/02-lobby-gameplay-word-submission-start/02-UI-SPEC.md` — approved design contract
- `.planning/phases/01-foundation-transport-room-lobby-presence/01-PATTERNS.md` — established Phase 1 patterns
- `.planning/REQUIREMENTS.md` — LOBB-01 through LOBB-07

### Secondary (MEDIUM confidence)
- `tests/unit/game-room.test.ts` — fake Server harness pattern confirmed; DO testing approach is established and reusable for Phase 2 test extensions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all verified in package.json
- Architecture: HIGH — direct extension of validated Phase 1 patterns; no speculative choices
- Pitfalls: HIGH — all pitfalls are grounded in actual code examined from the existing codebase
- Starter pack word content: LOW — placeholder; easily changed

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable stack, no fast-moving deps)
