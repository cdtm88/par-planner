# Architecture Patterns: Hole Planner

**Domain:** Golf strategy planning — brownfield Expo/React Native
**Researched:** 2026-04-12
**Confidence:** HIGH (based on direct codebase inspection + domain knowledge)

---

## Context: What Exists

The planner is entering a codebase with three functional stores and a typed domain model. The key constraint
is that `HolePlan` (already typed) stores strategy as plain strings — `teeClub`, `target`, `avoid`,
`reasoning` — with no geometry. The planner must produce `GamePlan` (typed) from course geodata and
player profile, then persist it through `planStore`.

Existing data flow that feeds the planner:
```
search.tsx → fetchAndCacheCourse → courseStore.courses[courseId]
               ↓
           router.push('/planner', { courseId, tee })
```

The planner screen starts with `courseId` and `tee` in params. The full `Course` object (including all
hole geodata) is guaranteed to be in `courseStore.courses` by the time the router navigates — the search
screen already fetches-and-caches before navigating.

---

## Research Question 1: Landing Zone Representation

**Verdict: Use a simple circle (center + radius in yards), not a polygon or probability cloud.**

Real golf GPS apps (Arccos, Golfshot, Shot Scope) represent expected landing areas as circles centered
on the target line. The circle radius encodes dispersion — it is not a probability distribution, it is a
"safe zone" boundary. This matches what the planner needs: "will this shot clear the hazard or not?"

**The right model:**

```typescript
// src/types/index.ts addition
export interface LandingZone {
  centerYardsFromTee: number;   // distance along the hole axis
  radiusYards: number;          // dispersion radius
  lateralOffsetYards: number;   // left (negative) / right (positive) of center line
}
```

**Why not polygon:** Geodata polygons describe fixed course features (hazards, fairway). A landing zone
is a player-specific prediction, not a course feature. Mixing the two coordinate systems (geo lat/lng vs
yards-from-tee) adds complexity without benefit — the planner works in yards, not geo coordinates.

**Why not probability cloud:** Gaussian dispersion is academically interesting but operationally useless
for a planning app. The player needs "will I clear the bunker?" — a binary the circle answers cleanly.
The tendency enum (straight/fade/draw/slice) maps directly to `lateralOffsetYards`.

**Tendency → lateral offset mapping:**
```
straight:     0
slight-fade:  +5 yds
fade:         +12 yds
slice:        +25 yds
slight-draw:  -5 yds
draw:         -12 yds
hook:         -25 yds
```

**Dispersion radius by club type:**
```
driver / 3-wood:  ±25 yds
long irons (2-4): ±20 yds
mid irons (5-7):  ±15 yds
short irons (8-9/PW): ±10 yds
wedges / putter:  ±6 yds
```

These are conservative estimates for amateur golfers. The algorithm is pure calculation — no AI needed.

**Hazard clearance check** (pure function, no external dependencies):
```
cleared = (hazardDistanceFromTee - carryYards) > 0
           AND lateralOverlap(landingZone, hazardProjection) === false
```

---

## Research Question 2: Claude Call Structure — One Per Hole vs One For Round

**Verdict: One Claude call for the entire round, not 18 parallel calls.**

**Option A — 18 parallel calls (one per hole):**
- Latency: Claude Haiku ~1-2s per call; with 18 parallel, bounded by slowest = ~3-4s total
- Cost: 18 API calls × token overhead per call; significant prompt scaffolding repeated 18×
- Complexity: requires Promise.all with individual error handling; a single hole failure leaves a gap
- Upside: can stream hole-by-hole as results arrive

**Option B — 1 call for entire round:**
- Latency: larger context but single round-trip; Claude Haiku can handle 18-hole context in ~3-5s
- Cost: cheaper per-token due to shared context (course description, player profile sent once)
- Complexity: one error surface, one retry, one response to parse
- Upside: Claude can reason across holes ("save the driver for hole 10, it suits your draw")
- Downside: response must be JSON array; parsing can fail at round level

**Recommendation: One call for the round with structured JSON output.**

