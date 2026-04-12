# Codebase Concerns

**Analysis Date:** 2026-04-12

## Tech Debt

**Maps4Golf API Response Transform (BLOCKING)**
- Issue: Production API integration is incomplete — response objects are cast directly without transformation
- Files: `src/api/mapsgolf.ts` (lines 37-38, 62-63)
- Impact: App will crash or display malformed data when Maps4Golf API credentials are configured. Both `searchCourses()` and `fetchCourse()` have TODO comments indicating the API response shape differs from `CourseSearchResult[]` and `Course` types
- Fix approach: 
  1. Obtain Maps4Golf API documentation and sample responses
  2. Create transformer functions (e.g., `transformSearchResponse()`, `transformCourseResponse()`)
  3. Replace `data as CourseSearchResult[]` and `data as Course` casts with proper transformers
  4. Test against live API before releasing production

**PlanStore Not Persisted (FUNCTIONALITY GAP)**
- Issue: Game plans are stored only in memory, not persisted to AsyncStorage like course cache and profile
- Files: `src/store/planStore.ts`
- Impact: User's game plans are lost when app restarts. Plan 3 will add game plan creation, and without persistence, users cannot retain their work
- Fix approach: 
  1. Add zustand persist middleware to `usePlanStore` 
  2. Configure AsyncStorage with partialize to persist only `plans: GamePlan[]`
  3. Add storage clearing in test beforeEach to prevent test pollution

**Missing /planner Route Handler (BLOCKING)**
- Issue: Search screen navigates to `/planner` route (line 47 of `app/search.tsx`) but no route handler exists
- Files: `app/search.tsx` (line 46-49)
- Impact: User will see a navigation error when attempting to proceed from course/tee selection. Route needs to be created for Plan 3
- Fix approach: Create `app/planner.tsx` that receives `courseId` and `tee` params and implements game plan generation

## Error Handling

**Silent Error Swallowing in Search (PARTIAL MITIGATION)**
- Issue: `handleSelectCourse()` in search screen catches all errors without logging or user feedback beyond UI state
- Files: `app/search.tsx` (lines 34-35)
- Impact: If course fetch fails, user sees loading spinner disappear but no error message. Network errors, server failures are hidden
- Current state: Error is suppressed; `isFetching` flag is cleared
- Recommendation: Add specific error handling — display toast or error modal with actionable message; consider retry mechanism

**Generic "Search failed" Message**
- Issue: courseStore catches errors and converts to generic message (line 35: `'Search failed'`)
- Files: `src/store/courseStore.ts` (line 35)
- Impact: User cannot distinguish between network error, API rate limit, invalid query, or server error
- Recommendation: Preserve error details in store, add context (e.g., "No results found", "Network timeout", "API error")

**Missing Fetch Error Responses (NO RETRY)**
- Issue: Both `searchCourses()` and `fetchCourse()` throw errors on non-200 responses but do not implement retry or fallback
- Files: `src/api/mapsgolf.ts` (lines 35, 60)
- Impact: Transient network failures will hard fail. No exponential backoff or timeout handling
- Recommendation: Implement retry with exponential backoff for fetch calls, especially critical course data

## Validation Gaps

**No Input Validation on Search Query**
- Issue: Search accepts queries after length check (`line 25: query.trim().length < 2`) but does not sanitize or validate format
- Files: `app/search.tsx` (line 25)
- Impact: Malformed queries (SQL injection, XSS if rendered server-side, special characters) are sent directly to API
- Recommendation: Validate query format (alphanumeric + spaces/hyphens), URL-encode properly, consider client-side search debounce

**No Validation on Numeric Inputs**
- Issue: Handicap and distance inputs accept numeric values but do not validate ranges or sane limits
- Files: `app/onboarding.tsx` (line 50), `app/search.tsx` component BagBuilder
- Impact: User can enter negative handicap, unrealistic yardages (e.g., 9999 yards for 7 iron). No bounds checking
- Recommendation:
  - Handicap: enforce 0-36 range
  - Club distances: enforce club-specific ranges (driver 200-300y, putter <30y, etc.)
  - Add validation in store setters or input handlers

**Missing Type Validation on JSON Parse**
- Issue: Cache layer uses `JSON.parse(raw) as T` without validation — assumes AsyncStorage always returns valid JSON
- Files: `src/storage/cache.ts` (line 10)
- Impact: If corrupted data is stored, parse will succeed but type cast is unsafe. No runtime validation of T
- Recommendation: Add try-catch in cacheGet, return null on JSON parse error, consider schema validation with zod/joi

## Fragile Areas

**SearchResults NOT Persisted, Causes Flicker**
- Issue: Course search results are stored only in `courseStore.searchResults` (ephemeral), not persisted
- Files: `src/store/courseStore.ts` (line 56: `partialize` excludes searchResults)
- Impact: On app restart, search results are empty. If user navigates away and back, search must be re-run. No caching of past searches
- Why fragile: User UX is poor on slow networks; search state is lost, forcing re-entry and re-query
- Safe modification: Add optional persistence of `lastSearchQuery` and `lastSearchResults` with TTL
- Test coverage: No tests for search result caching behavior across sessions

