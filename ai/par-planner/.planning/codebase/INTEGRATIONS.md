# External Integrations

**Analysis Date:** 2026-04-12

## APIs & External Services

**Golf Course Data:**
- **Maps4Golf API** - Course search and course details with hole-by-hole geodata
  - SDK/Client: Native Fetch API (no SDK required)
  - Auth: API key via `EXPO_PUBLIC_MAPS4GOLF_API_KEY` environment variable
  - Endpoints:
    - `GET https://api.maps4golf.com/v1/courses/search?q={query}&api_key={key}` - Search courses by name or location
    - `GET https://api.maps4golf.com/v1/courses/{id}?api_key={key}` - Fetch full course detail
  - Response format: JSON (awaiting transformation once API docs obtained)
  - Location: `src/api/mapsgolf.ts`
  - Fallback mode: Fixture data when API key not configured

## Data Storage

**Device Local Storage:**
- **AsyncStorage** - React Native persistent JSON storage
  - Implementation: `@react-native-async-storage/async-storage` 2.2.0
  - What's stored:
    - Player profile (handicap, shot tendency, selected clubs, carry distances)
    - Cached courses (never expires, persisted permanently after first fetch)
    - Game plans (not currently persisted, but architecture supports it)
  - Access patterns:
    - Zustand persist middleware for automatic serialization (`src/store/profileStore.ts`, `src/store/courseStore.ts`)
    - Direct AsyncStorage calls for cache utilities (`src/storage/cache.ts`)

**File Storage:**
- Local filesystem only (via AsyncStorage JSON)
- No cloud storage integration

**Caching:**
- In-memory Zustand stores (ephemeral for search results)
- AsyncStorage (permanent for courses and profiles)
- Custom cache utilities: `src/storage/cache.ts` with `cacheSet()`, `cacheGet()`, `cacheRemove()`

## Authentication & Identity

**Auth Provider:**
- None currently configured
- Player profile is local-only (no user accounts, no login)
- No identity management

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Rollbar, or similar)
- Manual error messages returned from API calls

**Logs:**
- Not configured
- Development via Expo CLI console logs

## CI/CD & Deployment

**Hosting:**
- Expo Application Services (EAS) - Deploy via EAS CLI

**CI Pipeline:**
- Not detected

**Build Pipeline:**
- Expo CLI commands:
  - `expo start` - Dev server (ios/android/web platforms)
  - `expo start --android` - Android emulator/device
  - `expo start --ios` - iOS simulator/device
  - `expo start --web` - Web preview

## Environment Configuration

**Required env vars for production:**
- `EXPO_PUBLIC_MAPS4GOLF_API_KEY` - Maps4Golf API key (optional in development, uses fixtures if not set)

**Secrets location:**
- `.env.local` files (per .gitignore)
- Expo supports `.env*` files in project root
- Note: `EXPO_PUBLIC_*` variables are bundled into the app and visible to client code (public API keys only)

**App version & config:**
- Centralized in `app.json` (Expo configuration)
- Package version: 1.0.0

## Deep Linking

**Incoming:**
- Registered scheme: `parplanner://` (via app.json scheme property)
- Handled by: Expo Router navigation system
- No webhook endpoints configured

**Outgoing:**
- Not detected
- No callbacks to external services

## Testing Infrastructure

**Test Framework:**
- Jest 29.7.0 with jest-expo preset
- React Native Testing Library for component testing
- Run via `npm test`

## Known Integration Gaps

**Maps4Golf API:**
- Response format transformation pending (TODOs in `src/api/mapsgolf.ts`)
- Awaiting Maps4Golf API documentation for proper response shape mapping
- Currently uses type casting as placeholder

**AI/Game Strategy:**
- No Claude AI integration detected
- `fixtures/strategy-sample.json` exists but no API integration for dynamic strategy generation
- Game plan model supports hole-by-hole strategies but generation is not implemented

---

*Integration audit: 2026-04-12*
