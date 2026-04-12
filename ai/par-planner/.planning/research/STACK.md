# Technology Stack Research: Par Planner — AI + Geospatial Additions

**Project:** Par Planner (existing Expo SDK 54 / React Native 0.81 app)
**Researched:** 2026-04-12
**Research mode:** Ecosystem / Feasibility
**Overall confidence:** MEDIUM — WebSearch and WebFetch were unavailable; findings are drawn from codebase inspection, Context7 (MCP unavailable in this session), and high-confidence training knowledge where explicitly flagged. Every claim below that touches a specific version number or a "doesn't exist" assertion should be spot-checked before finalising the implementation sprint.

---

## Question 1 — How to call Claude API from an Expo app

### Short answer

Do NOT embed the Anthropic API key in the Expo bundle. Use a lightweight serverless proxy. The correct environment variable prefix (`EXPO_PUBLIC_*`) is intentionally public — it is inlined into the JS bundle at build time, which means anyone who unpacks the `.ipa` / `.apk` can read it.

### Why `EXPO_PUBLIC_` is the wrong mechanism for secret API keys

Expo's `EXPO_PUBLIC_*` convention (documented in the Expo SDK reference) exists for non-secret runtime configuration — feature flags, public endpoint URLs, analytics write-keys. The prefix signals "safe to expose." The Anthropic API key is a billing credential: leaking it allows unlimited spend against your account. Expo's own docs warn that any value stored with `EXPO_PUBLIC_*` must be treated as public.

**Confidence: HIGH** — This is the Expo design contract, not an inference.

The Maps4Golf key is already stored this way (`EXPO_PUBLIC_MAPS4GOLF_API_KEY`). That may be acceptable if Maps4Golf keys have tight per-endpoint rate limits or are low-cost to rotate. Anthropic keys are categorically different: they control metered LLM spend with no per-endpoint restriction.

### Recommended pattern: thin serverless proxy

Deploy a single Vercel Edge Function (or any Node serverless function) that:

1. Accepts a POST with the hole/bag context payload from the app
2. Validates/sanitises the request
3. Calls the Anthropic API with the secret key stored as a server-side environment variable
4. Streams or returns the response

The app hits `https://your-proxy.vercel.app/api/strategy` with no key in the request — the key never leaves the server.

```
Mobile app  →  POST /api/strategy (hole data + bag)
              ↓
         Vercel Edge Function
              ↓ (server-side env: ANTHROPIC_API_KEY)
         Anthropic API
              ↓
         strategy JSON / stream
              ↑
Mobile app  ←  response
```

This keeps the existing architecture clean: add `src/api/claude.ts` that POSTs to the proxy, and the proxy is a separate repo or a `api/` directory in the same repo deployed to Vercel.

### Alternative considered: Anthropic SDK directly in-app

The `@anthropic-ai/sdk` npm package works in React Native (it uses the Fetch API under the hood, no Node-specific APIs required). However, using it directly requires embedding the key in the bundle. This is acceptable only in an internal-distribution or development context where the build is never published. For App Store / Play Store distribution: do not do this.

**Confidence: MEDIUM** — The SDK's RN compatibility is based on training knowledge (it uses standard Fetch, no `http` module), not verified against the current SDK source. Confirm before implementing.

### Alternative considered: Vercel AI Gateway

The Vercel AI Gateway (`ai-gateway.vercel.sh`) is a managed proxy layer that works with Vercel deployments. If the app already has any Vercel backend, using the AI SDK with the gateway provider centralises model routing. However, this adds a Vercel dependency that does not currently exist in this project. For a local-only v1 app, a standalone edge function is simpler and has fewer moving parts.

### What NOT to use

- `EXPO_PUBLIC_ANTHROPIC_API_KEY` — key is exposed in the bundle. Do not do this.
- Hardcoding the key in source — same risk, also leaks via version control.
- `expo-secure-store` as a workaround — SecureStore protects at-rest device storage, not the build-time bundle embedding problem. The key still ships in the JS before it reaches SecureStore.

### For fixture mode

The existing `isFixtureMode()` pattern in `src/api/mapsgolf.ts` is the right model. Add the same guard to `src/api/claude.ts`: when `EXPO_PUBLIC_CLAUDE_FIXTURE_MODE=true` (or no proxy URL is configured), return the `fixtures/strategy-sample.json` data with a simulated delay. This keeps the development loop fast with no live API calls.

---

## Question 2 — Geospatial intersection in React Native (no native modules)

### The core computation needed

