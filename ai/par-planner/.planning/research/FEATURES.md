# Feature Landscape: Golf Strategy / Hole Planner

**Domain:** Golf GPS and pre-round strategy mobile app
**Researched:** 2026-04-12
**Confidence note:** WebSearch was unavailable. Competitive findings below are drawn from training knowledge of Arccos Golf, Golfshot, Shot Scope, GolfLogix, 18Birdies, and Game Golf (knowledge cutoff August 2025). Claims marked LOW confidence where based solely on training data without verification. Project-grounded findings (from codebase context) are HIGH confidence.

---

## Table Stakes

Features that users of any serious golf GPS/strategy app expect. Missing = the app feels like a prototype.

| Feature | Why Expected | Complexity | Confidence | Notes |
|---------|--------------|------------|------------|-------|
| Club recommendation per hole | Core promise of the category | Med | HIGH (in scope) | Already typed as `teeClub` in `HolePlan` |
| Hole distance to target | Every GPS app shows this | Low | HIGH | Available from `Hole.distanceYards` via Maps4Golf |
| Par and stroke index display | Basic course context; used for decision-making | Low | HIGH | Both in `Hole` type already |
| Hazard awareness in recommendations | Without this, club selection is naive | Med | HIGH (in scope) | `Hazard` type already models bunker/water/OB |
| Hole-by-hole linear progression | Users think in holes 1-18; non-linear access confuses flow | Low | MEDIUM | Industry norm; golfers plan hole by hole |
| Plan persistence across sessions | Users plan the night before; losing it on restart is a critical failure | Low | HIGH (known tech debt) | planStore currently has no persistence |
| Tee-aware planning | Distances differ by tee colour; plan must match selected tee | Low | HIGH (in scope) | Tee selection already implemented upstream |
| Profile-aware recommendations | App must know the player's bag or it's useless | Med | HIGH | profileStore already has bag + tendency |

---

## Differentiators

Features that the better apps have which elevate them above commodity GPS tools. Not expected on arrival, but valued once discovered.

| Feature | Value Proposition | Complexity | Confidence | Notes |
|---------|-------------------|------------|------------|-------|
| AI strategic commentary | Calculation tells you *what*; AI explains *why* and handles edge cases calculation misses | High | HIGH (in scope) | Claude integration planned; strategy-sample.json shows format |
| Shot tendency in recommendations | Plans built around how *this player* misses, not an average golfer | Med | HIGH (in scope) | `ShotTendency` already typed with 7 values |
| Hazard avoidance with club fallback | Proactively suggests safer club when primary choice lands in trouble | Med | HIGH (in scope) | Core requirement; needs geometric intersection logic |
| Landing zone visualisation | Shows *where* the ball will likely land, not just which club | High | MEDIUM | Would require map rendering; not in v1 scope |
| Club override with instant recalculation | Player knows course better than the algorithm; they need to correct it | Low | HIGH (in scope) | `confirmed: boolean` on HolePlan suggests override intent |
| Lay-up vs attack distinction | Par 5s and long par 4s often have a conservative and aggressive line | Med | MEDIUM | Not currently modelled; would add value in AI commentary |
| Wind/conditions notes | Pre-round planning benefits from conditions context | Low | LOW | Training data only; adds friction if manual input required |
| Handicap-aware recommendations | Stroke index per hole means some holes play differently for high handicappers | Med | MEDIUM | `strokeIndex` is in `Hole` type; handicap in `PlayerProfile` |

---

## Anti-Features

Features that sound good in a product pitch but actively hurt UX when implemented.

| Anti-Feature | Why It's a Problem | What to Do Instead |
|--------------|-------------------|-------------------|
| Per-shot planning (approach, chip, putt) | Pre-round planning is for tee shots and layup decisions. Modelling every shot creates cognitive overload and requires data (lie, wind, pin position) nobody has before teeing off | Tee shot + notable approach decision per hole only |
| Forcing linear hole-by-hole wizard | Locking users to Hole 1 → 2 → 3 order is rigid; players may want to review hole 7 after checking conditions | Allow navigation between holes, but recommend linear flow as the default |
| Live GPS tracking in v1 | On-course GPS requires foreground location permissions, background processing, battery management, and a fundamentally different UX. It is a separate product | Stay pre-round planning only; map to v2 on-course mode |
| Score entry | Par Planner is explicitly not a scoring app. Adding scoring creates feature conflict with Arccos/Golfshot and distracts from the core planning value prop | Hard no; reference project's Out of Scope decision |
| Social sharing in v1 | Adding share plans requires backend, auth, privacy decisions, and moderation — each multiplying scope | Local-only in v1; defer social to post-v1 |
| Star ratings for courses | No mechanism to collect or verify; would require backend | Out of scope |
| Club distance auto-calibration (ML) | Inferring carry distances from tracked shots requires GPS hardware integration and many rounds of data. Faking it with estimates misleads the user | User-entered distances (current approach) are honest and sufficient |
| Swing analysis | Completely out of domain for a planning app; would require camera access, CV, and specialist ML | Hard no |