The cross-hole reasoning advantage is real for golf strategy. A planner that says "lay up on 7 to leave
a better angle on 8" is more valuable than 18 independent hole analyses. This is impossible with parallel
per-hole calls.

**Prompt structure:**
```
System: You are a golf strategy advisor. Return ONLY valid JSON — an array of 18 objects.
        Each object: { hole, teeClub, target, avoid, reasoning }

User:   Course: {courseName} | Tee: {tee}
        Player: {handicap} handicap, {shotTendency} ball flight
        Bag: {club: carryYards pairs for selected clubs only}

        Holes:
        Hole 1 | Par 4 | 376 yds | Hazards: Swilcan Bunker (bunker, right at ~220 yds)
        Hole 2 | Par 4 | 411 yds | Hazards: Swilcan Burn (water, short of green)
        ...

        For each hole, recommend the safest tee club from the bag provided.
```

**Model choice:** Claude Haiku (claude-haiku-3-5) — fast enough for planning UX (3-5s), cheap enough
for repeated use. Sonnet only if users report strategy quality is inadequate.

**Fixture mode:** The existing `strategy-sample.json` already covers holes 1-2. Expand it to 18 holes
and return it when `EXPO_PUBLIC_ANTHROPIC_API_KEY` is not set, matching the Maps4Golf fixture pattern.

---

## Research Question 3: Upfront vs Lazy Calculation

**Verdict: Calculate all 18 holes upfront with a loading screen, then show all.**

**Option A — All upfront:**
- One loading moment (3-6s) before the planner is usable
- User gets a complete plan they can scroll, review, and override at leisure
- Simpler state: either "loading" or "complete" — no incremental states
- Works better for plan persistence (save the whole thing at once)

**Option B — Lazy per hole:**
- Requires tracking "planned" vs "not yet planned" per hole
- Causes re-fetching Claude if user scrolls back to a hole that was evicted from memory
- Creates confusing UX: some holes show "tap to plan" while others show cards
- Does not work for the cross-hole Claude call (see Q2) — the whole round is one call

**The cross-hole Claude call locks in Option A.** With a single round-level Claude response, you have
all 18 plans the moment the call returns. There is no lazy option at that point.

**Loading screen UX:**
```
1. Screen mounts → show loading state: "Building your game plan..."
2. Algorithm runs synchronously (pure calculation, instant)  
3. Claude call fires → await response (~3-5s)
4. Parse response → merge algorithm output + AI commentary into HolePlan[]
5. Save draft to planStore
6. Transition to scrollable hole list
```

---

## Research Question 4: Plan Persistence — Draft vs Complete

**Verdict: Save as draft immediately after generation, mark complete only when user confirms.**

The `GamePlan` type already has a `complete: boolean` field — use it exactly as intended.

**State machine:**
```
GENERATING → save GamePlan { complete: false } to planStore immediately after Claude returns
REVIEWING  → user scrolls, overrides clubs; each override updates the draft in planStore
CONFIRMED  → user taps "Save Plan"; set complete: true, timestamp confirmed
```

**Why save draft immediately:** If the app crashes or the user backgrounds it during review, they
lose 5 seconds of AI computation. Saving the draft on generation protects that work.

**Why not wait for all overrides:** Overrides are incremental edits to the draft, not a "complete"
action. The "complete" flag means the golfer is satisfied with the plan as their round plan.

**Override handling:** Each club override on a hole should update `planStore` in place — no re-calling
Claude. The landing zone recalculates locally (pure algorithm). The AI commentary (`reasoning`) stays
from the original Claude response unless the player explicitly requests a re-think (v2 feature).

**planStore needs these actions:**
```typescript
createDraft: (plan: GamePlan) => void          // saves complete:false plan
updateHolePlan: (planId, holeNumber, override) => void  // updates one HolePlan
confirmPlan: (planId: string) => void           // sets complete:true
deletePlan: (planId: string) => void            // cleanup
```

---

## Research Question 5: Algorithm vs AI Separation

**Verdict: Strict separation — pure algorithm module with no AI dependency, Claude only for commentary.**

