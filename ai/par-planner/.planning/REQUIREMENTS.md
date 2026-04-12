# Requirements: Par Planner

**Defined:** 2026-04-12
**Core Value:** A golfer opens the app, finds their course, and walks away with a concrete hole-by-hole plan that tells them exactly which club to hit to avoid trouble.

## v1 Requirements

### Planning Algorithm

- [ ] **PLAN-01**: Player receives a club recommendation for each hole, derived from their bag distances and hazard positions
- [ ] **PLAN-02**: Shot tendency (7-level fade/draw + severity) is factored into the landing zone calculation
- [ ] **PLAN-03**: If the recommended club's landing zone intersects a hazard, the algorithm automatically suggests the next-safest club
- [ ] **PLAN-04**: Algorithm handles three geodata tiers: full hazard polygon → distance-only → no-data mode; never crashes on sparse data

### AI Strategy

- [ ] **AI-01**: Each hole plan includes Claude-generated commentary: target, what to avoid, and strategic reasoning
- [ ] **AI-02**: If Claude is unavailable or fails, the player still receives a complete algorithm-only plan (no error state, no blank holes)

### Planner UX

- [ ] **UX-01**: Planner screen shows all 18 holes as a scrollable card list with par, distance, recommended club, and AI advice per hole
- [ ] **UX-02**: Player can override the recommended club on any hole; landing zone recalculates locally without re-calling Claude
- [ ] **UX-03**: A loading screen is shown during plan generation with meaningful progress indication
- [ ] **UX-04**: Plan is auto-saved as a draft immediately after generation; player explicitly confirms to save the final plan

### Plan Management

- [ ] **MGMT-01**: Player can save a completed game plan
- [ ] **MGMT-02**: Home screen shows a list of the player's saved game plans
- [ ] **MGMT-03**: Player can delete a saved plan
- [ ] **MGMT-04**: Plans are capped at 20; the oldest is automatically removed when the limit is exceeded

### Platform

- [ ] **PLAT-01**: Planning screens run in a web browser via the Expo web target (same codebase)
- [ ] **PLAT-02**: Algorithm and stores are platform-agnostic (pure TypeScript, no iOS-only APIs) so on-course native iOS mode can reuse them without modification

## v2 Requirements

### On-Course Mode (Native iOS)

- **ONCS-01**: Native iOS app for on-course use, showing the hole plan before each shot
- **ONCS-02**: Live GPS position displayed on hole map with planned shot overlaid
- **ONCS-03**: Step-by-step shot prompts as player progresses through the hole

### AI Enhancements

- **AI-03**: Cross-hole AI reasoning — single Claude call reasons across all 18 holes (e.g. "save driver for hole 10")

### Social & Sync

- **SYNC-01**: Cloud sync — plans backed up and accessible across devices
- **SOCL-01**: Share a game plan with a playing partner

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-shot planning (approach, chip, putt) | Cognitive overload; pre-round data doesn't exist for these shots |
| Scorecard / round tracking | Different product; Par Planner is strategy, not scoring |
| Wind / conditions input | Manual friction with no payoff until on-course mode exists |
| Handicap-aware per-hole adjustments | `strokeIndex` + `handicap` fields exist; defer until core is stable |
| Social features (v1) | Local-only is sufficient; sync adds complexity without v1 payoff |
| OAuth / user accounts | No backend for v1; single-device local storage |
| Maps4Golf key proxy | Lower-stakes key vs Anthropic; accepted risk for v1 (document for v2) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAN-01 | Phase 1: Algorithm Foundation | Pending |
| PLAN-02 | Phase 1: Algorithm Foundation | Pending |
| PLAN-03 | Phase 1: Algorithm Foundation | Pending |
| PLAN-04 | Phase 1: Algorithm Foundation | Pending |
| PLAT-02 | Phase 1: Algorithm Foundation | Pending |
| AI-01 | Phase 2: Claude Proxy + Strategy | Pending |
| AI-02 | Phase 2: Claude Proxy + Strategy | Pending |
| MGMT-01 | Phase 3: Plan Persistence | Pending |
| MGMT-02 | Phase 3: Plan Persistence | Pending |
| MGMT-03 | Phase 3: Plan Persistence | Pending |
| MGMT-04 | Phase 3: Plan Persistence | Pending |
| UX-01 | Phase 4: Planner Screen | Pending |
| UX-02 | Phase 4: Planner Screen | Pending |
| UX-03 | Phase 4: Planner Screen | Pending |
| UX-04 | Phase 4: Planner Screen | Pending |
| PLAT-01 | Phase 4: Planner Screen | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after initial definition*
