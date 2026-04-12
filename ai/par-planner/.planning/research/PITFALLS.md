# Domain Pitfalls: Hole Planner with Geospatial + Claude AI

**Project:** Par Planner — hole-by-hole planner screen
**Researched:** 2026-04-12
**Scope:** Five risk areas — geospatial data quality, Claude API from mobile, Expo SDK 54 + AI/network, RN geospatial libraries, Maps4Golf data completeness

---

## Critical Pitfalls

### Pitfall 1: API Key Exposure for Claude — Mobile Bundle Contains Secret Key

**Severity:** HIGH
**Likelihood:** CERTAIN if built naively (key placed in EXPO_PUBLIC_* or hardcoded)
**Blocks v1:** Yes — must be resolved before shipping

**What goes wrong:**
The existing pattern for Maps4Golf (`EXPO_PUBLIC_MAPS4GOLF_API_KEY`) is safe because Maps4Golf API keys are designed for client-side use and can be key-restricted by domain/referrer. The Anthropic Claude API key is NOT safe to bundle client-side. It is a full secret key with no IP or domain restriction capability. Any user who downloads the app can extract it from the JS bundle using standard tools (Metro bundle inspection, `strings` on the binary, or frida-based extraction). With the key, they can run arbitrary Claude API calls billed to your account.

**Why it happens:**
`EXPO_PUBLIC_*` variables are intentionally embedded in the compiled JS bundle — that is their purpose. Developers assume all API keys work the same way. They do not. Maps4Golf keys are rate-limited per-course-type and low-value to extract. Claude API keys grant full LLM access.

**Consequences:**
- Key extracted → free API usage by bad actors → unbounded billing ($0.003 per 1K input tokens × attackers = hundreds/thousands of dollars)
- No way to detect extraction until the bill arrives
- Key rotation requires an app store update (new build + review cycle)

**Prevention — Required Pattern:**
Do not call the Claude API directly from the Expo app. Route all Claude calls through a thin serverless proxy:

```
Expo app → POST /api/strategy { courseId, holeData, playerProfile }
           → Vercel/Cloudflare Worker → Anthropic API (key stored as env secret)
           → Response streamed back to app
```

The proxy validates input size, applies per-device rate limiting, and holds the key in a server-side environment variable that is never bundled. For v1, a single Vercel serverless function is sufficient — free tier handles the call volume.

**Acceptable temporary approach for development only:**
Fixture mode (already exists in the codebase). The existing `fixtures/strategy-sample.json` is the correct development path. Build the planner screen entirely against fixtures first, add the proxy when approaching release.

**Detection:** Run `npx expo export` and `grep -r "sk-ant" dist/` — any match means the key is exposed.

---

### Pitfall 2: Maps4Golf Hazard Polygon Data Is Incomplete for Most Courses

**Severity:** HIGH
**Likelihood:** HIGH — confirmed by fixture data structure and industry-standard behavior
**Blocks v1:** No — degrades gracefully if handled correctly; blocks only if app assumes full data

**What goes wrong:**
The `HoleGeodata` type already shows the risk: `fairwayPolygon: Coordinate[] | null`. The fixture itself demonstrates this — hole 2 has `fairwayPolygon: null`. This null-pattern almost certainly extends to hazards in production. For most courses in a golf API:

- Premium/famous courses (St Andrews, Augusta, etc.): full polygon data
- Popular municipal and resort courses: tee box + green center points, partial hazard data
- Smaller regional clubs: distance/par/stroke index only; geodata absent entirely
- `geodata: null` at the `Hole` level is already typed as possible in the codebase

Golf course geodata is expensive to digitize. APIs like Maps4Golf typically have complete polygon data for a small percentage of their total course inventory (industry estimate: 20-30% of courses have full hazard polygon data; 60-70% have at least tee and green centroids; 10-20% have no geodata at all).

**Consequences if not handled:**
- Algorithm tries to calculate `polygon.length` on `null` → runtime crash
- Planner shows "safe to hit driver" when it has no hazard data to check against
- App feels broken for users at courses outside premium inventory

**Prevention:**
Design the algorithm with explicit geodata confidence tiers:

```
Tier A — Full geodata:   tee + fairway + green polygons + hazard polygons
         → Run full landing zone vs hazard intersection calculation
         → Show specific yardage targets and hazard warnings

Tier B — Partial geodata: tee + green centroid, no fairway, no/partial hazards  
         → Fall back to distance-only recommendation
         → AI commentary still meaningful (has hole distance + par + stroke index)
         → Show "Limited course data — club distances estimated from yardage"

Tier C — No geodata:    geodata: null
         → Distance-only mode (par + yardage → stock recommendation by hole type)
         → AI works fine (doesn't need polygon coords)
         → Show "No course map available — showing distance-based plan"
```