```
src/
  planning/
    algorithm.ts       ← pure functions, no external deps, fully testable
    claudeStrategy.ts  ← single API call, returns raw HolePlan[] from Claude
    planner.ts         ← orchestrates: algorithm → Claude → merge → save
```

**algorithm.ts responsibilities (pure, synchronous):**
- `selectClub(hole, bag, tendency): Club` — pick the safest club by clearance check
- `calculateLandingZone(club, tendency): LandingZone` — circle model
- `checkHazardClearance(landingZone, hazards): boolean` — does the shot clear everything?
- `buildHoleContext(hole): string` — format hole data for Claude prompt

**claudeStrategy.ts responsibilities:**
- Build the full-round prompt from hole contexts + player profile
- Call Claude API (one call)
- Parse and validate the JSON response
- Return `Array<{ hole, teeClub, target, avoid, reasoning }>` or throw

**planner.ts (orchestrator):**
```typescript
async function buildGamePlan(course, tee, profile): Promise<GamePlan> {
  const holes = course.tees.find(t => t.name === tee)?.holes ?? [];

  // 1. Algorithm — pure, instant, no failures
  const algorithmResults = holes.map(hole =>
    selectClub(hole, profile.bag, profile.shotTendency)
  );

  // 2. Claude — one call, may fail, needs fallback
  let aiResults: AiHolePlan[];
  try {
    aiResults = await fetchRoundStrategy(course, tee, holes, profile);
  } catch {
    // Fallback: use algorithm-selected clubs with empty commentary
    aiResults = algorithmResults.map(r => ({
      hole: r.holeNumber,
      teeClub: r.club.name,
      target: 'Centre fairway',
      avoid: 'Hazards',
      reasoning: 'Strategy unavailable offline.',
    }));
  }

  // 3. Merge — algorithm club takes precedence if Claude picks a club not in bag
  const holePlans: HolePlan[] = holes.map((hole, i) => ({
    holeNumber: hole.number,
    teeClub: validateClubInBag(aiResults[i].teeClub, profile.bag)
      ?? algorithmResults[i].name,
    target: aiResults[i].target,
    avoid: aiResults[i].avoid,
    reasoning: aiResults[i].reasoning,
    confirmed: false,
  }));

  return {
    id: generateId(),
    courseId: course.id,
    courseName: course.name,
    tee,
    createdAt: new Date().toISOString(),
    holes: holePlans,
    complete: false,
  };
}
```

This means: **the algorithm always produces a complete plan**. Claude enriches it. If Claude fails
(network error, API limit, offline), the user still gets a usable plan.

---

## Recommended Component Boundaries

```
app/planner.tsx                  ← screen only; reads params, renders state
  │
  ├── usePlannerSession()        ← local hook: manages generating/reviewing state
  │     calls: planner.ts (orchestrator)
  │     writes: planStore (draft then confirmed)
  │     reads: courseStore (course data), profileStore (bag + tendency)
  │
  ├── <PlannerLoadingScreen />   ← shown during Claude call
  ├── <HolePlanList />           ← FlatList of 18 HolePlanCard
  │     └── <HolePlanCard />     ← one hole: club, target, avoid, reasoning, override CTA
  │           └── <ClubPicker /> ← bottom sheet for club override
  └── <ConfirmPlanBar />         ← sticky footer with "Save Plan" button
```

**Data flow (read path):**
```
courseStore.courses[courseId] → Tee → Hole[]
profileStore.profile          → PlayerProfile
         ↓
   planner.ts (orchestrates algorithm + Claude)
         ↓
   planStore.createDraft(GamePlan)
         ↓
   usePlannerSession() returns { plan, isGenerating, overrideClub, confirmPlan }
         ↓
   HolePlanList renders from plan.holes[]
```

**Data flow (override path):**
```
User taps club on HolePlanCard
→ ClubPicker opens (shows bag clubs with carry distances)
→ User selects club
→ usePlannerSession.overrideClub(holeNumber, club)
→ algorithm recalculates landing zone locally (no Claude call)
→ planStore.updateHolePlan(planId, holeNumber, { teeClub: club.name })
→ HolePlanCard re-renders with updated club
```

