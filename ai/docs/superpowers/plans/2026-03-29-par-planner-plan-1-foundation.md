# Par Planner — Plan 1: Foundation + Player Profile

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Expo project with a working player profile screen — bag builder (select/deselect clubs, enter carry distances) and shot tendency selector — stored persistently on-device.

**Architecture:** React Native + Expo (managed workflow) with Expo Router for navigation. Zustand manages in-memory state; AsyncStorage persists it. No API calls in this plan — pure local data. Dev fixtures are set up here so later plans never need to hit real APIs during testing.

**Tech Stack:** Expo SDK 52, Expo Router v3, React Native, TypeScript, Zustand, @react-native-async-storage/async-storage, Jest + React Native Testing Library (via jest-expo)

**This is Plan 1 of 4:**
- Plan 1 (this): Foundation + Player Profile ← you are here
- Plan 2: Course Search + Maps4Golf API + caching
- Plan 3: AI Strategy + Hole Planner
- Plan 4: On-Course Mode

---

## File Structure

```
par-planner/                          ← Expo project root (inside /Users/christianmoore/ai/)
├── app/
│   ├── _layout.tsx                   ← Root layout, loads profile store on boot
│   ├── index.tsx                     ← Home screen (empty state for now)
│   └── onboarding.tsx                ← Profile setup screen
├── src/
│   ├── types/
│   │   └── index.ts                  ← All shared TypeScript types (single source of truth)
│   ├── store/
│   │   ├── profileStore.ts           ← Zustand: player profile (bag + tendency + handicap)
│   │   ├── courseStore.ts            ← Zustand: course cache (stub for Plan 2)
│   │   └── planStore.ts              ← Zustand: saved game plans (stub for Plan 3)
│   ├── storage/
│   │   └── cache.ts                  ← AsyncStorage wrapper (typed get/set/remove)
│   ├── constants/
│   │   └── clubs.ts                  ← Default bag + full club list
│   └── components/
│       ├── BagBuilder.tsx            ← Club select/deselect grid + distance input
│       └── TendencySelector.tsx      ← Shot tendency picker
├── fixtures/
│   ├── course-sample.json            ← Mock Maps4Golf course+hole response (for Plan 2+)
│   └── strategy-sample.json         ← Mock Claude strategy response (for Plan 3+)
└── __tests__/
    ├── store/
    │   └── profileStore.test.ts
    ├── storage/
    │   └── cache.test.ts
    └── components/
        ├── BagBuilder.test.tsx
        └── TendencySelector.test.tsx
```

---

## Task 1: Initialise Expo Project

**Files:**
- Create: `ai/par-planner/` (Expo project root)

- [ ] **Step 1: Scaffold Expo app**

```bash
cd /Users/christianmoore/ai
npx create-expo-app@latest par-planner --template blank-typescript
cd par-planner
```

- [ ] **Step 2: Install Expo Router**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

- [ ] **Step 3: Install Zustand and AsyncStorage**

```bash
npx expo install @react-native-async-storage/async-storage
npm install zustand
```

- [ ] **Step 4: Install testing dependencies**

```bash
npm install --save-dev @testing-library/react-native @testing-library/jest-native
```

- [ ] **Step 5: Update `package.json` main entry for Expo Router**

Open `package.json` and change:
```json
"main": "expo-router/entry"
```

- [ ] **Step 6: Update `app.json` to enable Expo Router**

Open `app.json` and add the scheme and plugins:
```json
{
  "expo": {
    "name": "Par Planner",
    "slug": "par-planner",
    "scheme": "parplanner",
    "version": "1.0.0",
    "plugins": [
      "expo-router"
    ]
  }
}
```

- [ ] **Step 7: Verify the app boots**

```bash
npx expo start
```

Expected: Metro bundler starts, QR code displayed. No errors in terminal. Press `i` for iOS simulator or `a` for Android emulator to confirm it renders a blank screen.

- [ ] **Step 8: Delete boilerplate**

