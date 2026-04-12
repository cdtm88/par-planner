# Par Planner — Plan 3: AI Strategy + Hole Planner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a personalised hole-by-hole game plan using Claude AI and let the player review, edit, and confirm each hole before the round.

**Architecture:** A fixture-aware Claude API client sends all holes + player profile in a single prompt and returns `HolePlan[]`; the `planStore` persists plans in AsyncStorage and tracks per-hole confirmation state. The planner screen renders one hole at a time with editable AI suggestions; confirming the last hole marks the plan complete and navigates home. The home screen is updated to list saved plans.

**Tech Stack:** Expo Router, Zustand + persist, AsyncStorage, Anthropic Claude API (claude-haiku-4-5-20251001), Jest + React Native Testing Library

**This is Plan 3 of 4:**
- Plan 1: Foundation + Player Profile ✅
- Plan 2: Course Search + Maps4Golf API + Caching ✅
- Plan 3 (this): AI Strategy + Hole Planner ← you are here
- Plan 4: On-Course Mode

---

## File Structure

```
ai/par-planner/
├── .env.local                              ← Modify: add EXPO_PUBLIC_ANTHROPIC_API_KEY=
├── app/
│   ├── _layout.tsx                         ← Modify: register planner screen
│   ├── index.tsx                           ← Modify: render saved plans list
│   └── planner.tsx                         ← New: hole-by-hole planner screen
├── fixtures/
│   └── strategy-sample.json               ← Modify: rename "hole" → "holeNumber"
├── src/
│   ├── api/
│   │   └── claude.ts                       ← New: Claude API client (fixture-aware)
│   └── store/
│       └── planStore.ts                    ← Modify: add persist + createPlan/confirmHole/updateHolePlan
└── __tests__/
    ├── api/
    │   └── claude.test.ts                  ← New
    └── store/
        └── planStore.test.ts               ← New
```

---

## Task 1: Update Strategy Fixture + Claude API Client

**Files:**
- Modify: `ai/par-planner/fixtures/strategy-sample.json`
- Modify: `ai/par-planner/.env.local`
- Create: `ai/par-planner/src/api/claude.ts`
- Create: `ai/par-planner/__tests__/api/claude.test.ts`

- [ ] **Step 1: Update strategy fixture**

The fixture currently uses `"hole"` but `HolePlan` uses `holeNumber`. Replace `ai/par-planner/fixtures/strategy-sample.json` entirely:

```json
[
  {
    "holeNumber": 1,
    "teeClub": "Driver",
    "target": "Centre fairway, short of Swilcan Bunker at 220 yds",
    "avoid": "Swilcan Bunker right at 220 yds, rough left",
    "reasoning": "Wide fairway but the bunker penalises anything right of centre. Your draw should track centre-left naturally."
  },
  {
    "holeNumber": 2,
    "teeClub": "3 Wood",
    "target": "Left side of fairway to open up the green",
    "avoid": "Swilcan Burn short of the green, rough right",
    "reasoning": "The burn runs across in front of the green. A 3 Wood leaves a full approach distance and keeps you clear of the water."
  }
]
```

- [ ] **Step 2: Add Anthropic API key entry to .env.local**

Open `ai/par-planner/.env.local` and append:

```
# Set to your Anthropic API key to use the real Claude API.
# Leave empty or unset to use fixture data during development.
EXPO_PUBLIC_ANTHROPIC_API_KEY=
```

- [ ] **Step 3: Write failing tests**

Create `ai/par-planner/__tests__/api/claude.test.ts`:

