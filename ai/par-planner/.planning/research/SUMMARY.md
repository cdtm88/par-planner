# Project Research Summary

**Project:** Par Planner — Hole Planner
**Domain:** Golf strategy / pre-round planning, AI-augmented mobile app
**Researched:** 2026-04-12
**Confidence:** HIGH (codebase-grounded; web search unavailable, competitive landscape at MEDIUM)

---

## Executive Summary

Par Planner's hole planner is a well-scoped feature addition to an existing Expo SDK 54 / React Native app with functional stores and a fully typed domain model. The correct architecture is algorithm-first: pure calculation always produces a usable plan, enriched by a single Claude call for the entire round. If Claude fails, the player still gets a complete plan.

The critical constraint research confirmed: the Anthropic API key must never enter the Expo bundle. A Vercel serverless proxy is required before any Claude integration ships — this is not deferrable. Development uses fixture mode throughout (`strategy-sample.json` expanded to 18 holes). Maps4Golf hazard polygon data will be incomplete for most courses — the algorithm must handle three geodata tiers (full polygon, partial, none) without crashing.

The feature set is already well-defined in the existing type system (`GamePlan`, `HolePlan`, `Hazard`, `ShotTendency` are all modelled). This is an implementation sprint, not a design sprint. The build order is locked by dependencies: algorithm → Claude proxy + strategy → planStore persistence → planner screen.

---

## Stack Decisions

**New additions required:**
- **Vercel serverless function** (`api/strategy.ts`) — Claude proxy; holds `ANTHROPIC_API_KEY` server-side; never bundled into app
- **`geolib` v3** (or hand-rolled `src/utils/geo.ts`) — haversine distance, point-in-polygon, forward projection; pure JS, Hermes-safe; ~60 lines if hand-rolled
- **`src/api/claude.ts`** — thin app-side client that POSTs to proxy URL; fixture mode when `EXPO_PUBLIC_CLAUDE_PROXY_URL` is unset

**Do not add:**
- `EXPO_PUBLIC_ANTHROPIC_API_KEY` — key ships in JS bundle, extractable by anyone
- `@anthropic-ai/sdk` in the app — same risk
- `@turf/turf` monolithic import — ~800 KB, includes Node.js internals that fail on Hermes
- Streaming Claude responses — RN Fetch streaming unreliable; full JSON response + loading state is correct for v1

**Existing stack requires no changes:** Expo SDK 54, React Native 0.81, Zustand, AsyncStorage, expo-router, TypeScript strict — all remain as-is.

---

## Feature Scope (Research-Confirmed)

**Must have (table stakes):**
- Hole card UI (1-18): par, distance, stroke index, recommended club
- Club recommendation from carry distance + shot tendency + hazard check
- Hazard detection with safer-club fallback
- AI strategic commentary per hole via Claude
- Club override — change club without re-calling Claude
- Plan persistence (currently unimplemented — known planStore tech debt)

**Differentiators Par Planner already positioned to win:**
- 7-level `ShotTendency` is more granular than any comparable app
- Cross-hole AI reasoning ("save driver for 10, lay up on 7") — enabled by single-round Claude call
- Algorithm-first resilience — plan works even offline

**Defer to v2+:**
- Visual landing zone map overlay (requires `react-native-maps`, separate spike)
- Live on-course GPS mode (separate product phase, explicitly out of v1 scope)
- Wind/conditions input, handicap-aware adjustments, scorecard

**Anti-features to avoid:**
- Per-shot planning (approach, chip, putt) — cognitive overload without data
- Forcing linear wizard with no back navigation
- Score entry — wrong product

---

## Architecture Decisions

**Landing zone model:** Circle (center + radius in yards, lateral offset for tendency). Keep calculation in yards — never mix lat/lng into the algorithm layer. Lat/lng only for map overlays (v2).

**Claude call structure:** One call for the entire round, not 18 parallel calls. Cross-hole reasoning requires shared context; single call is lower cost, simpler failure surface.