Delete `App.tsx` if present (Expo Router uses `app/` directory instead).
Delete `app/` contents if any boilerplate screens were scaffolded — we'll create our own.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: initialise Expo project with Router and Zustand"
```

---

## Task 2: Define Core Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create types file**

Create `src/types/index.ts`:

```typescript
export type ShotTendency =
  | 'straight'
  | 'slight-fade'
  | 'fade'
  | 'slice'
  | 'slight-draw'
  | 'draw'
  | 'hook';

export interface Club {
  id: string;        // e.g. 'driver', '7i', 'sw'
  name: string;      // e.g. 'Driver', '7 Iron', 'Sand Wedge'
  carryYards: number | null;
  selected: boolean;
}

export interface PlayerProfile {
  handicap: number | null;
  shotTendency: ShotTendency;
  bag: Club[];
  hasCompletedOnboarding: boolean;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Hazard {
  type: 'bunker' | 'water' | 'ob';
  polygon: Coordinate[];
  label?: string;
}

export interface HoleGeodata {
  fairwayPolygon: Coordinate[] | null;
  greenPolygon: Coordinate[];
  teeBox: Coordinate;
  hazards: Hazard[];
}

export interface Hole {
  number: number;
  par: number;
  distanceYards: number;
  strokeIndex: number;
  geodata: HoleGeodata | null;
}

export interface Tee {
  name: string;  // e.g. 'Yellow', 'White', 'Red'
  holes: Hole[];
}

export interface Course {
  id: string;
  name: string;
  club: string;
  location: string;
  lat: number;
  lng: number;
  tees: Tee[];
}

export interface HolePlan {
  holeNumber: number;
  teeClub: string;
  target: string;
  avoid: string;
  reasoning: string;
  confirmed: boolean;
}

export interface GamePlan {
  id: string;
  courseId: string;
  courseName: string;
  tee: string;
  createdAt: string;
  holes: HolePlan[];
  complete: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add core TypeScript types"
```

---

## Task 3: Club Constants

**Files:**
- Create: `src/constants/clubs.ts`

- [ ] **Step 1: Create clubs constants**

Create `src/constants/clubs.ts`:

```typescript
import { Club } from '../types';

// Default bag — pre-selected when user first opens the app
export const DEFAULT_BAG: Club[] = [
  { id: 'driver', name: 'Driver', carryYards: null, selected: true },
  { id: '3w', name: '3 Wood', carryYards: null, selected: true },
  { id: '5w', name: '5 Wood', carryYards: null, selected: false },
  { id: '4i', name: '4 Iron', carryYards: null, selected: false },
  { id: '5i', name: '5 Iron', carryYards: null, selected: true },
  { id: '6i', name: '6 Iron', carryYards: null, selected: true },
  { id: '7i', name: '7 Iron', carryYards: null, selected: true },
  { id: '8i', name: '8 Iron', carryYards: null, selected: true },
  { id: '9i', name: '9 Iron', carryYards: null, selected: true },
  { id: 'pw', name: 'Pitching Wedge', carryYards: null, selected: true },
  { id: 'gw', name: 'Gap Wedge', carryYards: null, selected: false },
  { id: 'sw', name: 'Sand Wedge', carryYards: null, selected: true },
  { id: 'lw', name: 'Lob Wedge', carryYards: null, selected: false },
  { id: 'putter', name: 'Putter', carryYards: null, selected: true },
];

// Additional clubs available to add
export const EXTRA_CLUBS: Club[] = [
  { id: '2i', name: '2 Iron', carryYards: null, selected: false },
  { id: '3i', name: '3 Iron', carryYards: null, selected: false },
  { id: '2h', name: '2 Hybrid', carryYards: null, selected: false },
  { id: '3h', name: '3 Hybrid', carryYards: null, selected: false },
  { id: '4h', name: '4 Hybrid', carryYards: null, selected: false },
  { id: '7w', name: '7 Wood', carryYards: null, selected: false },
  { id: '60w', name: '60° Wedge', carryYards: null, selected: false },
  { id: 'chipper', name: 'Chipper', carryYards: null, selected: false },
];

export const ALL_CLUBS: Club[] = [...DEFAULT_BAG, ...EXTRA_CLUBS];

export const TENDENCY_LABELS: Record<string, string> = {
  straight: 'Straight',
  'slight-fade': 'Slight Fade',
  fade: 'Fade',
  slice: 'Slice',
  'slight-draw': 'Slight Draw',
  draw: 'Draw',
  hook: 'Hook',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/clubs.ts
git commit -m "feat: add club constants and default bag"
```

---

## Task 4: AsyncStorage Cache Layer

**Files:**
- Create: `src/storage/cache.ts`
- Create: `__tests__/storage/cache.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/storage/cache.test.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheSet, cacheGet, cacheRemove } from '../../src/storage/cache';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('cache', () => {
  beforeEach(() => {
    AsyncStorage.clear();
  });

  it('stores and retrieves a value', async () => {
    await cacheSet('test-key', { foo: 'bar' });
    const result = await cacheGet<{ foo: string }>('test-key');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns null for missing key', async () => {
    const result = await cacheGet('missing-key');
    expect(result).toBeNull();
  });

  it('removes a key', async () => {
    await cacheSet('to-remove', { data: 1 });
    await cacheRemove('to-remove');
    const result = await cacheGet('to-remove');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/storage/cache.test.ts
```

Expected: FAIL — `cacheSet`, `cacheGet`, `cacheRemove` not found.

- [ ] **Step 3: Implement cache module**

Create `src/storage/cache.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}

export async function cacheRemove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/storage/cache.test.ts
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/storage/cache.ts __tests__/storage/cache.test.ts
git commit -m "feat: add AsyncStorage cache layer with tests"
```

---

## Task 5: Player Profile Store

**Files:**
- Create: `src/store/profileStore.ts`
- Create: `src/store/courseStore.ts` (stub)
- Create: `src/store/planStore.ts` (stub)
- Create: `__tests__/store/profileStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/store/profileStore.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react-native';
import { useProfileStore } from '../../src/store/profileStore';
import { DEFAULT_BAG } from '../../src/constants/clubs';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.setState({
      profile: {
        handicap: null,
        shotTendency: 'straight',
        bag: DEFAULT_BAG,
        hasCompletedOnboarding: false,
      },
    });
  });

  it('starts with default bag', () => {
    const { result } = renderHook(() => useProfileStore());
    expect(result.current.profile.bag).toEqual(DEFAULT_BAG);
  });

  it('toggles a club on and off', () => {
    const { result } = renderHook(() => useProfileStore());
    const driverId = 'driver';

    act(() => result.current.toggleClub(driverId));
    expect(result.current.profile.bag.find(c => c.id === driverId)?.selected).toBe(false);

    act(() => result.current.toggleClub(driverId));
    expect(result.current.profile.bag.find(c => c.id === driverId)?.selected).toBe(true);
  });

  it('sets carry distance for a club', () => {
    const { result } = renderHook(() => useProfileStore());

    act(() => result.current.setCarryDistance('7i', 150));
    expect(result.current.profile.bag.find(c => c.id === '7i')?.carryYards).toBe(150);
  });

  it('sets shot tendency', () => {
    const { result } = renderHook(() => useProfileStore());

    act(() => result.current.setShotTendency('slice'));
    expect(result.current.profile.shotTendency).toBe('slice');
  });

  it('sets handicap', () => {
    const { result } = renderHook(() => useProfileStore());

    act(() => result.current.setHandicap(14));
    expect(result.current.profile.handicap).toBe(14);
  });

  it('marks onboarding complete', () => {
    const { result } = renderHook(() => useProfileStore());

    act(() => result.current.completeOnboarding());
    expect(result.current.profile.hasCompletedOnboarding).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/store/profileStore.test.ts
```

Expected: FAIL — `useProfileStore` not found.

- [ ] **Step 3: Implement profile store**

Create `src/store/profileStore.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProfile, ShotTendency } from '../types';
import { DEFAULT_BAG } from '../constants/clubs';

interface ProfileStore {
  profile: PlayerProfile;
  toggleClub: (clubId: string) => void;
  setCarryDistance: (clubId: string, yards: number) => void;
  setShotTendency: (tendency: ShotTendency) => void;
  setHandicap: (handicap: number | null) => void;
  completeOnboarding: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: {
        handicap: null,
        shotTendency: 'straight',
        bag: DEFAULT_BAG,
        hasCompletedOnboarding: false,
      },
      toggleClub: (clubId) =>
        set((state) => ({
          profile: {
            ...state.profile,
            bag: state.profile.bag.map((c) =>
              c.id === clubId ? { ...c, selected: !c.selected } : c
            ),
          },
        })),
      setCarryDistance: (clubId, yards) =>
        set((state) => ({
          profile: {
            ...state.profile,
            bag: state.profile.bag.map((c) =>
              c.id === clubId ? { ...c, carryYards: yards } : c
            ),
          },
        })),
      setShotTendency: (tendency) =>
        set((state) => ({
          profile: { ...state.profile, shotTendency: tendency },
        })),
      setHandicap: (handicap) =>
        set((state) => ({
          profile: { ...state.profile, handicap },
        })),
      completeOnboarding: () =>
        set((state) => ({
          profile: { ...state.profile, hasCompletedOnboarding: true },
        })),
    }),
    {
      name: 'player-profile',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- [ ] **Step 4: Create store stubs for Plan 2 and 3**

Create `src/store/courseStore.ts`:

```typescript
import { create } from 'zustand';
import { Course } from '../types';

interface CourseStore {
  courses: Record<string, Course>;
}

export const useCourseStore = create<CourseStore>()(() => ({
  courses: {},
}));
```

Create `src/store/planStore.ts`:

```typescript
import { create } from 'zustand';
import { GamePlan } from '../types';

interface PlanStore {
  plans: GamePlan[];
}

export const usePlanStore = create<PlanStore>()(() => ({
  plans: [],
}));
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/store/profileStore.test.ts
```

Expected: PASS — 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/store/ __tests__/store/profileStore.test.ts
git commit -m "feat: add profile, course, and plan Zustand stores"
```

---

## Task 6: Dev Fixtures

**Files:**
- Create: `fixtures/course-sample.json`
- Create: `fixtures/strategy-sample.json`

- [ ] **Step 1: Create course fixture**

Create `fixtures/course-sample.json`:

```json
{
  "id": "fixture-course-001",
  "name": "Old Course",
  "club": "St Andrews Links",
  "location": "St Andrews, Scotland",
  "lat": 56.3432,
  "lng": -2.8028,
  "tees": [
    {
      "name": "White",
      "holes": [
        {
          "number": 1,
          "par": 4,
          "distanceYards": 376,
          "strokeIndex": 11,
          "geodata": {
            "teeBox": { "lat": 56.3401, "lng": -2.8021 },
            "fairwayPolygon": [
              { "lat": 56.3401, "lng": -2.8021 },
              { "lat": 56.3408, "lng": -2.8025 },
              { "lat": 56.3415, "lng": -2.8020 },
              { "lat": 56.3408, "lng": -2.8016 }
            ],
            "greenPolygon": [
              { "lat": 56.3432, "lng": -2.8028 },
              { "lat": 56.3433, "lng": -2.8025 },
              { "lat": 56.3435, "lng": -2.8027 },
              { "lat": 56.3434, "lng": -2.8030 }
            ],
            "hazards": [
              {
                "type": "bunker",
                "label": "Swilcan Bunker",
                "polygon": [
                  { "lat": 56.3420, "lng": -2.8019 },
                  { "lat": 56.3421, "lng": -2.8018 },
                  { "lat": 56.3421, "lng": -2.8020 },
                  { "lat": 56.3420, "lng": -2.8021 }
                ]
              }
            ]
          }
        },
        {
          "number": 2,
          "par": 4,
          "distanceYards": 411,
          "strokeIndex": 3,
          "geodata": {
            "teeBox": { "lat": 56.3440, "lng": -2.8035 },
            "fairwayPolygon": null,
            "greenPolygon": [
              { "lat": 56.3460, "lng": -2.8040 },
              { "lat": 56.3461, "lng": -2.8037 },
              { "lat": 56.3463, "lng": -2.8039 },
              { "lat": 56.3462, "lng": -2.8042 }
            ],
            "hazards": [
              {
                "type": "water",
                "label": "Swilcan Burn",
                "polygon": [
                  { "lat": 56.3435, "lng": -2.8030 },
                  { "lat": 56.3436, "lng": -2.8028 },
                  { "lat": 56.3437, "lng": -2.8031 }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Create strategy fixture**

Create `fixtures/strategy-sample.json`:

```json
[
  {
    "hole": 1,
    "teeClub": "Driver",
    "target": "Centre fairway, short of Swilcan Bunker at 220 yds",
    "avoid": "Swilcan Bunker right at 220 yds, rough left",
    "reasoning": "Wide fairway but the bunker penalises anything right of centre. Your draw should track centre-left naturally."
  },
  {
    "hole": 2,
    "teeClub": "3 Wood",
    "target": "Left side of fairway to open up the green",
    "avoid": "Swilcan Burn short of the green, rough right",
    "reasoning": "The burn runs across in front of the green. A 3 Wood leaves a full approach distance and keeps you clear of the water."
  }
]
```

- [ ] **Step 3: Commit**

```bash
git add fixtures/
git commit -m "feat: add dev fixtures for course and strategy API responses"
```

---

## Task 7: TendencySelector Component

**Files:**
- Create: `src/components/TendencySelector.tsx`
- Create: `__tests__/components/TendencySelector.test.tsx`

- [ ] **Step 1: Write failing test**

Create `__tests__/components/TendencySelector.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TendencySelector } from '../../src/components/TendencySelector';
import { ShotTendency } from '../../src/types';

describe('TendencySelector', () => {
  it('renders all tendency options', () => {
    const { getByText } = render(
      <TendencySelector selected="straight" onSelect={jest.fn()} />
    );
    expect(getByText('Straight')).toBeTruthy();
    expect(getByText('Slice')).toBeTruthy();
    expect(getByText('Hook')).toBeTruthy();
  });

  it('calls onSelect with the chosen tendency', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <TendencySelector selected="straight" onSelect={onSelect} />
    );
    fireEvent.press(getByText('Slice'));
    expect(onSelect).toHaveBeenCalledWith('slice');
  });

  it('highlights the selected tendency', () => {
    const { getByTestId } = render(
      <TendencySelector selected="draw" onSelect={jest.fn()} />
    );
    expect(getByTestId('tendency-draw-selected')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/TendencySelector.test.tsx
```

Expected: FAIL — `TendencySelector` not found.

- [ ] **Step 3: Implement TendencySelector**

Create `src/components/TendencySelector.tsx`:

```typescript
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ShotTendency } from '../types';
import { TENDENCY_LABELS } from '../constants/clubs';

const TENDENCIES: ShotTendency[] = [
  'slice',
  'fade',
  'slight-fade',
  'straight',
  'slight-draw',
  'draw',
  'hook',
];

interface Props {
  selected: ShotTendency;
  onSelect: (tendency: ShotTendency) => void;
}

export function TendencySelector({ selected, onSelect }: Props) {
  return (
    <View style={styles.container}>
      {TENDENCIES.map((t) => {
        const isSelected = t === selected;
        return (
          <Pressable
            key={t}
            testID={isSelected ? `tendency-${t}-selected` : `tendency-${t}`}
            style={[styles.option, isSelected && styles.selected]}
            onPress={() => onSelect(t)}
          >
            <Text style={[styles.label, isSelected && styles.selectedLabel]}>
              {TENDENCY_LABELS[t]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3a3a5c',
    backgroundColor: '#16213e',
  },
  selected: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  label: {
    color: '#ccc',
    fontSize: 14,
  },
  selectedLabel: {
    color: '#000',
    fontWeight: '600',
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/TendencySelector.test.tsx
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TendencySelector.tsx __tests__/components/TendencySelector.test.tsx
git commit -m "feat: add TendencySelector component with tests"
```

---

## Task 8: BagBuilder Component

**Files:**
- Create: `src/components/BagBuilder.tsx`
- Create: `__tests__/components/BagBuilder.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/BagBuilder.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BagBuilder } from '../../src/components/BagBuilder';
import { DEFAULT_BAG, EXTRA_CLUBS } from '../../src/constants/clubs';

describe('BagBuilder', () => {
  it('renders all default clubs', () => {
    const { getByText } = render(
      <BagBuilder bag={DEFAULT_BAG} onToggle={jest.fn()} onSetDistance={jest.fn()} />
    );
    expect(getByText('Driver')).toBeTruthy();
    expect(getByText('Putter')).toBeTruthy();
  });

  it('calls onToggle when a club is pressed', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <BagBuilder bag={DEFAULT_BAG} onToggle={onToggle} onSetDistance={jest.fn()} />
    );
    fireEvent.press(getByTestId('club-toggle-driver'));
    expect(onToggle).toHaveBeenCalledWith('driver');
  });

  it('calls onSetDistance when distance is entered', () => {
    const onSetDistance = jest.fn();
    const { getByTestId } = render(
      <BagBuilder bag={DEFAULT_BAG} onToggle={jest.fn()} onSetDistance={onSetDistance} />
    );
    fireEvent.changeText(getByTestId('club-distance-driver'), '250');
    expect(onSetDistance).toHaveBeenCalledWith('driver', 250);
  });

  it('shows selected clubs with a visual indicator', () => {
    const { getByTestId } = render(
      <BagBuilder bag={DEFAULT_BAG} onToggle={jest.fn()} onSetDistance={jest.fn()} />
    );
    // Driver is selected by default
    expect(getByTestId('club-selected-driver')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/components/BagBuilder.test.tsx
```

Expected: FAIL — `BagBuilder` not found.

- [ ] **Step 3: Implement BagBuilder**

Create `src/components/BagBuilder.tsx`:

```typescript
import React from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Club } from '../types';

interface Props {
  bag: Club[];
  onToggle: (clubId: string) => void;
  onSetDistance: (clubId: string, yards: number) => void;
}

export function BagBuilder({ bag, onToggle, onSetDistance }: Props) {
  return (
    <ScrollView>
      {bag.map((club) => (
        <View key={club.id} style={styles.row}>
          <Pressable
            testID={`club-toggle-${club.id}`}
            style={[styles.toggle, club.selected && styles.toggleSelected]}
            onPress={() => onToggle(club.id)}
          >
            {club.selected && (
              <View testID={`club-selected-${club.id}`} style={styles.checkDot} />
            )}
          </Pressable>
          <Text style={[styles.clubName, !club.selected && styles.clubNameMuted]}>
            {club.name}
          </Text>
          {club.selected && (
            <TextInput
              testID={`club-distance-${club.id}`}
              style={styles.distanceInput}
              placeholder="yds"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={club.carryYards != null ? String(club.carryYards) : ''}
              onChangeText={(val) => {
                const num = parseInt(val, 10);
                if (!isNaN(num)) onSetDistance(club.id, num);
              }}
            />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e3a',
    gap: 12,
  },
  toggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3a3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  clubName: {
    flex: 1,
    fontSize: 16,
    color: '#f0f0f0',
  },
  clubNameMuted: {
    color: '#555',
  },
  distanceInput: {
    width: 70,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a5c',
    backgroundColor: '#16213e',
    color: '#f0f0f0',
    textAlign: 'center',
    fontSize: 14,
    paddingHorizontal: 8,
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/BagBuilder.test.tsx
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/BagBuilder.tsx __tests__/components/BagBuilder.test.tsx
git commit -m "feat: add BagBuilder component with tests"
```

---

## Task 9: Root Layout + Navigation

**Files:**
- Create: `app/_layout.tsx`
- Create: `app/index.tsx` (Home — empty state)
- Create: `app/onboarding.tsx` (Profile screen)

- [ ] **Step 1: Create root layout**

Create `app/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f1923' },
          headerTintColor: '#f0f0f0',
          contentStyle: { backgroundColor: '#0f1923' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Par Planner' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Build Your Profile' }} />
      </Stack>
    </>
  );
}
```

- [ ] **Step 2: Create Home screen**

Create `app/index.tsx`:

```typescript
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useProfileStore } from '../src/store/profileStore';
import { usePlanStore } from '../src/store/planStore';

export default function HomeScreen() {
  const { profile } = useProfileStore();
  const { plans } = usePlanStore();

  return (
    <View style={styles.container}>
      {!profile.hasCompletedOnboarding && (
        <Pressable style={styles.banner} onPress={() => router.push('/onboarding')}>
          <Text style={styles.bannerText}>
            Set up your profile to get personalised strategy →
          </Text>
        </Pressable>
      )}

      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No rounds planned yet</Text>
          <Text style={styles.emptySubtitle}>
            Search for a course to create your first game plan
          </Text>
        </View>
      ) : (
        <Text style={styles.sectionLabel}>YOUR PLANS</Text>
      )}

      <Pressable style={styles.cta} onPress={() => {}}>
        <Text style={styles.ctaText}>Plan New Round</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1923',
    padding: 20,
  },
  banner: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  bannerText: {
    color: '#22c55e',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#f0f0f0',
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
  sectionLabel: {
    color: '#666',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  cta: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  ctaText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
```

- [ ] **Step 3: Create Onboarding / Profile screen**

Create `app/onboarding.tsx`:

```typescript
import React from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useProfileStore } from '../src/store/profileStore';
import { BagBuilder } from '../src/components/BagBuilder';
import { TendencySelector } from '../src/components/TendencySelector';
import { ALL_CLUBS } from '../src/constants/clubs';

export default function OnboardingScreen() {
  const {
    profile,
    toggleClub,
    setCarryDistance,
    setShotTendency,
    setHandicap,
    completeOnboarding,
  } = useProfileStore();

  function handleSave() {
    completeOnboarding();
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Shot Tendency</Text>
      <Text style={styles.sectionHint}>How does your ball typically fly?</Text>
      <TendencySelector
        selected={profile.shotTendency}
        onSelect={setShotTendency}
      />

      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Handicap</Text>
      <Text style={styles.sectionHint}>Optional — used to tailor advice</Text>
      <TextInput
        style={styles.handicapInput}
        placeholder="e.g. 18"
        placeholderTextColor="#555"
        keyboardType="numeric"
        value={profile.handicap != null ? String(profile.handicap) : ''}
        onChangeText={(val) => {
          const num = parseInt(val, 10);
          setHandicap(isNaN(num) ? null : num);
        }}
      />

      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Your Bag</Text>
      <Text style={styles.sectionHint}>
        Select the clubs you carry and enter carry distances
      </Text>
      <BagBuilder
        bag={ALL_CLUBS.map(
          (c) => profile.bag.find((b) => b.id === c.id) ?? c
        )}
        onToggle={toggleClub}
        onSetDistance={setCarryDistance}
      />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Profile</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1923',
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  sectionTitle: {
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionHint: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 12,
  },
  handicapInput: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a3a5c',
    color: '#f0f0f0',
    padding: 12,
    fontSize: 16,
    width: 100,
  },
  saveButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
```

- [ ] **Step 4: Run the app and verify**

```bash
npx expo start
```

Expected:
- Home screen renders with "Plan New Round" button and profile banner
- Tapping the banner navigates to onboarding
- Onboarding shows tendency selector, handicap input, and bag builder
- Selecting clubs, entering distances, and saving persists across app restarts

- [ ] **Step 5: Run all tests**

```bash
npx jest
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: add root layout, home screen, and onboarding screen"
```

---

## Task 10: Push to GitHub

- [ ] **Step 1: Push all commits**

```bash
git push
```

Expected: All commits from Tasks 1–9 visible at https://github.com/cdtm88/par-planner

- [ ] **Step 2: Verify on GitHub**

Open https://github.com/cdtm88/par-planner and confirm:
- `src/` directory with types, store, storage, constants, components
- `app/` directory with `_layout.tsx`, `index.tsx`, `onboarding.tsx`
- `fixtures/` directory with sample JSON
- `__tests__/` directory with all test files

---

## Plan 1 Complete

At this point you have:
- A working Expo app with Expo Router navigation
- Persistent player profile (bag builder + shot tendency + handicap)
- Full test coverage for store, cache, and components
- Dev fixtures ready for Plans 2 and 3

**Next: Plan 2 — Course Search + Maps4Golf API + Caching**
