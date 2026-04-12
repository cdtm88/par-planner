# Codebase Structure

**Analysis Date:** 2026-04-12

## Directory Layout

```
par-planner/
├── app/                    # Expo Router screens (file-based routing)
│   ├── _layout.tsx         # Root stack navigator
│   ├── index.tsx           # Home screen
│   ├── onboarding.tsx      # Profile onboarding screen
│   └── search.tsx          # Course search screen
├── src/                    # Core application logic
│   ├── api/                # External API integration
│   │   └── mapsgolf.ts     # Maps4Golf API client
│   ├── components/         # Reusable UI components
│   │   ├── BagBuilder.tsx  # Club selection and distance input component
│   │   └── TendencySelector.tsx  # Shot tendency selector component
│   ├── constants/          # Immutable configuration
│   │   └── clubs.ts        # Club definitions and shot tendency labels
│   ├── store/              # Zustand state management
│   │   ├── courseStore.ts  # Course search and caching
│   │   ├── planStore.ts    # Game plan management
│   │   └── profileStore.ts # Player profile and bag setup
│   ├── storage/            # Persistence utilities
│   │   └── cache.ts        # AsyncStorage wrapper
│   └── types/              # TypeScript domain models
│       └── index.ts        # All shared type definitions
├── __tests__/              # Jest test files (mirrors src structure)
│   ├── api/                # API layer tests
│   │   └── mapsgolf.test.ts
│   ├── components/         # Component tests (if present)
│   ├── store/              # Store tests
│   │   ├── courseStore.test.ts
│   │   └── profileStore.test.ts
│   └── storage/            # Storage utility tests
│       └── cache.test.ts
├── fixtures/               # Development test data
│   ├── course-sample.json  # Sample full course data
│   ├── search-sample.json  # Sample search results
│   └── strategy-sample.json # Sample AI strategy (for Plan 3)
├── assets/                 # App icons and splash images
│   ├── icon.png
│   ├── splash-icon.png
│   ├── adaptive-icon.png
│   └── favicon.png
├── app.json                # Expo configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── .gitignore              # Git ignore rules
```

## Directory Purposes

