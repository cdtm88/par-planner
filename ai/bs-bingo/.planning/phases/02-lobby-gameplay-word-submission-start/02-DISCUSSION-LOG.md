# Phase 2: Lobby Gameplay — Word Submission & Start - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 02-lobby-gameplay-word-submission-start
**Areas discussed:** Word pool display, Word submission input, Starter pack UX, Start game affordance

---

## Word Pool Display

| Option | Description | Selected |
|--------|-------------|----------|
| Chips/tags | Each word is a pill/chip; own words get × delete; Badge component reused | ✓ |
| List rows | Full-width rows with submitter name; closer to PlayerRow pattern | |

**User's choice:** Chips/tags

---

| Option | Description | Selected |
|--------|-------------|----------|
| Word text only | Clean, compact — ownership inferred from × presence | ✓ |
| Show submitter on hover/tap | Tooltip or small label on hover/long-press | |
| Visible submitter always | Small username always shown next to chip | |

**User's choice:** Word text only — no submitter attribution visible

---

## Word Submission Input

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky inline input | Text field + Add button fixed below pool; Enter or tap to submit | ✓ |
| Floating + button | FAB-style button opens input; extra tap required | |

**User's choice:** Sticky inline input

---

| Option | Description | Selected |
|--------|-------------|----------|
| Short phrases OK, 30 chars max | Multi-word buzzwords allowed; fits mobile chips | ✓ |
| Single words only, 20 chars max | No spaces/punctuation | |
| Free-form, 50 chars max | Maximum flexibility; mobile overflow risk | |

**User's choice:** Short phrases OK, 30 chars max

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline input error | Red text below field; clears on keystroke | |
| Input shakes + error text | Brief shake animation + inline error message | ✓ |

**User's choice:** Input shakes + error text for duplicate rejection

---

## Starter Pack UX

| Option | Description | Selected |
|--------|-------------|----------|
| 3 inline buttons | Corporate Classics, Agile, Sales as pill buttons; host-only | ✓ |
| Dropdown select | Single "Load starter pack…" dropdown with confirmation step | |

**User's choice:** 3 inline buttons

---

| Option | Description | Selected |
|--------|-------------|----------|
| Merge + deduplicate | Pack words added to existing pool; duplicates silently skipped | ✓ |
| Replace all existing words | Pack wipes current pool | |

**User's choice:** Merge + deduplicate

---

| Option | Description | Selected |
|--------|-------------|----------|
| Once per pack | Button greyed out + checkmark after use | ✓ |
| Any number of times | No restriction; deduplication handles repeat loads | |

**User's choice:** Once per pack — button marked used after loading

---

## Start Game Affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Counter + threshold hint | "8 words — need 1 more for a 3×3 board" near Start button | |
| Progress bar + tier label | Fill bar with 3×3 / 4×4 / 5×5 tier markers + word count | ✓ |

**User's choice:** Progress bar with tier markers

---

| Option | Description | Selected |
|--------|-------------|----------|
| Waiting message | "Waiting for [HostName] to start the game…" — no button shown | ✓ |
| Disabled button + waiting text | Button visible but greyed; "Only the host can start" caption | |

**User's choice:** Waiting message only — no disabled button for non-hosts

---

## Claude's Discretion

- Exact chip styling within the Phase 1 design system
- Word pool empty state copy
- Threshold hint wording
- Pack-load animation behavior
- Word pool scroll behavior

## Deferred Ideas

- Per-word democratic removal → v2
- Profanity filter on words → v2
- Multiple pack loads / pack management → once per session is sufficient for v1
