# Testing

## Framework

- **Jest** with `jest-expo` preset
- **@testing-library/react-native** for component rendering and queries
- **@testing-library/jest-native** for extended assertions

## Structure

- Tests live in `__tests__/` directory, mirroring `src/` structure
- File naming: `*.test.ts` / `*.test.tsx`
- ~265 lines of test code across 6 test files (early-stage coverage)

## Test Anatomy

```ts
describe('CourseStore', () => {
  beforeEach(() => {
    // reset state / mocks
  });

  it('searches courses and caches results', async () => {
    // arrange, act, assert
  });
});
```

- `describe` blocks per module / component
- `beforeEach` for shared setup and mock resets
- `it` for individual cases

## Mocking

- **AsyncStorage** mocked globally via Jest mock at setup level
- **API fixtures** used for Maps4Golf responses (fixture-based testing)
- No live network calls in tests

## Async Patterns

- `act()` wrapper used for state updates and async operations in hooks
- `waitFor` from testing-library for settled async assertions

## Test IDs

- Components expose `testID` attributes for reliable element selection
- Avoids fragile text-based selectors

## Running Tests

```bash
npx expo test         # run all tests
npx expo test --watch # watch mode
```

## Gaps / Coverage Notes

- 6 test files exist; primarily store and hook unit tests
- No E2E or integration tests yet
- UI component test coverage is minimal — screen-level flows untested