```typescript
// Force fixture mode for all tests
process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY = '';

import { generateStrategy } from '../../src/api/claude';
import { Hole, PlayerProfile } from '../../src/types';
import { DEFAULT_BAG } from '../../src/constants/clubs';

const mockHoles: Hole[] = [
  {
    number: 1,
    par: 4,
    distanceYards: 376,
    strokeIndex: 11,
    geodata: {
      teeBox: { lat: 56.34, lng: -2.80 },
      fairwayPolygon: null,
      greenPolygon: [],
      hazards: [{ type: 'bunker', label: 'Swilcan Bunker', polygon: [] }],
    },
  },
  {
    number: 2,
    par: 4,
    distanceYards: 411,
    strokeIndex: 3,
    geodata: null,
  },
];

const mockProfile: PlayerProfile = {
  handicap: 14,
  shotTendency: 'draw',
  bag: DEFAULT_BAG,
  hasCompletedOnboarding: true,
};

describe('claude (fixture mode)', () => {
  it('generateStrategy returns one HolePlan per hole', async () => {
    const plans = await generateStrategy(mockHoles, mockProfile);
    expect(plans).toHaveLength(2);
  });

  it('each HolePlan has all required fields with correct types', async () => {
    const plans = await generateStrategy(mockHoles, mockProfile);
    for (const plan of plans) {
      expect(typeof plan.holeNumber).toBe('number');
      expect(typeof plan.teeClub).toBe('string');
      expect(plan.teeClub.length).toBeGreaterThan(0);
      expect(typeof plan.target).toBe('string');
      expect(plan.target.length).toBeGreaterThan(0);
      expect(typeof plan.avoid).toBe('string');
      expect(plan.avoid.length).toBeGreaterThan(0);
      expect(typeof plan.reasoning).toBe('string');
      expect(plan.reasoning.length).toBeGreaterThan(0);
      expect(plan.confirmed).toBe(false);
    }
  });

  it('holeNumbers match the input holes in order', async () => {
    const plans = await generateStrategy(mockHoles, mockProfile);
    expect(plans[0].holeNumber).toBe(1);
    expect(plans[1].holeNumber).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd ai/par-planner && npx jest __tests__/api/claude.test.ts --no-coverage
```

Expected: FAIL — `generateStrategy` not found.

- [ ] **Step 5: Implement Claude API client**

Create `ai/par-planner/src/api/claude.ts`:

```typescript
import { Hole, HolePlan, PlayerProfile } from '../types';

interface FixtureEntry {
  holeNumber: number;
  teeClub: string;
  target: string;
  avoid: string;
  reasoning: string;
}

const strategyFixture: FixtureEntry[] = require('../../fixtures/strategy-sample.json');

function isFixtureMode(): boolean {
  return !process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
}

/**
 * Generate a hole-by-hole tee strategy for the given holes and player profile.
 * All holes are sent in a single API call.
 *
 * Fixture mode: returns fixture data for holes 1–2, generic plan for any remaining holes.
 * Production: calls Anthropic claude-haiku-4-5-20251001 with a structured prompt.
 */
export async function generateStrategy(
  holes: Hole[],
  profile: PlayerProfile
): Promise<HolePlan[]> {
  if (isFixtureMode()) {
    await new Promise((r) => setTimeout(r, 800));
    return holes.map((hole) => {
      const fx = strategyFixture.find((f) => f.holeNumber === hole.number);
      return {
        holeNumber: hole.number,
        teeClub: fx?.teeClub ?? 'Driver',
        target: fx?.target ?? 'Centre fairway',
        avoid: fx?.avoid ?? 'Out of bounds and rough',
        reasoning: fx?.reasoning ?? 'Play conservatively to the centre of the fairway.',
        confirmed: false,
      };
    });
  }

  const selectedClubs = profile.bag
    .filter((c) => c.selected && c.carryYards)
    .map((c) => `${c.name}: ${c.carryYards}yds`)
    .join(', ');

  const holeDescriptions = holes
    .map((h) => {
      const hazards =
        h.geodata?.hazards
          .map((hz) => `${hz.type}${hz.label ? ` (${hz.label})` : ''}`)
          .join(', ') ?? 'none';
      return `Hole ${h.number}: Par ${h.par}, ${h.distanceYards}yds, SI ${h.strokeIndex}, Hazards: ${hazards}`;
    })
    .join('\n');

  const prompt = `You are an expert golf caddie. Generate a tee strategy for each hole.

Player profile:
- Shot tendency: ${profile.shotTendency}
- Handicap: ${profile.handicap ?? 'not provided'}
- Bag (club: carry distance): ${selectedClubs || 'standard set, distances unknown'}

Course holes:
${holeDescriptions}

