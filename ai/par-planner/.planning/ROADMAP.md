# Roadmap: Par Planner — Hole Planner

## Overview

Four phases sequenced by dependency: a pure algorithm layer that always produces a plan, enriched by a Claude proxy that adds strategic commentary, grounded by a persistence store that saves plans across sessions, and surfaced through the planner screen that ties every layer together. Each phase is independently testable; each delivers a complete capability before the next begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Algorithm Foundation** - Pure TypeScript club recommendation and landing zone calculation, platform-agnostic and fully unit-tested
- [ ] **Phase 2: Claude Proxy + Strategy** - Vercel serverless proxy holding the API key, Claude strategy module, orchestrator that merges AI advice with algorithm output
- [ ] **Phase 3: Plan Persistence** - planStore with Zustand persist and 20-plan LRU cap; home screen wired to real saved plans
- [ ] **Phase 4: Planner Screen + Override UX** - Full planner screen wired to all prior layers, club override with local recalculation, Expo web verified

## Phase Details

### Phase 1: Algorithm Foundation
**Goal**: The club recommendation algorithm produces a correct, safe hole plan from any combination of player bag, shot tendency, and hazard geodata — with no external dependencies and no crashes on sparse data
**Depends on**: Nothing (first phase)
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAT-02
**Success Criteria** (what must be TRUE):
  1. Given a player bag and hole data, the algorithm returns a recommended club and landing zone for every hole
  2. Shot tendency (all 7 levels, both fade and draw) shifts the landing zone laterally in the correct direction and magnitude
  3. When the recommended club's landing zone intersects a hazard, the algorithm automatically steps down to the next-safest club and returns that instead
  4. Algorithm produces a valid output for all three geodata tiers: full hazard polygon, distance-only, and no-data — without throwing or returning null
  5. All algorithm functions are pure TypeScript with no iOS-only or native APIs, so they can be imported into any platform target without modification
**Plans**: TBD

Plans:
- [ ] 01-01: Implement `src/utils/geo.ts` — haversine distance, point-in-polygon, forward projection (hand-rolled, Hermes-safe)
- [ ] 01-02: Implement `src/planning/algorithm.ts` — `selectClub`, `calculateLandingZone`, `checkHazardClearance` with three geodata tiers and 10-yard safety buffer
- [ ] 01-03: Unit tests for algorithm layer — cover all geodata tiers, all tendency levels, hazard fallback chain

### Phase 2: Claude Proxy + Strategy
**Goal**: The app can call Claude to get per-hole strategic commentary through a secure Vercel proxy, and always delivers a complete plan even when Claude is unavailable
**Depends on**: Phase 1
**Requirements**: AI-01, AI-02
**Research flag**: yes — confirm Vercel serverless vs Edge runtime compatibility with `@anthropic-ai/sdk` before building proxy; validate prompt structure for reliable structured JSON output across all 18 holes
**Success Criteria** (what must be TRUE):
  1. Each hole plan includes Claude-generated commentary covering target, what to avoid, and strategic reasoning
  2. When Claude is unavailable or returns an error, the algorithm-only plan is returned with no error state and no blank holes
  3. The Anthropic API key is held server-side in the Vercel function and never appears in the Expo bundle or client-side environment variables
  4. In fixture mode (no proxy URL set), a pre-built 18-hole strategy fixture is used and no network calls are made
**Plans**: TBD

Plans:
- [ ] 02-01: Expand `fixtures/strategy-sample.json` to full 18 holes; implement `api/strategy.ts` Vercel function with server-side API key
- [ ] 02-02: Implement `src/api/claude.ts` (thin app-side client, fixture mode when `EXPO_PUBLIC_CLAUDE_PROXY_URL` unset) and `src/planning/claudeStrategy.ts` (prompt engineering for structured per-hole JSON)
- [ ] 02-03: Implement `src/planning/planner.ts` orchestrator — merges algorithm output with Claude strategy, handles Claude failure with graceful fallback to algorithm-only plan

### Phase 3: Plan Persistence
**Goal**: Completed game plans survive app restarts and are visible from the home screen; the store enforces a 20-plan cap automatically
**Depends on**: Phase 2
**Requirements**: MGMT-01, MGMT-02, MGMT-03, MGMT-04
**Success Criteria** (what must be TRUE):
  1. A generated plan persists across app restarts and appears in the home screen plan list
  2. The player can delete any saved plan from the home screen list
  3. When a 21st plan is saved, the oldest plan is automatically removed and only 20 plans remain
  4. The home screen plan list is wired to live planStore data, not placeholder content
**Plans**: TBD

Plans:
- [ ] 03-01: Implement `src/store/planStore.ts` with Zustand persist + AsyncStorage, four actions (savePlan, deletePlan, updatePlan, clearAll), and 20-plan LRU cap
- [ ] 03-02: Wire home screen plan list to planStore — replace any placeholder UI with real saved plan data, add delete affordance

### Phase 4: Planner Screen + Override UX
**Goal**: The player opens the planner, sees a complete hole-by-hole strategy, can override any club recommendation and watch the landing zone update instantly, and can save their finalized plan — all working in a web browser as well as on mobile
**Depends on**: Phase 3
**Requirements**: UX-01, UX-02, UX-03, UX-04, PLAT-01
**Research flag**: yes — confirm bottom sheet library New Architecture (Fabric) compatibility before building `ClubPicker` modal
**Success Criteria** (what must be TRUE):
  1. Planner screen shows all 18 holes as a scrollable card list with par, distance, recommended club, and Claude commentary per hole
  2. Player can override the recommended club on any hole; the landing zone recalculates locally without re-calling Claude
  3. A loading screen with meaningful progress indication is shown while the plan is being generated
  4. Plan is auto-saved as a draft immediately after generation; the player explicitly confirms to promote it to a saved plan
  5. The full planner flow (plan generation, override, save) runs correctly in a web browser via the Expo web target
**Plans**: TBD

Plans:
- [ ] 04-01: Research and select bottom sheet library for `ClubPicker`; validate New Architecture (Fabric) compatibility
- [ ] 04-02: Implement `app/planner.tsx` screen and `usePlannerSession` hook — orchestrate plan generation, manage loading/error states, wire to planner.ts orchestrator
- [ ] 04-03: Implement `HolePlanList`, `HolePlanCard`, and `ConfirmPlanBar` components — scrollable hole cards, per-hole data display, save/confirm flow
- [ ] 04-04: Implement `ClubPicker` component with override logic — local algorithm recalculation on club swap, no Claude re-call
- [ ] 04-05: Expo web build verification — confirm full planner flow runs in browser, resolve any web-incompatible native APIs
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Algorithm Foundation | 0/3 | Not started | - |
| 2. Claude Proxy + Strategy | 0/3 | Not started | - |
| 3. Plan Persistence | 0/2 | Not started | - |
| 4. Planner Screen + Override UX | 0/5 | Not started | - |
