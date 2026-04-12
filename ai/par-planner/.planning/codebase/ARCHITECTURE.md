# Architecture

**Analysis Date:** 2026-04-12

## Pattern Overview

**Overall:** Layered mobile application with screen-based UI, state management via stores, and external API integration.

**Key Characteristics:**
- Expo/React Native with file-based routing (expo-router)
- Zustand for persistent state management with AsyncStorage backing
- Modular store pattern with clear separation of concerns
- Type-first design with strict TypeScript
- Offline-first caching strategy for course data

## Layers

**Presentation Layer (Screens):**
- Purpose: User interface, user interactions, form inputs, navigation
- Location: `app/` directory
- Contains: Screen components, page layouts, navigation structure
- Depends on: Store hooks, component library, router
- Used by: End user through mobile app

**Components Layer:**
- Purpose: Reusable UI components with testable, isolated logic
- Location: `src/components/`
- Contains: BagBuilder, TendencySelector
- Depends on: React Native, types
- Used by: Screen components to compose UIs

**State Management Layer (Stores):**
- Purpose: Centralized business logic, data persistence, API orchestration
- Location: `src/store/`
- Contains: profileStore, courseStore, planStore
- Depends on: Types, API layer, AsyncStorage
- Used by: Screens and components via hooks

**API Layer:**
- Purpose: External service integration, data fetching, network abstraction
- Location: `src/api/mapsgolf.ts`
- Contains: Course search, course detail fetching
- Depends on: Types, fixture data for development
- Used by: courseStore actions

**Storage Layer:**
- Purpose: Persistence abstraction for caching and local data
- Location: `src/storage/cache.ts`
- Contains: Generic cache get/set/remove utilities
- Depends on: AsyncStorage
- Used by: Zustand persist middleware

**Type Definitions:**
- Purpose: Shared domain models and interfaces
- Location: `src/types/index.ts`
- Contains: Club, Course, GamePlan, PlayerProfile, HolePlan, etc.
- Depends on: Nothing
- Used by: All layers

**Constants:**
- Purpose: Shared, immutable configuration data
- Location: `src/constants/clubs.ts`
- Contains: DEFAULT_BAG, ALL_CLUBS, shot tendency labels
- Depends on: Types
- Used by: Store initialization, onboarding screen

## Data Flow

**Profile Onboarding:**

1. User lands on home screen (index.tsx)
2. Home screen checks `useProfileStore().profile.hasCompletedOnboarding`
3. If false, banner navigates to `onboarding.tsx` screen
4. Onboarding screen reads profile state via `useProfileStore()`
5. User selects shot tendency, handicap, clubs, distances
6. Each selection triggers store action (setShotTendency, setHandicap, toggleClub, setCarryDistance)
7. Zustand persists changes to AsyncStorage via profileStore's persist middleware
8. User saves profile → `completeOnboarding()` action fires
9. Store state updates, screen navigates back
10. Home screen updates and banner disappears

**Course Search & Selection:**

1. User navigates to search screen via "Plan New Round" CTA
2. Search screen reads initial state from `useCourseStore()`
3. User enters query, hits search
4. Screen calls `searchCourses(query)` store action
5. Store action calls `apiSearch()` from `src/api/mapsgolf.ts`
6. In fixture mode (no API key), API filters local JSON fixtures
7. In production mode, hits Maps4Golf API endpoint
8. Results stored in `courseStore.searchResults` (ephemeral, not persisted)
9. User taps course result → `handleSelectCourse()` fetches full course
10. Store action calls `fetchAndCacheCourse()` which:
    - Checks `state.courses[courseId]` cache
    - If cached, returns immediately (no API call)
    - If not cached, fetches via `apiFetch()`, persists to store
11. Modal opens with tee selection
12. User selects tee → navigates to `/planner` with courseId and tee params
13. Course data cached in AsyncStorage via courseStore's partialize middleware

**State Persistence:**