The `HolePlan` type (`target`, `avoid`, `reasoning`) supports all three tiers — the fields just get less specific. Never crash, never show false precision.

**Detection warning sign:** Any algorithm code that accesses `hole.geodata.hazards` without first checking `hole.geodata !== null` is a bug.

---

### Pitfall 3: Geospatial Coordinate Accuracy — Showing "Safe" When It Is Not

**Severity:** HIGH
**Likelihood:** MEDIUM — depends on course and API tier
**Blocks v1:** No — mitigation is architectural, not a blocker

**What goes wrong:**
Golf course geodata from third-party APIs has typical horizontal accuracy of 2-10 metres for tee and green centroids, and 3-15 metres for polygon vertices. A golf hole is 30-50 yards wide at the fairway. For a landing zone calculation:

- A driver carries ~250 yards. A 1% error in coordinate placement = 2.5 yards lateral offset.
- A bunker polygon that is 5m misplaced relative to reality = a golfer who aims "just left of the bunker" per the app hits the bunker on the actual course.
- Coordinate datum issues (WGS84 vs local survey datum): rare but real, causes systematic offsets of 5-50m.

The specific risk for this app: the algorithm calculates whether a shot landing zone ellipse intersects a hazard polygon. If hazard polygons are digitised from satellite imagery rather than survey, they may be offset from the actual physical bunker or water feature by several metres. The app says "clear" — the golfer finds sand.

**Accepted tolerance in the golf app industry:**
Real golf GPS apps (Arccos, Shot Scope, 18Birdies) address this in two ways:
1. They display a visual map overlay so users can see the polygon vs the satellite and judge for themselves
2. They apply a safety buffer — recommendations stay X yards away from hazard polygon edges, not right up to them

**Prevention:**
Apply a mandatory safety buffer in all calculations. Do not recommend landing zones within 10 yards of any hazard polygon edge. This absorbs both coordinate inaccuracy and carry distance variability (±10% on club distances is realistic). Express recommendations as "aim for the left-centre of the fairway, short of the bunker at 210 yards" not "land in the 4-yard gap between the rough and the bunker."

The algorithm should compute: `recommendedCarry = hazardEdgeDistance - safetyBuffer` where `safetyBuffer = max(10, hazardEdgeDistance * 0.08)`.

Additionally, the `Coordinate` type stores `lat/lng` as plain floats with no metadata about accuracy or source. When Maps4Golf API integration is built, note whether the API provides an accuracy/confidence field per polygon — if so, widen the buffer proportionally.

---

## Moderate Pitfalls

### Pitfall 4: Geospatial Libraries — Node.js-Only APIs Break in React Native / Hermes

**Severity:** MEDIUM
**Likelihood:** HIGH if you reach for npm geospatial packages without vetting
**Blocks v1:** No — pure-JS implementation avoids the problem entirely

**What goes wrong:**
Popular geospatial libraries depend on Node.js APIs that do not exist in React Native's Hermes runtime or in the browser:
- `turf.js` (`@turf/turf`) — the most popular geospatial library. Uses `Buffer`, `fs`, and some Node stream internals in parts of its build. The main bundle works in RN for basic operations, but importing the full package adds ~500KB and some sub-packages fail at runtime. Specific functions known to cause issues: `turf/packages/turf-projection`, any SVG/canvas output.
- `geolib` — pure JS, works in React Native. Safe choice for distance calculations and point-in-polygon.
- `geodesy` — pure JS, works in React Native. Haversine, Vincenty distance formulas.

**For this project, the required operations are:**
1. Haversine distance between two `Coordinate` points (tee → target)
2. Ray-casting point-in-polygon for hazard intersection
3. Ellipse/radius point generation for landing zone

All three are implementable in ~60 lines of pure TypeScript with zero dependencies. The Hermes engine handles standard `Math.*` operations correctly. No library is needed.

**Prevention — Recommended approach:**
Write a `src/utils/geo.ts` module with:
- `distanceYards(a: Coordinate, b: Coordinate): number` — haversine formula, converts metres to yards
- `pointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean` — ray-casting algorithm
- `landingZoneCenter(tee: Coordinate, targetYards: number, bearingDeg: number): Coordinate` — forward projection using Vincenty simplified

This avoids all dependency risk, is fully testable with Jest (no native module mocks needed), and runs correctly on Hermes. If `@turf/turf` is later needed for visualisation, import only the specific sub-packages (`@turf/distance`, `@turf/boolean-point-in-polygon`) and test on device.

