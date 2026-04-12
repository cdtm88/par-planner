import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePlanStore } from '../src/store/planStore';
import { useCourseStore } from '../src/store/courseStore';
import { HoleMap } from '../src/components/HoleMap';
import { HolePlan, Hole } from '../src/types';

interface HoleSlide {
  holePlan: HolePlan;
  hole: Hole | null;
}

export default function OnCourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plans } = usePlanStore();
  const { courses } = useCourseStore();
  const { width, height } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const plan = plans.find((p) => p.id === id);

  if (!plan) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Plan not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const course = courses[plan.courseId];
  const tee = course?.tees.find((t) => t.name === plan.tee);

  const slides: HoleSlide[] = plan.holes.map((holePlan) => ({
    holePlan,
    hole: tee?.holes.find((h) => h.number === holePlan.holeNumber) ?? null,
  }));

  const mapHeight = height * 0.45;
  const mapWidth = width * 0.45;

  const current = slides[currentIndex];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>{plan.courseName} · {plan.tee}</Text>
          <Text style={styles.headerSub}>
            {currentIndex + 1} / {slides.length}
          </Text>
        </View>
      </View>

      {/* Active slide content — renders only the current hole */}
      <View style={styles.slideContent}>
        {/* Hole header */}
        <View style={styles.holeHeader}>
          <Text style={styles.holeNumber}>HOLE {current.holePlan.holeNumber}</Text>
          <Text style={styles.holePar}>PAR {current.hole?.par ?? '–'}</Text>
          {current.hole && (
            <Text style={styles.holeDistance}>{current.hole.distanceYards} YDS</Text>
          )}
        </View>

        {/* Split view: map left, strategy right */}
        <View style={styles.splitRow}>
          <HoleMap
            geodata={current.hole?.geodata ?? null}
            width={mapWidth}
            height={mapHeight}
          />

          <View style={[styles.strategyCard, { width: width - mapWidth - 24 }]}>
            <View style={styles.strategyRow}>
              <Text style={styles.strategyLabel}>CLUB</Text>
              <Text style={styles.strategyValue}>{current.holePlan.teeClub}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.strategyRow}>
              <Text style={styles.strategyLabel}>AIM</Text>
              <Text style={styles.strategyValue}>{current.holePlan.target}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.strategyRow}>
              <Text style={styles.strategyLabel}>AVOID</Text>
              <Text style={[styles.strategyValue, styles.avoidText]}>
                {current.holePlan.avoid}
              </Text>
            </View>
          </View>
        </View>

        {/* Reasoning */}
        <View style={styles.reasoningCard}>
          <Text style={styles.reasoningText}>{current.holePlan.reasoning}</Text>
        </View>
      </View>

      {/* Invisible swipe strip — FlatList handles page detection only */}
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.swipeStrip}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        renderItem={() => <View style={{ width }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1923',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0f1923',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    color: '#ccc',
    fontSize: 18,
  },
  backButton: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#f0f0f0',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f1923',
    borderBottomWidth: 1,
    borderBottomColor: '#16213e',
  },
  headerBack: {
    padding: 4,
  },
  headerBackText: {
    color: '#f0f0f0',
    fontSize: 22,
  },
  headerTitle: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
  },
  headerSub: {
    color: '#666',
    fontSize: 12,
    marginTop: 1,
  },
  slideContent: {
    flex: 1,
    padding: 16,
  },
  holeHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 12,
  },
  holeNumber: {
    color: '#f0f0f0',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  holePar: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: '700',
  },
  holeDistance: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '600',
  },
  splitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  strategyCard: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  strategyRow: {
    gap: 2,
  },
  strategyLabel: {
    color: '#aaa',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  strategyValue: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  avoidText: {
    color: '#f87171',
  },
  divider: {
    height: 1,
    backgroundColor: '#2d2d4e',
  },
  reasoningCard: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  reasoningText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  swipeStrip: {
    height: 48,
    flexGrow: 0,
  },
});