Return ONLY a JSON array — no markdown, no explanation. One object per hole with these exact keys:
- holeNumber: number
- teeClub: string (name of club from player's bag)
- target: string (specific aiming point, reference landmarks if known)
- avoid: string (specific hazards with distances where relevant)
- reasoning: string (one sentence tailored to the player's shot tendency)`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API failed: ${res.status}`);

  const data = await res.json();
  const text: string = data.content[0].text;
  const raw = JSON.parse(text) as FixtureEntry[];
  return raw.map((h) => ({ ...h, confirmed: false }));
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest __tests__/api/claude.test.ts --no-coverage
```

Expected: PASS — 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add ai/par-planner/fixtures/strategy-sample.json ai/par-planner/src/api/claude.ts ai/par-planner/__tests__/api/claude.test.ts
git commit -m "feat: add Claude API client with fixture mode"
```

---

## Task 2: Extend planStore

**Files:**
- Modify: `ai/par-planner/src/store/planStore.ts`
- Create: `ai/par-planner/__tests__/store/planStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `ai/par-planner/__tests__/store/planStore.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react-native';
import { usePlanStore } from '../../src/store/planStore';
import { HolePlan } from '../../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function makeHoles(count: number): HolePlan[] {
  return Array.from({ length: count }, (_, i) => ({
    holeNumber: i + 1,
    teeClub: 'Driver',
    target: 'Centre fairway',
    avoid: 'Bunkers',
    reasoning: 'Safe play.',
    confirmed: false,
  }));
}

describe('planStore', () => {
  beforeEach(() => {
    usePlanStore.setState({ plans: [] });
  });

  it('starts with no plans', () => {
    const { result } = renderHook(() => usePlanStore());
    expect(result.current.plans).toEqual([]);
  });

  it('createPlan adds a plan with correct fields', () => {
    const { result } = renderHook(() => usePlanStore());

    act(() => {
      result.current.createPlan('course-001', 'Old Course', 'White', makeHoles(2));
    });

    expect(result.current.plans).toHaveLength(1);
    const plan = result.current.plans[0];
    expect(plan.courseId).toBe('course-001');
    expect(plan.courseName).toBe('Old Course');
    expect(plan.tee).toBe('White');
    expect(plan.holes).toHaveLength(2);
    expect(plan.complete).toBe(false);
    expect(typeof plan.id).toBe('string');
    expect(typeof plan.createdAt).toBe('string');
  });

  it('confirmHole marks the correct hole as confirmed', async () => {
    const { result } = renderHook(() => usePlanStore());

    let planId: string;
    act(() => {
      const plan = result.current.createPlan('course-001', 'Old Course', 'White', makeHoles(2));
      planId = plan.id;
    });

    await act(async () => {
      result.current.confirmHole(planId!, 1);
    });

    const hole1 = result.current.plans[0].holes.find((h) => h.holeNumber === 1);
    const hole2 = result.current.plans[0].holes.find((h) => h.holeNumber === 2);
    expect(hole1?.confirmed).toBe(true);
    expect(hole2?.confirmed).toBe(false);
  });

  it('complete becomes true when all holes are confirmed', async () => {
    const { result } = renderHook(() => usePlanStore());

    let planId: string;
    act(() => {
      const plan = result.current.createPlan('course-001', 'Old Course', 'White', makeHoles(2));
      planId = plan.id;
    });

    await act(async () => {
      result.current.confirmHole(planId!, 1);
    });
    expect(result.current.plans[0].complete).toBe(false);

    await act(async () => {
      result.current.confirmHole(planId!, 2);
    });
    expect(result.current.plans[0].complete).toBe(true);
  });

  it('updateHolePlan replaces only the specified fields', async () => {
    const { result } = renderHook(() => usePlanStore());

    let planId: string;
    act(() => {
      const plan = result.current.createPlan('course-001', 'Old Course', 'White', makeHoles(2));
      planId = plan.id;
    });

    await act(async () => {
      result.current.updateHolePlan(planId!, 1, { teeClub: '3 Wood', target: 'Left side' });
    });

    const hole = result.current.plans[0].holes.find((h) => h.holeNumber === 1);
    expect(hole?.teeClub).toBe('3 Wood');
    expect(hole?.target).toBe('Left side');
    // Unmodified fields unchanged
    expect(hole?.avoid).toBe('Bunkers');
    expect(hole?.reasoning).toBe('Safe play.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/store/planStore.test.ts --no-coverage
```

Expected: FAIL — `createPlan`, `confirmHole`, `updateHolePlan` not found.

- [ ] **Step 3: Implement extended planStore**

Replace `ai/par-planner/src/store/planStore.ts` entirely:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GamePlan, HolePlan } from '../types';

interface PlanStore {
  plans: GamePlan[];
  createPlan: (
    courseId: string,
    courseName: string,
    tee: string,
    holes: HolePlan[]
  ) => GamePlan;
  confirmHole: (planId: string, holeNumber: number) => void;
  updateHolePlan: (
    planId: string,
    holeNumber: number,
    updates: Partial<Pick<HolePlan, 'teeClub' | 'target' | 'avoid' | 'reasoning'>>
  ) => void;
}

export const usePlanStore = create<PlanStore>()(
  persist(
    (set) => ({
      plans: [],

      createPlan: (courseId, courseName, tee, holes) => {
        const plan: GamePlan = {
          id: `${courseId}-${tee}-${Date.now()}`,
          courseId,
          courseName,
          tee,
          createdAt: new Date().toISOString(),
          holes,
          complete: false,
        };
        set((state) => ({ plans: [...state.plans, plan] }));
        return plan;
      },

      confirmHole: (planId, holeNumber) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan;
            const holes = plan.holes.map((h) =>
              h.holeNumber === holeNumber ? { ...h, confirmed: true } : h
            );
            return { ...plan, holes, complete: holes.every((h) => h.confirmed) };
          }),
        }));
      },

      updateHolePlan: (planId, holeNumber, updates) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan;
            return {
              ...plan,
              holes: plan.holes.map((h) =>
                h.holeNumber === holeNumber ? { ...h, ...updates } : h
              ),
            };
          }),
        }));
      },
    }),
    {
      name: 'game-plans',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/store/planStore.test.ts --no-coverage
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: All 29 tests pass (23 from Plans 1–2 + 6 new).

- [ ] **Step 6: Commit**

```bash
git add ai/par-planner/src/store/planStore.ts ai/par-planner/__tests__/store/planStore.test.ts
git commit -m "feat: extend planStore with persist and plan management actions"
```

---

## Task 3: Register Planner Screen in Layout

**Files:**
- Modify: `ai/par-planner/app/_layout.tsx`

- [ ] **Step 1: Add planner screen to the stack**

Replace `ai/par-planner/app/_layout.tsx` entirely:

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
        <Stack.Screen name="search" options={{ title: 'Find a Course' }} />
        <Stack.Screen name="planner" options={{ title: 'Game Plan' }} />
      </Stack>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ai/par-planner/app/_layout.tsx
git commit -m "feat: register planner screen in root layout"
```

---

## Task 4: Planner Screen

**Files:**
- Create: `ai/par-planner/app/planner.tsx`

- [ ] **Step 1: Create the planner screen**

Create `ai/par-planner/app/planner.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useCourseStore } from '../src/store/courseStore';
import { useProfileStore } from '../src/store/profileStore';
import { usePlanStore } from '../src/store/planStore';
import { generateStrategy } from '../src/api/claude';
import { HolePlan } from '../src/types';

export default function PlannerScreen() {
  const { courseId, tee } = useLocalSearchParams<{ courseId: string; tee: string }>();

  const [planId, setPlanId] = useState<string | null>(null);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<
    Pick<HolePlan, 'teeClub' | 'target' | 'avoid' | 'reasoning'>
  >({ teeClub: '', target: '', avoid: '', reasoning: '' });

  // Read stores once on mount to avoid stale closure — direct getState() calls
  useEffect(() => {
    const { courses } = useCourseStore.getState();
    const { profile } = useProfileStore.getState();
    const { plans, createPlan } = usePlanStore.getState();

    const course = courses[courseId];
    if (!course) return;

    const teeData = course.tees.find((t) => t.name === tee);
    if (!teeData) return;

    // Resume existing incomplete plan
    const existing = plans.find(
      (p) => p.courseId === courseId && p.tee === tee && !p.complete
    );
    if (existing) {
      setPlanId(existing.id);
      const firstUnconfirmed = existing.holes.findIndex((h) => !h.confirmed);
      const startIndex = firstUnconfirmed >= 0 ? firstUnconfirmed : 0;
      setCurrentHoleIndex(startIndex);
      const startHole = existing.holes[startIndex];
      setEditingFields({
        teeClub: startHole.teeClub,
        target: startHole.target,
        avoid: startHole.avoid,
        reasoning: startHole.reasoning,
      });
      return;
    }

    // Generate new strategy
    setIsGenerating(true);
    setGenerateError(null);
    generateStrategy(teeData.holes, profile)
      .then((holePlans) => {
        const newPlan = createPlan(courseId, course.name, tee, holePlans);
        setPlanId(newPlan.id);
        setEditingFields({
          teeClub: holePlans[0].teeClub,
          target: holePlans[0].target,
          avoid: holePlans[0].avoid,
          reasoning: holePlans[0].reasoning,
        });
        setIsGenerating(false);
      })
      .catch((e: Error) => {
        setGenerateError(e.message);
        setIsGenerating(false);
      });
  }, [courseId, tee]);

  // Keep editing fields in sync when navigating between holes
  const plan = usePlanStore((s) => s.plans.find((p) => p.id === planId));
  const { confirmHole, updateHolePlan } = usePlanStore.getState();

  const { courses } = useCourseStore();
  const course = courses[courseId];
  const teeData = course?.tees.find((t) => t.name === tee);
  const currentHoleData = teeData?.holes[currentHoleIndex];
  const currentHolePlan = plan?.holes[currentHoleIndex];
  const totalHoles = plan?.holes.length ?? 0;
  const confirmedCount = plan?.holes.filter((h) => h.confirmed).length ?? 0;

  function handleNavigateToHole(index: number) {
    const hole = plan?.holes[index];
    if (!hole) return;
    setCurrentHoleIndex(index);
    setEditingFields({
      teeClub: hole.teeClub,
      target: hole.target,
      avoid: hole.avoid,
      reasoning: hole.reasoning,
    });
  }

  function handleConfirm() {
    if (!planId || !currentHolePlan) return;
    updateHolePlan(planId, currentHolePlan.holeNumber, editingFields);
    confirmHole(planId, currentHolePlan.holeNumber);

    if (currentHoleIndex === totalHoles - 1) {
      router.replace('/');
      return;
    }
    handleNavigateToHole(currentHoleIndex + 1);
  }

  if (isGenerating) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22c55e" size="large" />
        <Text style={styles.loadingText}>Building your game plan...</Text>
        <Text style={styles.loadingSubtext}>Claude is analysing all {teeData?.holes.length ?? 18} holes</Text>
      </View>
    );
  }

  if (generateError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Strategy generation failed</Text>
        <Text style={styles.errorText}>{generateError}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!plan || !currentHolePlan || !currentHoleData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  const isLastHole = currentHoleIndex === totalHoles - 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hole header */}
      <View style={styles.holeHeader}>
        <Text style={styles.holeNumber}>Hole {currentHoleData.number}</Text>
        <View style={styles.holeMetaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>Par {currentHoleData.par}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>{currentHoleData.distanceYards} yds</Text>
          </View>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>SI {currentHoleData.strokeIndex}</Text>
          </View>
        </View>
      </View>

      {/* Confirmed indicator */}
      {currentHolePlan.confirmed && (
        <View style={styles.confirmedBanner}>
          <Text style={styles.confirmedText}>✓ Confirmed</Text>
        </View>
      )}

      {/* Editable strategy fields */}
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>TEE CLUB</Text>
        <TextInput
          style={styles.input}
          value={editingFields.teeClub}
          onChangeText={(v) => setEditingFields((f) => ({ ...f, teeClub: v }))}
          placeholderTextColor="#555"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.fieldLabel}>TARGET</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={editingFields.target}
          onChangeText={(v) => setEditingFields((f) => ({ ...f, target: v }))}
          multiline
          placeholderTextColor="#555"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.fieldLabel}>AVOID</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={editingFields.avoid}
          onChangeText={(v) => setEditingFields((f) => ({ ...f, avoid: v }))}
          multiline
          placeholderTextColor="#555"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.fieldLabel}>REASONING</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={editingFields.reasoning}
          onChangeText={(v) => setEditingFields((f) => ({ ...f, reasoning: v }))}
          multiline
          placeholderTextColor="#555"
        />
      </View>

      {/* Navigation + confirm row */}
      <View style={styles.navRow}>
        <Pressable
          style={[styles.navButton, currentHoleIndex === 0 && styles.navButtonDisabled]}
          onPress={() => handleNavigateToHole(currentHoleIndex - 1)}
          disabled={currentHoleIndex === 0}
        >
          <Text style={styles.navButtonText}>← Back</Text>
        </Pressable>

        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>
            {isLastHole ? 'Complete Plan ✓' : 'Confirm & Next →'}
          </Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <Text style={styles.progressLabel}>
          {confirmedCount} / {totalHoles} confirmed
        </Text>
        <View style={styles.progressDots}>
          {plan.holes.map((h, i) => (
            <Pressable
              key={h.holeNumber}
              style={[
                styles.dot,
                h.confirmed && styles.dotConfirmed,
                i === currentHoleIndex && styles.dotActive,
              ]}
              onPress={() => handleNavigateToHole(i)}
            />
          ))}
        </View>
      </View>
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
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0f1923',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSubtext: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 8,
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    paddingHorizontal: 24,
  },
  backButtonText: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '600',
  },
  holeHeader: {
    marginBottom: 16,
  },
  holeNumber: {
    color: '#f0f0f0',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  holeMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2d2d4e',
  },
  metaBadgeText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmedBanner: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
    padding: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmedText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#666',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a3a5c',
    color: '#f0f0f0',
    padding: 12,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 24,
  },
  navButton: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d2d4e',
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  progressSection: {
    gap: 10,
  },
  progressLabel: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2d2d4e',
    borderWidth: 1,
    borderColor: '#3a3a5c',
  },
  dotConfirmed: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  dotActive: {
    borderColor: '#f0f0f0',
    borderWidth: 2,
  },
});
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: All 29 tests pass (no tests for the screen itself — logic covered by store + API tests).

- [ ] **Step 3: Commit**

```bash
git add ai/par-planner/app/planner.tsx
git commit -m "feat: add hole-by-hole planner screen"
```

---

## Task 5: Update Home Screen to Show Saved Plans

**Files:**
- Modify: `ai/par-planner/app/index.tsx`

- [ ] **Step 1: Replace index.tsx with plans list**

Replace `ai/par-planner/app/index.tsx` entirely:

```typescript
import React from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useProfileStore } from '../src/store/profileStore';
import { usePlanStore } from '../src/store/planStore';
import { GamePlan } from '../src/types';

export default function HomeScreen() {
  const { profile } = useProfileStore();
  const { plans } = usePlanStore();

  const sortedPlans = [...plans].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function handlePlanPress(plan: GamePlan) {
    // Navigate to planner to resume — Plan 4 will route complete plans to on-course mode
    router.push({
      pathname: '/planner',
      params: { courseId: plan.courseId, tee: plan.tee },
    });
  }

  return (
    <View style={styles.container}>
      {!profile.hasCompletedOnboarding && (
        <Pressable style={styles.banner} onPress={() => router.push('/onboarding')}>
          <Text style={styles.bannerText}>
            Set up your profile to get personalised strategy →
          </Text>
        </Pressable>
      )}

      {sortedPlans.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No rounds planned yet</Text>
          <Text style={styles.emptySubtitle}>
            Search for a course to create your first game plan
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>YOUR PLANS</Text>
          <FlatList
            data={sortedPlans}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.planCard} onPress={() => handlePlanPress(item)}>
                <View style={styles.planCardTop}>
                  <Text style={styles.planName}>{item.courseName}</Text>
                  {item.complete && (
                    <View style={styles.completeBadge}>
                      <Text style={styles.completeBadgeText}>Complete</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.planMeta}>
                  {item.tee} tees · {formatDate(item.createdAt)}
                </Text>
                {!item.complete && (
                  <Text style={styles.planProgress}>
                    {item.holes.filter((h) => h.confirmed).length} / {item.holes.length} holes confirmed
                  </Text>
                )}
              </Pressable>
            )}
            style={styles.planList}
          />
        </>
      )}

      <Pressable style={styles.cta} onPress={() => router.push('/search')}>
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
  planList: {
    flex: 1,
  },
  planCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d2d4e',
    gap: 4,
  },
  planCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  completeBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  completeBadgeText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
  },
  planMeta: {
    color: '#ccc',
    fontSize: 13,
  },
  planProgress: {
    color: '#666',
    fontSize: 12,
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

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: All 29 tests pass.

- [ ] **Step 3: Commit**

```bash
git add ai/par-planner/app/index.tsx
git commit -m "feat: show saved plans list on home screen"
```

---

## Task 6: Push to GitHub

- [ ] **Step 1: Final test run**

```bash
npx jest --no-coverage
```

Expected: All 29 tests pass.

- [ ] **Step 2: Push**

```bash
git push
```

Expected: All commits visible at https://github.com/cdtm88/par-planner

---

## Plan 3 Complete

At this point you have:
- Claude API client that generates strategy from hole data + player profile (fixture in dev, real API in prod)
- `planStore` persisting plans to AsyncStorage with per-hole confirmation tracking
- Planner screen: AI suggestions pre-filled, editable fields, confirm per hole, progress dots, resume support
- Home screen showing saved plans with completion status
- 29 tests passing

**Next: Plan 4 — On-Course Mode**
