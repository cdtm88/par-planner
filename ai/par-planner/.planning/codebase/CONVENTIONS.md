# Code Conventions

## File Naming

- **Components:** PascalCase (e.g., `CourseSearch.tsx`, `HolePlanner.tsx`)
- **Stores / utilities:** camelCase (e.g., `courseStore.ts`, `apiClient.ts`)
- **Tests:** `*.test.ts` / `*.test.tsx` mirroring source structure

## Naming Patterns

- **Functions / methods:** camelCase with verb-first patterns for actions (e.g., `toggleClub`, `setCarryDistance`, `fetchCourseDetails`)
- **Variables:** camelCase throughout
- **Types / interfaces:** PascalCase (e.g., `Course`, `TeeBox`, `RoundState`)

## Formatting

- 2-space indentation
- Single quotes for strings
- Semicolons present
- No explicit linter config detected (TypeScript compiler enforces types)

## State Management

- **Zustand** stores with `persist` middleware for durable state
- Store files export a single hook (e.g., `useCourseStore`)
- Actions co-located with state inside the store slice

## Error Handling

- Errors thrown at the API/service boundary
- Caught and converted to state (`error` field) inside Zustand stores
- UI reads `error` state from store; no raw try/catch in components

## Comments

- JSDoc on public functions and store actions
- Inline comments explain *why*, not *what*
- No stale or commented-out code observed

## TypeScript

- Strict mode implied by Expo TypeScript template
- Types defined alongside the code that uses them (co-location pattern)
- Interfaces preferred for object shapes; type aliases for unions/primitives
