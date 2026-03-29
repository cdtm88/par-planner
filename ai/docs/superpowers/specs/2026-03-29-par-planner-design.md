# Par Planner — Design Spec
**Date:** 2026-03-29
**Status:** Approved

---

## Overview

Par Planner is a React Native mobile app that lets golfers plan their round hole-by-hole before they play, then follow that plan on the course. The core problem it solves: arriving at an unfamiliar course with a clear, personalised game plan so the player can focus on enjoying the round rather than making strategic decisions under pressure.

---

## Goals

- Generate a personalised 18-hole strategy before the round based on the player's bag and shot tendency
- Display hole maps with hazard data so decisions are grounded in the actual course layout
- Provide a distraction-free on-course view that works fully offline
- Minimise API calls through aggressive local caching and dev fixtures

---

## MVP Scope

### Out of scope for MVP
- Web planning portal (future phase)
- On-course AI refinement based on GPS tee position (post-MVP)
- Score logging and round history
- Social / sharing features

---

## Tech Stack

| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | React Native + Expo (managed workflow) | Best path for first publishable native app; iOS + Android from one codebase |
| Navigation | Expo Router | File-based routing, familiar to Next.js developers |
| State | Zustand | Lightweight, minimal boilerplate for MVP scale |
| Local storage | AsyncStorage | Persists course cache and saved plans on-device |
| Course data | Maps4Golf REST API | 39k+ courses globally, scorecard + hazard geodata, per-call pricing |
| AI strategy | Claude API (Anthropic) | Generates hole-by-hole strategy from hole data + player profile |

---

## Player Profile

Set once during onboarding, editable at any time.

**Build a Bag**
- Player selects which clubs they carry (e.g. Driver, 3W, 5i–PW, SW, Putter)
- For each club: carry distance in yards (or metres)

**Shot Tendency**
- Single selection: Straight / Slight Fade / Slice / Slight Draw / Draw / Hook

**Handicap** (optional, used for difficulty-appropriate language in AI suggestions)

---

## Screens

### 1. Onboarding / Profile
First-run screen to build the bag and set shot tendency. Skippable but AI strategy quality degrades significantly without it. Accessible later via Settings.

### 2. Home
- List of saved game plans (course name, date created)
- "Plan New Round" CTA
- Tap a saved plan to jump straight into on-course mode

### 3. Course Search
- Text search by course name or location
- Results from Maps4Golf API
- Selecting a course triggers a single API call to fetch full hole data (scorecard + geodata)
- Data cached permanently after first fetch — no repeat calls for the same course
- After selecting a course, player chooses which tee they'll play (e.g. yellow, white, red) — this determines distances used throughout the plan

### 4. Hole-by-Hole Planner
- Displays one hole at a time; navigate forward/back through all 18
- Each hole shows: hole map (rendered from geodata polygons — fairway, green, bunkers, water hazards, tee box), par, distance from selected tee, hazard overlay
- On first load, Claude generates strategy for all 18 holes in a single API call using hole geodata + player profile
- AI suggestion pre-fills: recommended tee club, target zone description, hazards to avoid, one-line reasoning
- Player can confirm as-is (one tap) or edit any field
- Progress is auto-saved after each hole is confirmed — exiting and returning resumes from where the player left off
- Plan is marked complete and available in on-course mode once all 18 holes are confirmed

### 5. On-Course Mode
- Accessed from Home by selecting a saved plan
- Works fully offline — reads only from local storage, zero network calls
- Layout: split view — hole map on the left, plan on the right (club, target, avoid)
- Large text optimised for outdoor readability
- Swipe left/right to advance or go back between holes
- Hole number and par shown prominently at the top

---

## Data Flow

```
Player Profile (local)
        +
Course Search → Maps4Golf API (once per course) → AsyncStorage cache
        ↓
Planner → Claude API (once per plan, all 18 holes) → Plan saved to AsyncStorage
        ↓
On-Course Mode → reads from AsyncStorage only (offline)
```

---

## Caching Strategy

| Data | Cache duration | Storage |
|------|---------------|---------|
| Course + hole geodata | Permanent (courses don't change) | AsyncStorage |
| Saved game plans | Until manually deleted | AsyncStorage |
| Player profile | Permanent | AsyncStorage |

**Dev/test:** A set of fixture JSON files replicates Maps4Golf and Claude API responses. No real API calls are made during development or automated testing.

---

## AI Strategy — Claude API

**Input per hole:**
- Hole number, par, distance from selected tee
- Hazard positions and types (bunker, water, OB) from geodata
- Player's bag: clubs + carry distances
- Player's shot tendency

**All 18 holes sent in a single prompt.** Claude returns a structured JSON array with one entry per hole:

```json
{
  "hole": 7,
  "tee_club": "Driver",
  "target": "Left centre fairway, short of the bunker at 240 yds",
  "avoid": "Bunker right at 240 yds, OB left",
  "reasoning": "Your draw will run out toward the right bunker — aim left centre to use the slope."
}
```

---

## Post-MVP Backlog

**On-course AI (tee position refinement)**
GPS detects the player is near the tee. Player can request an updated recommendation accounting for actual tee marker position that day (tee boxes move). Requires on-course network access — breaks the offline-first rule, so this needs careful UX design in its own phase.

**Web planning portal**
Responsive web app for planning on a laptop with a larger screen. Syncs plans to the mobile app.

---

## Open Questions

None — all key decisions resolved during design session.