**The new architecture flag is relevant here:** `newArchEnabled: true` in `app.json` means the app is using the React Native New Architecture (Fabric + JSI). Native modules must be New Arch-compatible. Since the recommendation is pure JS, this is not an issue — but any geospatial library that ships a native module (e.g., react-native-maps with native rendering) must be explicitly New Arch-compatible.

---

### Pitfall 5: Claude API Latency on Cellular — 18-Hole Plan Generation Blocks UX

**Severity:** MEDIUM
**Likelihood:** HIGH on cellular (3G/4G variable latency)
**Blocks v1:** No — mitigation is UX/architecture pattern

**What goes wrong:**
If the app generates a game plan by making 18 serial Claude API calls (one per hole), and each call takes 2-4 seconds on good WiFi / 4-8 seconds on cellular, the user waits 36-144 seconds on a blocking spinner. This is unacceptable UX for a planning screen.

Even a single 18-hole batch call to Claude carries risk: the response is a large JSON array, streaming is needed to show progressive results, and Expo's `fetch` does not natively support streaming response bodies in a way that is easy to consume incrementally.

**Prevention — Batch once, not 18 times:**
Generate the full plan in a single Claude API call. The prompt includes all 18 holes' data and the player profile. The response is the full `HolePlan[]` array (matching `GamePlan.holes`). This is the pattern shown in `fixtures/strategy-sample.json` — it is already structured as an array of all holes.

Single-call latency estimate via the proxy: 3-8 seconds for an 18-hole plan (Claude Haiku: ~3s, Sonnet: ~6-8s). This is acceptable as a one-time operation if handled with:
- Optimistic loading state ("Generating your plan..." with progress indicator)
- Non-blocking: show the planner screen immediately with skeleton holes, fill in AI commentary as it arrives
- Cache the completed plan in `planStore` (which already needs persistence added per the existing CONCERNS.md) — never regenerate unless explicitly requested

**Streaming note:** If streaming is used to progressively populate holes as Claude responds, be aware that React Native's `fetch` API does not expose `response.body` as a readable stream in older RN versions. RN 0.81 (this project's version) does support the Streams API via Hermes, but it requires careful handling. The simpler approach: call without streaming, use the full JSON response, accept the 3-8 second wait with a clear loading state.

---

### Pitfall 6: EXPO_PUBLIC_* Key Pattern — Wrong Mental Model for Claude vs Maps4Golf

**Severity:** MEDIUM
**Likelihood:** HIGH — the existing code establishes `EXPO_PUBLIC_*` as the pattern for API keys
**Blocks v1:** Yes if Claude key is added this way

**What goes wrong:**
The codebase already uses `EXPO_PUBLIC_MAPS4GOLF_API_KEY`. A developer adding Claude AI support will naturally follow the same pattern and create `EXPO_PUBLIC_ANTHROPIC_API_KEY`. This is correct for Maps4Golf (public key, usage-restricted) and catastrophically wrong for Claude (billing key, no restrictions).

The existing `CONCERNS.md` already flags this under Security Considerations with the note "Key is in `EXPO_PUBLIC_*` which is safe (intentionally public for Expo apps)." This note is accurate for Maps4Golf but will create a false sense of safety for Anthropic keys.

**Prevention:**
The Claude API key must NEVER be in `EXPO_PUBLIC_*`. It must NEVER be in `.env` at the project root. It must ONLY exist as a server-side secret in the proxy deployment (Vercel env vars, Cloudflare env secrets, etc.). When implementing the proxy, add a comment in the codebase near the Maps4Golf key explaining the distinction:

```ts
// EXPO_PUBLIC_MAPS4GOLF_API_KEY: safe to bundle — Maps4Golf keys are low-value
// and usage-restricted. This is intentional.
//
// ANTHROPIC_API_KEY: NEVER use EXPO_PUBLIC_ prefix for this key. It must only
// live in the server-side proxy. See src/api/strategy.ts for the proxy call.
```

---

## Minor Pitfalls

### Pitfall 7: AsyncStorage Size Limit — Full 18-Hole Game Plans Accumulate

**Severity:** LOW
**Likelihood:** LOW for v1 usage volume
**Blocks v1:** No

**What goes wrong:**
A full `GamePlan` with AI commentary for 18 holes is approximately 8-15KB of JSON. AsyncStorage has a practical limit of 5-10MB on most devices. A user who generates plans for 50+ rounds hits the limit. The existing CONCERNS.md already notes the unbounded course cache issue — the same applies to plan storage.

**Prevention:**
When adding persistence to `planStore`, cap stored plans at 20 most recent (LRU eviction). Each `GamePlan` already has `createdAt: string` for sorting. This defers the problem well beyond v1 usage.

---