Given the type definitions in `src/types/index.ts`:

- `Hazard.polygon: Coordinate[]` — a polygon defined by lat/lng vertices
- `HoleGeodata.teeBox: Coordinate` — the shot origin
- A shot carries N yards in direction D with lateral offset E (fade/draw)

The calculation is: convert the shot endpoint to a lat/lng coordinate, then test whether that point (or a landing ellipse) intersects any hazard polygon.

### Recommended library: `@turf/turf` (selective imports from `@turf/*`)

Turf.js is the standard JavaScript geospatial library. It is pure JavaScript — no native modules, no C bindings, works in React Native and Expo without any special configuration.

**Confidence: HIGH** — Turf is a well-established pure-JS library used extensively in RN geo projects. Its lack of native dependencies is a design constraint of the library, not an inference.

Relevant Turf modules for this problem:

| Module | What it does | Needed? |
|--------|-------------|---------|
| `@turf/boolean-point-in-polygon` | Tests whether a point is inside a polygon | Yes — landing point vs hazard polygon |
| `@turf/destination` | Calculates a destination coordinate given origin, distance, and bearing | Yes — converts yards + direction to lat/lng landing point |
| `@turf/helpers` | Creates GeoJSON Point/Polygon features from coordinates | Yes — wraps Coordinate[] into GeoJSON |
| `@turf/boolean-intersects` | Tests whether two geometries overlap | Optional — only needed if modelling a landing ellipse rather than a point |

Install only what you need. Turf is modular: pulling individual `@turf/*` packages rather than the monolithic `@turf/turf` avoids adding unnecessary weight to the bundle.

```bash
npm install @turf/boolean-point-in-polygon @turf/destination @turf/helpers
```

Approximate bundle impact: ~30–50 KB per module (gzipped). Three modules together: ~100–150 KB added to the JS bundle. Acceptable for a mobile app.

**Version to target:** `@turf/*` v6.x is the stable, widely-tested release. v7 (alpha) was in progress as of training cutoff — verify current stable before pinning.

**Confidence: MEDIUM** — Version numbers are from training knowledge. Check npm before pinning.

### How the geospatial math works

Yards to meters: `metres = yards * 0.9144`

A shot from the tee box has:
- **Distance:** club carry distance in yards → convert to metres
- **Bearing:** the hole direction (bearing from tee to green centre, calculable from tee/green coordinates via `@turf/bearing`)
- **Lateral offset:** shot tendency mapped to degrees offset from bearing

Tendency to bearing offset (suggested mapping):
```
straight:     0°
slight-draw: -3°   (right-to-left for right-hander, negative bearing offset)
draw:        -6°
hook:        -12°
slight-fade: +3°
fade:        +6°
slice:       +12°
```

Landing point calculation:
```typescript
import destination from '@turf/destination';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';

function landingPoint(
  tee: Coordinate,
  bearingDeg: number,
  carryYards: number,
  tendencyOffsetDeg: number
) {
  const distanceKm = (carryYards * 0.9144) / 1000;
  const adjustedBearing = bearingDeg + tendencyOffsetDeg;
  const result = destination(
    point([tee.lng, tee.lat]),   // GeoJSON is [lng, lat]
    distanceKm,
    adjustedBearing,
    { units: 'kilometers' }
  );
  return result; // GeoJSON Feature<Point>
}

function hitsHazard(landingPt: GeoJSON.Feature<GeoJSON.Point>, hazard: Hazard): boolean {
  const poly = polygon([[
    ...hazard.polygon.map(c => [c.lng, c.lat]),
    [hazard.polygon[0].lng, hazard.polygon[0].lat] // close ring
  ]]);
  return booleanPointInPolygon(landingPt, poly);
}
```

Note the GeoJSON coordinate order: `[longitude, latitude]`, not `[lat, lng]` as in the app's `Coordinate` type. This is a common mistake — Turf follows GeoJSON spec, which is `[lng, lat]`.

### Alternative considered: `geolib`

`geolib` is another pure-JS geo library that handles distance/bearing calculations and has a `isPointInPolygon` function. It uses a flat-earth approximation (faster, less accurate over long distances). For a golf hole (max ~600 yards / 550 metres), the flat-earth error is negligible — well under 1 metre. It is simpler than Turf and has a smaller bundle footprint.

**Use geolib if:** you only need point-in-polygon and bearing/distance math (no complex polygon operations). Bundle size is approximately 10 KB gzipped for the whole library.

```bash
npm install geolib
```