---

## Shot Tendency: User-Configured vs ML-Inferred

**Question:** What does "shot tendency" mean in comparable apps — is it user-configured or ML-inferred from tracked rounds?

**Arccos Golf and Shot Scope** infer tendency automatically from GPS-tracked shot data after sufficient rounds. Arccos explicitly markets "strokes gained" and AI-inferred handicap adjustment. This requires hardware (sensors in club grips or a watch) and a data collection phase before the analysis is useful. MEDIUM confidence — from training data.

**Golfshot and GolfLogix** use a simpler model: user-declared tendency (fade/draw) combined with GPS distances for pre-round recommendations. No ML inference. MEDIUM confidence.

**Par Planner's approach (user-configured, 7-level scale) is correct for v1.** It is:
- Honest — does not pretend to have shot data it hasn't collected
- Immediately useful — works from round 1
- Aligned with the local-only / no-backend constraint
- Already implemented in `profileStore` with `ShotTendency` type

The 7-level scale (straight, slight-fade, fade, slice, slight-draw, draw, hook) is more granular than most apps in this category, which is a differentiator. MEDIUM confidence.

---

## Typical UX for Hole-by-Hole Planning

Based on training knowledge of the apps listed. MEDIUM confidence overall.

**Linear progression is the norm.** Users swipe or tap "Next Hole" to advance through all 18 (or 9) holes. Arccos, Golfshot, and 18Birdies all use card or swipeable-list metaphors. Non-linear access (jump to hole 12) is typically available via a hole-list overview screen, but the *default flow* is sequential.

**Three UX patterns exist:**

1. **Card per hole** (most common): Full screen card for each hole with map, par, distance, and recommendation. Swipe left/right to navigate. Arccos and Golfshot use variations of this. Good for focus; bad for overview.

2. **Scrollable list** (simpler): All 18 holes stacked vertically, each with a summary row. User scrolls. GolfLogix tends toward this model. Good for overview; can feel dense.

3. **Accordion / collapsible** (rare): Each hole collapsed to summary, expanding on tap. Adds interaction cost.

**Recommendation for Par Planner:** Card per hole (1-18), with a holes-list header or dot-navigation showing position. Linear default, non-linear access via header. This matches how golfers think on the night before a round — they start at hole 1.

**Summary screen matters.** The apps that feel complete have a plan summary: course name, tee, total yardage, and a condensed view of every hole's recommendation. Users want to review before printing (metaphorically) and heading to the course.

**Override interaction.** Better apps let you tap the recommended club and see a picker with alternatives. When you override, the hazard analysis updates to reflect your choice. This is already modelled in the `confirmed` field on `HolePlan`.

---

## Feature Dependencies

```
Player bag + carry distances → Club recommendation
Club recommendation + ShotTendency → Landing zone estimate
Landing zone estimate + Hazard geodata → Hazard detection
Hazard detection → Club fallback / alternative suggestion
Club recommendation + Hazard context + Hole layout → AI commentary
All HolePlans confirmed → Plan persistence (save GamePlan)
```

---

## MVP Recommendation for This Milestone

Par Planner v1 should build exactly what is in scope and no more.

**Build:**

1. Hole card UI (linear, 1-18), card per hole with par, distance, stroke index
2. Club recommendation algorithm (carry distance + tendency → safest club given hazards)
3. Hazard detection and club fallback suggestion (core differentiator vs commodity apps)
4. AI commentary via Claude per hole (uses strategy-sample.json format: target, avoid, reasoning)
5. Club override (tap to change, re-run hazard check)
6. Plan save to planStore with AsyncStorage persistence (fix known tech debt)
7. Plan summary screen / home screen plan list (already partially scaffolded in index.tsx)

**Do not build in this milestone:**

- Map/visual landing zone overlay — adds react-native-maps or equivalent; separate spike
- Wind/conditions input — manual friction, no payoff without on-course mode
- Lay-up modelling as a separate UI interaction — let AI commentary handle it narratively
- Per-shot planning beyond the tee shot

---

## Sources

- `/Users/christianmoore/ai/par-planner/.planning/PROJECT.md` — authoritative v1 scope (HIGH confidence)
- `/Users/christianmoore/ai/par-planner/src/types/index.ts` — existing domain model (HIGH confidence)
- `/Users/christianmoore/ai/par-planner/fixtures/strategy-sample.json` — AI output format reference (HIGH confidence)
- `/Users/christianmoore/ai/par-planner/.planning/codebase/ARCHITECTURE.md` — existing implementation context (HIGH confidence)
- Competitive landscape (Arccos, Golfshot, Shot Scope, GolfLogix, 18Birdies, Game Golf) — training data, knowledge cutoff August 2025, WebSearch unavailable (MEDIUM/LOW confidence where stated)