---

## Suggested Build Order

**Build in this order — each step is independently testable:**

1. **`src/planning/algorithm.ts`** — pure functions with no dependencies. Write unit tests. This
   is the foundation everything else sits on. Can be built and tested before any UI exists.

2. **`src/planning/claudeStrategy.ts`** — single-file API client. Wire to fixture mode first
   (return `strategy-sample.json` expanded to 18 holes). Claude integration follows once fixture
   tests pass.

3. **`src/planning/planner.ts`** — orchestrator. At this point both inputs are testable in
   isolation. Test the merge logic and fallback behavior.

4. **`src/store/planStore.ts`** — implement the four actions (`createDraft`, `updateHolePlan`,
   `confirmPlan`, `deletePlan`) with Zustand persist (same pattern as courseStore).

5. **`app/planner.tsx` + `usePlannerSession`** — wire up the screen. Use fixture data end-to-end
   before connecting live Claude. The loading screen + FlatList + club override should all work
   against fixture output before real AI is involved.

6. **Live Claude integration** — swap fixture for real API call. Validate response shape. Add
   error fallback (algorithm-only mode when offline).

---

## Architectural Patterns That Apply

**Pattern: Algorithm-first, AI-enriches**
Never let Claude be a blocker. The algorithm produces a complete, usable plan. Claude adds reasoning
and can adjust the club choice — but if it fails, the player still gets a plan. This is the right
architecture for an offline-capable mobile app.

**Pattern: Draft-then-confirm persistence**
Matches the `GamePlan.complete` field already in the type system. Saves computation immediately, lets
users review without pressure, draws a clear line between "AI generated this" and "I approved this."

**Pattern: Yards-only calculation domain**
Keep the algorithm entirely in yards (distance, lateral offset, radius). Never mix lat/lng into the
calculation layer. The `HoleGeodata` geodata is only needed if rendering a visual map overlay —
which is explicitly deferred to v2 (on-course GPS mode). For v1, distances can be derived from
`Hole.distanceYards` and hazard labels; geodata is available but not required by the algorithm.

**Pattern: Fixture-parity**
Every external dependency (Maps4Golf, Claude) has a fixture mode. The `claudeStrategy.ts` module
should check `EXPO_PUBLIC_ANTHROPIC_API_KEY` and return expanded fixture data when absent — same
pattern as `mapsgolf.ts`. This keeps development fast and CI free of API keys.

---

## Type System Notes

The existing `HolePlan` type uses `confirmed: boolean`. This is per-hole confirmation. In practice,
the planner should treat this as "user has reviewed this hole's plan" — a visual indicator (checkmark)
rather than a gate. The `GamePlan.complete` flag is the round-level save action.

`LandingZone` is a new type needed in `src/types/index.ts`. It lives in the algorithm layer — it is
never persisted (not part of `HolePlan` or `GamePlan`). It is computed on-render and discarded.

`HolePlan.teeClub` is a `string` (club name). When Claude returns a club name, it must be matched
against `profile.bag` by name (case-insensitive). If no match, fall back to the algorithm's selection.
This validation belongs in `planner.ts`, not in the Claude module.

---

## Confidence Assessment

| Question | Confidence | Basis |
|----------|------------|-------|
| Landing zone model (circle) | HIGH | Domain standard; matches existing type structure |
| One Claude call for round | HIGH | Cross-hole reasoning advantage is structural; cost/latency math is reliable |
| Upfront generation | HIGH | Forced by single-call Claude architecture |
| Draft persistence model | HIGH | `GamePlan.complete` field already encodes this design |
| Algorithm/AI separation | HIGH | Standard resilience pattern for AI-augmented apps |
| Claude response latency (3-5s) | MEDIUM | Based on known Haiku characteristics; verify in practice |
| Tendency → lateral offset values | MEDIUM | Conservative amateur estimates; calibrate with user feedback |