**Generation strategy:** All-at-once upfront. Show loading screen ("Building your game plan..."), then reveal full scrollable plan.

**Persistence:** Save `GamePlan { complete: false }` to planStore immediately after generation. Overrides update draft in place. "Save Plan" CTA sets `complete: true`. Existing `GamePlan.complete` field already designed for this.

**Build order (each layer independently testable):**
1. `src/planning/algorithm.ts` — pure functions, no external deps, unit-testable
2. `src/planning/claudeStrategy.ts` + proxy — fixture mode first, live Claude last
3. `src/store/planStore.ts` — four actions, Zustand persist, LRU cap at 20 plans
4. `app/planner.tsx` + `usePlannerSession` — thin rendering layer wired to all prior layers

---

## Critical Pitfalls

| # | Pitfall | Severity | Mitigation |
|---|---------|----------|------------|
| 1 | Claude API key in `EXPO_PUBLIC_*` | **CRITICAL** | Vercel proxy holds the key; build proxy first |
| 2 | Null/sparse geodata crashes | **HIGH** | Three geodata tiers: full → distance-only → no-data; null check every `hole.geodata` access |
| 3 | False "safe" from coordinate inaccuracy | **HIGH** | Mandatory 10-yard safety buffer inside all hazard polygon edges |
| 4 | Geospatial library Hermes incompatibility | **MEDIUM** | Use `geolib` or hand-roll `geo.ts`; avoid `@turf/turf` monolith |
| 5 | 18-hole Claude latency on cellular | **MEDIUM** | Single-call architecture + loading state solves this |

---

## Roadmap Implications

**4 phases, sequenced by dependency:**

### Phase 1: Algorithm Foundation
Pure `algorithm.ts` + `geo.ts`. No external deps. Unit-testable in isolation.
Delivers: `selectClub`, `calculateLandingZone`, `checkHazardClearance`, geodata tier handling.
*Research flag: none — standard patterns.*

### Phase 2: Claude Proxy + Strategy Module
Vercel proxy with server-side key. `claudeStrategy.ts` in fixture mode first. `planner.ts` orchestrator with merge + fallback.
Delivers: secure Claude integration, 18-hole strategy generation, algorithm/AI merge.
*Research flag: prompt engineering for structured 18-hole JSON; confirm Vercel serverless runtime for Anthropic SDK.*

### Phase 3: Plan Persistence
`planStore.ts` with Zustand persist + AsyncStorage, 20-plan LRU cap.
Delivers: plans survive app restart; home screen plan list wired to confirmed plans.
*Research flag: none — identical pattern to existing `courseStore`.*

### Phase 4: Planner Screen + Override UX
Thin rendering layer wired to all prior layers. Club override with local algorithm recalculation. Live Claude swap.
Delivers: `app/planner.tsx`, `HolePlanList`, `HolePlanCard`, `ClubPicker`, `ConfirmPlanBar`, offline/error state.
*Research flag: confirm bottom sheet library New Architecture (Fabric) compatibility before building `ClubPicker`.*

---

## Open Questions

1. **Maps4Golf hazard polygon completeness** — `fairwayPolygon: null` confirmed in fixture; actual API data quality per course type is unknown. Validate against real courses during Phase 1.
2. **`geolib` v3 API signature** — confirm `isPointInPolygon` parameter order against current npm before implementing; or hand-roll to eliminate dependency.
3. **Vercel serverless vs Edge runtime for Anthropic SDK** — Edge runtime has restricted API surface; confirm SDK compatibility before committing.
4. **Bottom sheet library for ClubPicker** — not researched; confirm New Architecture compatibility in Phase 4 research.
5. **`strategy-sample.json`** — currently only covers 2 holes; must be expanded to 18 before any end-to-end fixture testing works. This is task zero of Phase 2.

---

*Research completed: 2026-04-12*
*Ready for roadmap: yes*