**Use Turf if:** you anticipate needing more advanced geospatial operations (convex hull, buffering, line intersection) for future on-course GPS mode.

**Recommendation for v1:** Start with `geolib` for its simplicity and size. The flat-earth accuracy is sufficient for golf-hole scales. Migrate to Turf if the v2 on-course GPS mode needs more complex operations. This is a low-risk swap since the geospatial logic will be isolated in `src/utils/geo.ts`.

**Confidence: MEDIUM** — `geolib` v3 API and RN compatibility based on training knowledge. Verify current version and `isPointInPolygon` API signature before implementing.

### What NOT to use

- `react-native-maps` geometry utilities — these exist for map rendering, not geometric calculation. Not appropriate for pure math.
- `turf` (the old monolithic package, now deprecated) — use `@turf/turf` or individual `@turf/*` modules instead.
- Any library that requires native modules or `react-native link` — anything with `.podspec` or `build.gradle` dependencies requires a managed Expo build config (`app.json` plugin) and cannot be used in Expo Go. Check the library's README before installing.
- JSTS (Java Topology Suite JS port) — heavyweight, designed for complex polygon operations, overkill for this use case.

### Bearing from tee to green

You need the hole direction to establish the baseline shot bearing. Calculate it from the tee box coordinate to the green centre (centroid of `greenPolygon`). This only needs to be computed once per hole.

`@turf/bearing` or `geolib.getGreatCircleBearing()` both handle this. The green centroid can be approximated as the average lat/lng of `greenPolygon` vertices — precise enough for a bearing calculation at golf-hole scales.

---

## Question 3 — Expo SDK 54 gotchas for network calls and AI SDK integration

### New Architecture (Bridgeless) is enabled

The codebase has `newArchEnabled: true` in `app.json`. Expo SDK 54 ships with React Native 0.76+ new architecture (Fabric renderer + TurboModules) enabled by default. Most gotchas in this area affect native modules — pure-JS libraries are unaffected.

**What this means for AI/network calls:** No impact. The Fetch API, Promises, and async/await all work identically. Pure-JS libraries (Turf, geolib, the Anthropic SDK) are unaffected by the new architecture.

**What to watch:** If a library you're considering has native modules, check that it explicitly supports new architecture / has migrated to TurboModules. Libraries not migrated will either fail silently or produce a Metro bundler warning.

**Confidence: HIGH** — new architecture status is verifiable from `app.json` in the codebase.

### Hermes engine

Expo SDK 54 defaults to the Hermes JavaScript engine. Hermes has full ES2022 support as of React Native 0.73+. No concerns for standard async/await, Promises, generators, or JSON parsing.

One known Hermes quirk: `console.error` with circular objects can sometimes serialize unexpectedly. Not relevant to this feature set.

**Confidence: HIGH** (Hermes default status), **MEDIUM** (specific version quirks).

### Fetch API in Expo

React Native's Fetch implementation has historically had edge cases:
- Does not support `ReadableStream` / streaming responses in the same way as browser Fetch. If you want streaming Claude responses (token-by-token UI), the proxy must buffer and return the full response, or use a custom streaming approach via `XMLHttpRequest` / `EventSource`. Streaming Fetch (`response.body`) is not reliably available in React Native as of SDK 54.
- `AbortController` works correctly for request cancellation.
- `multipart/form-data` uploads work but `Blob` semantics differ from browser.

**For Claude AI calls specifically:** If returning the full strategy as a single JSON response from the proxy (not streaming), standard Fetch works fine. Streaming token-by-token to the UI is non-trivial in RN — skip it for v1 and show a loading state while the full response arrives. This aligns with the existing patterns in the codebase (blocking fetch with loading state).

**Confidence: MEDIUM** — Streaming Fetch status in RN is an area with ongoing changes. Verify against current RN 0.81 docs if streaming UI is desired.

### Expo Router 6 and file-based routing

No gotchas specific to network calls. The planner screen (`app/planner.tsx`) will receive `courseId` and `tee` as route params, which is already the established pattern from the search screen.

### `@anthropic-ai/sdk` in React Native

The SDK uses the Fetch API internally and does not depend on Node.js built-ins (`http`, `https`, `stream`). It should work in React Native without modification. However:

- You must explicitly pass `dangerouslyAllowBrowser: true` when constructing the Anthropic client in an environment that is not a Node.js server process. The SDK checks `process.env` to detect server vs browser context; React Native may trigger the browser safety check.
- This flag is named "dangerously" because in a browser context it means the key is exposed. In a React Native app it has the same implication (key ships with the bundle). This is why the proxy pattern is strongly preferred.

