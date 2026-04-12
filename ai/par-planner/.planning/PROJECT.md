# Par Planner

## What This Is

Par Planner is a mobile golf strategy app for any golfer who wants to play smarter. Before a round, players select a course and tee, then receive a hole-by-hole game plan that recommends which club to use on each hole — factoring in their bag, carry distances, shot tendencies, and course hazards. The AI adds strategic commentary where calculation alone isn't enough.

## Core Value

A golfer should be able to open the app, find their course, and walk away with a concrete hole-by-hole plan that tells them exactly which club to hit to avoid trouble.

## Requirements

### Validated

- ✓ Player profile with bag setup (clubs, carry distances, shot tendency) — existing
- ✓ Course search via Maps4Golf API with offline caching — existing
- ✓ Course detail fetching with read-through cache — existing
- ✓ Tee selection before entering planner — existing

### Active

- [ ] Hole-by-hole planner screen (`app/planner.tsx`) — shows each hole with plan
- [ ] Shot landing zone calculation — algorithm maps club + tendency → probable landing zone relative to hazards
- [ ] Club recommendation per hole — suggests safest club given player bag and hazard positions
- [ ] Club override — player can swap the recommended club and see updated landing zone
- [ ] AI strategic commentary — Claude analyses hole layout + bag profile, adds contextual advice beyond the numbers
- [ ] Plan persistence — completed game plans saved to planStore and viewable from home screen

### Out of Scope

- On-course GPS mode (live position overlay) — deferred to v2; v1 is planning-only
- Social features (sharing plans, comparing with friends) — post-v1
- Cloud sync / backend — local-only for v1; no user accounts needed
- Scorecard / scoring — not a scoring app

## Context

- Built on Expo/React Native with expo-router (file-based routing), Zustand + AsyncStorage for state
- Maps4Golf API provides course layouts, hole data, and hazard geodata; fixture mode available for development
- Existing stores: `profileStore` (bag + tendency), `courseStore` (search + cache), `planStore` (empty — needs implementation)
- Existing types: `Club`, `Course`, `GamePlan`, `PlayerProfile`, `HolePlan`, `Hazard`, `Coordinate` already defined in `src/types/index.ts`
- `fixtures/strategy-sample.json` exists as a reference for what AI strategy responses should look like
- Planner screen (`app/planner.tsx`) is the next planned screen — noted in existing architecture docs as Plan 3

## Constraints

- **Tech Stack**: Expo/React Native — iOS and Android; must work offline for on-course use
- **API**: Maps4Golf for course data; Claude (Anthropic) for AI strategy generation
- **Storage**: AsyncStorage only — no backend, no user accounts for v1
- **Development**: Fixture mode must remain functional without a live API key

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Algorithm + AI hybrid for planning | Pure calculation is deterministic but misses course-specific strategy; AI alone is too slow/expensive per hole | — Pending |
| Local-only storage for v1 | Simplifies architecture, avoids auth/sync complexity; most useful even without cloud | — Pending |
| Maps4Golf for course data | Pre-existing integration; has geodata needed for hazard positioning | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization*