### Pitfall 8: Shot Tendency Lateral Offset Calculation — Bearing Math at High Latitudes

**Severity:** LOW
**Likelihood:** LOW (most golf courses are 30-60° latitude)
**Blocks v1:** No

**What goes wrong:**
When projecting a landing zone with lateral offset for shot tendency (fade/draw/slice/hook), naive longitude addition fails at higher latitudes because degrees of longitude shrink as latitude increases. Adding 0.001° of longitude at 56° latitude (St Andrews) is a shorter physical distance than at 20° latitude.

For fairway-scale distances this error is small (a few metres) but it is worth implementing correctly rather than fixing later.

**Prevention:**
Use a proper forward projection formula that accounts for the cosine of latitude when converting lateral yards to longitude offset:

```ts
const metersPerDegreeLat = 111_320;
const metersPerDegreeLng = 111_320 * Math.cos(lat * Math.PI / 180);
const latOffset = lateralMeters / metersPerDegreeLat;
const lngOffset = lateralMeters / metersPerDegreeLng;
```

This belongs in `src/utils/geo.ts` alongside the haversine and point-in-polygon utilities.

---

### Pitfall 9: Fixture Mode Stays On in Production if Key Is Missing

**Severity:** LOW (already noted in CONCERNS.md)
**Likelihood:** LOW with CI checks
**Blocks v1:** No

**What goes wrong:**
`isFixtureMode()` returns `true` when `EXPO_PUBLIC_MAPS4GOLF_API_KEY` is absent. If an EAS build is submitted without setting the key, the app silently uses St Andrews fixture data for all users. For Claude strategy calls routed through a proxy, a similar risk applies: if the proxy URL env var is missing, the app could silently return fixture strategies.

**Prevention:**
Add a runtime check on app start that asserts required production env vars are set in production builds. Expo's `Constants.expoConfig.extra` can be used to inject build-time assertions. At minimum, add CI steps to the build pipeline that fail if keys are missing.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Add Claude API integration | Key exposure via `EXPO_PUBLIC_*` (Pitfall 1, 6) | Build proxy first, fixture mode during dev |
| Shot landing zone algorithm | Null geodata crash (Pitfall 2) | Geodata tier check before any polygon access |
| Hazard intersection logic | False "safe" due to coordinate offset (Pitfall 3) | 10-yard minimum safety buffer on all hazard edges |
| Choosing geospatial library | Hermes runtime incompatibility (Pitfall 4) | Write pure-JS `src/utils/geo.ts`, no npm geo packages |
| Plan generation UX | 18-hole wait on cellular (Pitfall 5) | Single batch Claude call + skeleton loading state |
| Plan persistence implementation | AsyncStorage accumulation (Pitfall 7) | Cap at 20 plans, LRU eviction |
| Lateral offset for tendency | Longitude shrinkage at latitude (Pitfall 8) | Cosine-corrected projection formula |

---

## Summary: What Blocks v1 vs What Can Be Deferred

**Must resolve before any user-facing Claude integration:**
- Pitfall 1 — Claude API key exposure (requires proxy)
- Pitfall 6 — Wrong mental model for `EXPO_PUBLIC_*` with Claude key

**Must resolve before planner screen is usable at real courses:**
- Pitfall 2 — Null/sparse geodata handling (degrades without crashing)
- Pitfall 3 — Safety buffer on hazard edges (prevents false "safe" recommendations)
- Pitfall 4 — Pure-JS geo utils (avoids Hermes incompatibility risk)

**Must resolve before good UX:**
- Pitfall 5 — Batch Claude call + skeleton loading (not a crash, but poor UX)

**Defer to post-v1:**
- Pitfall 7 — Plan storage cap (only matters after 20+ saved plans)
- Pitfall 8 — High-latitude bearing correction (small error, low impact for v1)
- Pitfall 9 — Fixture mode CI assertion (good practice, not urgent)

---

*Confidence: HIGH on Pitfalls 1, 2, 4, 6 (direct codebase evidence + well-documented behavior). MEDIUM on Pitfalls 3, 5 (industry pattern knowledge, no Maps4Golf API docs available to confirm exact data quality). LOW on Pitfall 8 (theoretical, low practical impact for courses in the 30-60° latitude band).*

*Sources: Codebase analysis (`src/types/index.ts`, `fixtures/course-sample.json`, `src/api/mapsgolf.ts`, `src/store/planStore.ts`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/INTEGRATIONS.md`). Anthropic API security model documented at https://docs.anthropic.com/en/api/getting-started. React Native New Architecture compatibility noted from `app.json newArchEnabled: true`. Hermes runtime JS API compatibility from React Native 0.81 release notes.*