**Zustand Store Direct setState in Tests (MUTATION)**
- Issue: Tests directly mutate store state using `store.setState()` which bypasses action logic
- Files: `__tests__/store/courseStore.test.ts` (line 12), `__tests__/store/profileStore.test.ts` (line 11)
- Impact: Tests do not exercise real action paths. If store setters have validation or side effects, tests miss them. Brittle to refactoring
- Safe modification: Use action methods (e.g., `result.current.searchCourses('')`) instead of direct setState in test setup

**BagBuilder Component Has No Error State**
- Issue: BagBuilder doesn't handle invalid distance input gracefully — `parseInt` returns NaN which is silently ignored
- Files: `src/components/BagBuilder.tsx` (lines 44-46)
- Impact: User types invalid distance, input silently clears or gets ignored. No feedback that input was invalid
- Safe modification: Add validation state, show error message for non-numeric input

**Modal Dismissal Without State Cleanup in Search**
- Issue: TeeSelectionModal can be dismissed via Android back button, but `handleSelectTee()` clears `selectedCourse` state; if navigation fails, modal won't reappear
- Files: `app/search.tsx` (line 44)
- Impact: If router.push fails, selectedCourse is null so user can't retry tee selection
- Safe modification: Only clear selectedCourse after successful navigation, use try-catch in handleSelectTee

## Scaling Limits

**AsyncStorage Unbounded Course Cache**
- Current capacity: AsyncStorage ~5-10MB on most devices, JSON serialization overhead
- Limit: If user caches 100+ courses at full detail (all 18 holes + geodata), may hit storage limit
- Files: `src/store/courseStore.ts` (lines 46-48)
- Scaling path: 
  1. Implement cache size limit (e.g., LRU eviction, max 50 courses)
  2. Add cache version in storage key for migrations
  3. Monitor cache size, add telemetry

**No Rate Limiting on API Calls**
- Issue: Search and course fetch have no client-side debounce or rate limiting
- Files: `src/api/mapsgolf.ts`, `app/search.tsx`
- Impact: User can spam search button, triggering many API calls in rapid succession
- Scaling path: Add debounce to search input (300-500ms), per-course fetch coalescing, request queuing

## Security Considerations

**API Key Exposed in Fixture Check**
- Risk: API key presence is checked via environment variable name (`EXPO_PUBLIC_MAPS4GOLF_API_KEY`)
- Files: `src/api/mapsgolf.ts` (line 8)
- Current mitigation: Key is in `EXPO_PUBLIC_*` which is safe (intentionally public for Expo apps), fixture mode is dev-only
- Recommendations: 
  - Document that this env var is intentionally public
  - Ensure fixture mode is never used in production builds
  - Add CI check to verify API key is NOT hardcoded

**No HTTPS Enforcement on API Calls**
- Risk: API URLs are hardcoded as `https://api.maps4golf.com/...` but no certificate pinning or validation
- Files: `src/api/mapsgolf.ts` (lines 32-33, 57-58)
- Current mitigation: HTTPS is used, but on Android could be vulnerable to MitM without pinning
- Recommendations: 
  - Use certificate pinning library for production (e.g., react-native-cert-pinning)
  - Validate Maps4Golf certificate chain

**No Input Sanitization Before API Calls**
- Risk: Search query is URL-encoded but not sanitized; could contain Unicode, emoji, very long strings
- Files: `src/api/mapsgolf.ts` (line 33: `encodeURIComponent`)
- Current mitigation: URL encoding is correct, but no max length validation
- Recommendation: Add max query length (e.g., 256 chars), reject obviously malicious patterns

## Testing Gaps

**No Tests for Navigation Flows**
- What's not tested: Course search → tee selection → navigation to /planner route
- Files: `app/search.tsx`, `app/index.tsx`
- Risk: Navigation errors only discovered in manual testing or production; no E2E coverage
- Priority: High — blocking feature for Plan 3

**No Tests for Store Persistence**
- What's not tested: Zustand persist middleware actually saving/loading from AsyncStorage
- Files: `src/store/profileStore.ts`, `src/store/courseStore.ts`
- Risk: Store state resets on app restart — only caught by manual device testing
- Priority: High — critical for user retention

**No Tests for Fixture Mode vs Live API Mode**
- What's not tested: Fixture fallback behavior when API key is missing; live API behavior (only mocked)
- Files: `src/api/mapsgolf.ts`
- Risk: When real API credentials are added, untested code path will execute
- Priority: High — blocks production readiness

**No Error Boundary or Crash Handling**
- What's not tested: App behavior on uncaught errors; no error boundary or fallback UI
- Files: `app/_layout.tsx`
- Risk: Single error crashes entire app; no recovery mechanism
- Priority: Medium — improves stability

**No Integration Tests for Course Data Flow**
- What's not tested: Full flow from search → fetch course → cache → display tees
- Files: `app/search.tsx`, `src/store/courseStore.ts`, fixtures
- Risk: Data transformation errors, cache misses, and UI binding issues missed
- Priority: Medium

---

*Concerns audit: 2026-04-12*