If using the proxy pattern (recommended), this SDK concern is moot — the SDK runs server-side in your edge function, not in the app.

**Confidence: MEDIUM** — `dangerouslyAllowBrowser` flag behavior is from training knowledge. Confirm against current SDK docs.

### AsyncStorage and plan persistence

No changes needed for AsyncStorage with SDK 54. The `@react-native-async-storage/async-storage` v2.2.0 installed supports new architecture. Persisting `GamePlan` objects follows the same Zustand persist pattern already used in `profileStore` and `courseStore`.

**Confidence: HIGH** — verified against `package.json` and existing store patterns in the codebase.

---

## Recommended Additions to Stack

| Addition | Library / Approach | Version | Purpose | Confidence |
|----------|-------------------|---------|---------|------------|
| Claude API calls | Thin serverless proxy (Vercel Edge Function) | — | Safe API key handling | HIGH |
| Claude SDK (server-side only) | `@anthropic-ai/sdk` | current stable | Proxy calls Anthropic API | MEDIUM |
| Geospatial math | `geolib` | v3.x | Point-in-polygon, bearing, distance | MEDIUM |
| (Optional, v2) | `@turf/boolean-point-in-polygon`, `@turf/destination`, `@turf/helpers` | v6.x stable | Full geospatial operations if geolib insufficient | MEDIUM |

## Additions NOT Recommended

| Rejected | Reason |
|----------|--------|
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | Key ships in JS bundle, extractable from any production build |
| `@anthropic-ai/sdk` in-app (client-side) | Same as above — key exposure risk for a published app |
| `expo-secure-store` as key protection | Protects at-rest storage, not build-time bundle embedding |
| Streaming Claude responses in v1 | RN Fetch streaming is unreliable; adds complexity without clear UX benefit |
| `@turf/turf` monolithic import | ~800 KB added; use individual `@turf/*` modules instead |
| Native-module geo libraries | Incompatible with Expo managed workflow without EAS plugin configuration |

---

## Implementation Guidance

### File structure for new additions

Following the existing architecture (`src/api/` for external services, `src/store/` for state, `src/utils/` for pure logic):

```
src/
  api/
    claude.ts          # Proxy call + fixture mode fallback (mirrors mapsgolf.ts pattern)
  utils/
    geo.ts             # Pure geospatial math — landing point, hazard intersection
    clubSelector.ts    # Club recommendation algorithm — pure function, easily testable
  store/
    planStore.ts       # Already exists but empty — implement GamePlan persistence here
```

### Fixture mode for Claude calls

The `isFixtureMode()` pattern from `src/api/mapsgolf.ts` translates directly. When `EXPO_PUBLIC_CLAUDE_PROXY_URL` is not set, return the `fixtures/strategy-sample.json` data after a simulated delay. This keeps development fully offline.

### Algorithm vs AI split

The geospatial math (landing zone, hazard intersection, club selection) should be pure TypeScript functions with no external service dependency. Run this algorithm first to produce a `recommendedClub` and `hazardWarnings` per hole. Pass this structured output to the Claude proxy as context, not raw geodata. This:
- Reduces token count (cheaper, faster Claude responses)
- Makes the AI layer testable independently of the math layer
- Ensures sensible output even if Claude is unavailable or slow

---

## Confidence Summary

| Area | Level | Basis |
|------|-------|-------|
| `EXPO_PUBLIC_*` security model | HIGH | Expo documentation design contract |
| Proxy pattern correctness | HIGH | Standard industry practice, no external verification needed |
| `geolib` RN compatibility | MEDIUM | Training knowledge; not verified against current npm |
| Turf.js RN compatibility | HIGH | Pure-JS by design; well-established |
| Turf/geolib version numbers | MEDIUM | Training knowledge; verify on npm before pinning |
| New architecture impact on Fetch | HIGH | Fetch is JS-layer, unaffected by Fabric/TurboModules |
| Streaming Fetch in RN | MEDIUM | Known limitation, but status evolves; verify if streaming needed |
| `@anthropic-ai/sdk` RN compatibility | MEDIUM | SDK uses Fetch internally; `dangerouslyAllowBrowser` flag noted |
| AsyncStorage SDK 54 compatibility | HIGH | Verified from package.json + existing codebase patterns |

---

*Research: 2026-04-12 | Tools available: Read, Write, Grep, Glob (WebSearch and WebFetch unavailable this session)*