- profileStore: Full state persisted under key 'player-profile'
- courseStore: Only `courses` object persisted under key 'course-cache' (searchResults omitted via partialize)
- planStore: Currently no persistence (empty plan array)
- All use Zustand's persist middleware with AsyncStorage backend

**State Management:**

- Zustand stores are singleton hooks
- Accessed via `const { state, actions } = useStore()` pattern
- State updates trigger component re-renders
- Async actions use `set()` callback for state mutations
- Caching follows read-through pattern: check cache first, populate on miss

## Key Abstractions

**Store Pattern (Zustand):**
- Purpose: Single source of truth for each domain (profile, courses, plans)
- Examples: `src/store/profileStore.ts`, `src/store/courseStore.ts`, `src/store/planStore.ts`
- Pattern: `create<StoreInterface>()(persist((set, get) => ({ state, actions }), { storage }))`

**Component Props Pattern:**
- Purpose: Composable UI elements with clear interface contracts
- Examples: `BagBuilder` accepts `{ bag, onToggle, onSetDistance }`, `TendencySelector` accepts `{ selected, onSelect }`
- Pattern: Props extracted to interface, component is pure function accepting props

**API Abstraction:**
- Purpose: Decouple stores from external service details
- Examples: `searchCourses()`, `fetchCourse()`
- Pattern: Fixture mode vs production mode conditional on `process.env.EXPO_PUBLIC_MAPS4GOLF_API_KEY`

**Persistent Cache with Partialize:**
- Purpose: Selective persistence of store state
- Example: courseStore persists only `courses`, not `searchResults`
- Pattern: Zustand's `partialize: (state) => ({ courses: state.courses })`

## Entry Points

**App Root:**
- Location: `app/_layout.tsx`
- Triggers: Expo router bootstrap
- Responsibilities: Stack navigation setup, theme/header styling, screen registration

**Home Screen:**
- Location: `app/index.tsx`
- Triggers: App launch or router.back() from other screens
- Responsibilities: Profile onboarding check, plan list display, navigation to onboarding/search

**Onboarding Screen:**
- Location: `app/onboarding.tsx`
- Triggers: User taps profile banner or explicit route push
- Responsibilities: Collect user profile (shot tendency, handicap, bag), persist to store, mark onboarding complete

**Search Screen:**
- Location: `app/search.tsx`
- Triggers: "Plan New Round" CTA from home
- Responsibilities: Course search UI, result list, course fetching, tee selection modal, navigation to planner

**Planner Screen (Planned):**
- Location: `app/planner.tsx` (to be implemented in Plan 3)
- Triggers: Tee selection from search screen
- Responsibilities: Generate AI-powered game plan, hole-by-hole strategy, course context

## Error Handling

**Strategy:** Try-catch with store error state + user-facing fallback UI

**Patterns:**

- API errors: Caught in async store actions, stored in `searchError` or propagated as exception
- Error display: Search screen shows `searchError` text below search box
- Network failures: Fixture mode masks API errors in development; production relies on error text
- Invalid user input: Numeric inputs validated before state update (parseInt with isNaN check)
- Missing data: Search results filtered client-side; course fetch throws if not in cache and API unavailable

## Cross-Cutting Concerns

**Logging:** console-based only (no structured logging framework)

**Validation:** 
- Type validation: Strict TypeScript mode enforces compile-time correctness
- Runtime validation: Client-side input parsing (parseInt, trim, length checks)
- API response validation: Implicit via TypeScript cast (no runtime schema validation)

**Authentication:** 
- Approach: API key stored in environment variable (EXPO_PUBLIC_MAPS4GOLF_API_KEY)
- Scope: Maps4Golf API calls only
- No user identity system (single-user app)

**Navigation:**
- Approach: File-based routing via expo-router with Stack navigation
- Routes: index, onboarding, search
- Planned: planner route (Plan 3)
- Route params: courseId, tee passed via router.push({ pathname, params })

---

*Architecture analysis: 2026-04-12*