**app/**
- Purpose: Expo Router screens and navigation structure
- Contains: Screen-level React Native components
- Key files: `_layout.tsx` (root navigator), `index.tsx` (home), `onboarding.tsx`, `search.tsx`

**src/api/**
- Purpose: External service integration
- Contains: API client functions with fixture mode fallback
- Key files: `mapsgolf.ts` provides `searchCourses()` and `fetchCourse()`

**src/components/**
- Purpose: Reusable, testable UI components
- Contains: Isolated presentational components accepting props
- Key files: `BagBuilder.tsx` (club selection), `TendencySelector.tsx` (shot tendency chips)

**src/constants/**
- Purpose: Immutable configuration and enums
- Contains: Club definitions, shot tendency labels
- Key files: `clubs.ts` exports `DEFAULT_BAG`, `ALL_CLUBS`, `TENDENCY_LABELS`

**src/store/**
- Purpose: State management and business logic
- Contains: Zustand stores with persist middleware
- Key files: `profileStore.ts`, `courseStore.ts`, `planStore.ts`

**src/storage/**
- Purpose: Persistence abstraction
- Contains: Generic async cache utilities
- Key files: `cache.ts` provides `cacheSet()`, `cacheGet()`, `cacheRemove()`

**src/types/**
- Purpose: Shared domain models
- Contains: TypeScript interfaces and types
- Key files: `index.ts` defines Club, Course, GamePlan, PlayerProfile, Hole, Tee, Hazard, Coordinate, etc.

**__tests__/**
- Purpose: Jest unit tests
- Contains: Test files mirroring src structure
- Key files: `profileStore.test.ts`, `courseStore.test.ts`, `mapsgolf.test.ts`, `cache.test.ts`

**fixtures/**
- Purpose: Static test data for development/testing
- Contains: JSON sample data
- Key files: `search-sample.json` (fixture for searchCourses), `course-sample.json` (fixture for fetchCourse)

**assets/**
- Purpose: App branding and launcher icons
- Contains: PNG image files
- Key files: icon.png, splash-icon.png, adaptive-icon.png, favicon.png

## Key File Locations

**Entry Points:**
- `app/_layout.tsx`: Expo Router root, sets up Stack navigation and screen registration
- `app/index.tsx`: Home screen, entry point after app launch
- `app.json`: Expo configuration, app name, icon, orientation, plugins

**Configuration:**
- `package.json`: Dependencies (expo, react-native, zustand, jest, testing-library)
- `tsconfig.json`: TypeScript strict mode enabled, extends expo base config
- `app.json`: Expo config with newArchEnabled, iOS/Android platform settings

**Core Logic:**
- `src/store/profileStore.ts`: Player profile state with persistence
- `src/store/courseStore.ts`: Course search/fetch with read-through cache
- `src/api/mapsgolf.ts`: Maps4Golf API abstraction with fixture mode

**Testing:**
- `__tests__/store/profileStore.test.ts`: Profile store unit tests
- `__tests__/store/courseStore.test.ts`: Course store unit tests (if exists)
- `__tests__/api/mapsgolf.test.ts`: API integration tests (if exists)
- `__tests__/storage/cache.test.ts`: Cache utility tests (if exists)

## Naming Conventions

**Files:**
- Screens: `PascalCase.tsx` (e.g., `index.tsx`, `onboarding.tsx`, `search.tsx`)
- Components: `PascalCase.tsx` (e.g., `BagBuilder.tsx`, `TendencySelector.tsx`)
- Stores: `camelCaseStore.ts` (e.g., `profileStore.ts`, `courseStore.ts`)
- Utilities: `camelCase.ts` (e.g., `cache.ts`, `mapsgolf.ts`)
- Tests: `filename.test.ts` (e.g., `profileStore.test.ts`)

**Directories:**
- Feature/domain directories: lowercase (e.g., `api`, `store`, `components`, `storage`)
- App screens: lowercase (e.g., `app/`)
- Test mirror: `__tests__/` with same directory structure as `src/`

**Functions:**
- Store hooks: `use[Domain]Store()` (e.g., `useProfileStore()`, `useCourseStore()`)
- API functions: camelCase (e.g., `searchCourses()`, `fetchCourse()`)
- Component names: PascalCase (e.g., `BagBuilder`, `TendencySelector`)
- Utility functions: camelCase (e.g., `cacheSet()`, `cacheGet()`)

**Variables/Constants:**
- Module exports: UPPER_CASE for immutable data (e.g., `DEFAULT_BAG`, `ALL_CLUBS`)
- Zustand store hooks: camelCase starting with `use` (e.g., `useProfileStore`)
- React state: camelCase (e.g., `selectedCourse`, `isSearching`)
- Enum/literal unions: kebab-case (e.g., `'slight-fade'`, `'7i'`)

**Types/Interfaces:**
- User-facing models: PascalCase (e.g., `Club`, `Course`, `GamePlan`, `PlayerProfile`)
- Literal types: kebab-case or camelCase based on usage (e.g., `ShotTendency = 'straight' | 'fade'`)
- Component prop interfaces: `Props` suffix optional (e.g., `BagBuilder` accepts `Props` interface)

## Where to Add New Code

**New Screen/Page:**
- Create: `app/[screenName].tsx`
- Register: Automatically discovered by expo-router
- Follow: Import from `src/components/`, hooks from `src/store/`
- Example: `app/planner.tsx` for hole-by-hole planning (Plan 3)

**New Component:**
- Create: `src/components/[ComponentName].tsx`
- Pattern: Accept typed props, export as named function
- Test: Add `__tests__/components/[ComponentName].test.tsx`
- Example: `CourseCard.tsx` to display course details

**New Store:**
- Create: `src/store/[domainName]Store.ts`
- Pattern: `create<[DomainName]Store>()(persist((set, get) => ({ state, actions }), { ... }))`
- Import from: `src/types/index.ts` for domain models
- Example: `planStore.ts` for game plan CRUD (already exists, needs expansion for Plan 3)

**New Utility:**
- Create: `src/[layer]/[utility].ts`
- Examples: `src/api/strategy.ts` for AI strategy integration, `src/store/sync.ts` for server sync

**New Type:**
- Add to: `src/types/index.ts`
- Pattern: Domain models clustered by feature
- Naming: PascalCase interfaces, kebab-case string literal unions

**New Constant:**
- Add to: Appropriate file in `src/constants/`
- Or create: `src/constants/[domain].ts` if large
- Naming: UPPER_CASE for exports
- Example: `src/constants/maps4golf.ts` for API endpoints

**Test Fixtures:**
- Create: `fixtures/[domain]-[variant].json`
- Used by: `src/api/mapsgolf.ts` in fixture mode
- Example: `fixtures/course-advanced.json` for testing complex courses

## Special Directories

**assets/**
- Purpose: App launcher and splash images
- Generated: No (manually created)
- Committed: Yes
- Note: Referenced by app.json for icon, splash, favicon paths

**fixtures/**
- Purpose: Static JSON data for development/testing
- Generated: No (manually maintained)
- Committed: Yes
- Note: Loaded by API layer when EXPO_PUBLIC_MAPS4GOLF_API_KEY is not set

**node_modules/**
- Purpose: npm dependencies
- Generated: Yes (from package.json via npm install)
- Committed: No (.gitignore)

**__tests__/**
- Purpose: Jest test files
- Generated: No (manually written)
- Committed: Yes
- Note: Mirrors src/ structure for organization; discovered by Jest via `**/*.test.ts` pattern

---

*Structure analysis: 2026-04-12*
