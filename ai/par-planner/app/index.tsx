import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useProfileStore } from '../src/store/profileStore';
import { usePlanStore } from '../src/store/planStore';
import { GamePlan } from '../src/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

      {plans.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>YOUR PLANS</Text>
          <FlatList
            data={plans}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: GamePlan }) => (
              <Pressable
                style={styles.planRow}
                testID={`plan-row-${item.id}`}
                onPress={() =>
                  router.push({ pathname: '/on-course', params: { id: item.id } })
                }
              >
                <View style={styles.planRowLeft}>
                  <Text style={styles.planName}>{item.courseName}</Text>
                  <Text style={styles.planMeta}>
                    {item.tee} · {formatDate(item.createdAt)}
                  </Text>
                </View>
                <Text style={styles.planArrow}>→</Text>
              </Pressable>
            )}
            style={styles.list}
          />
        </>
      )}

      {plans.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No rounds planned yet</Text>
          <Text style={styles.emptySubtitle}>
            Search for a course to create your first game plan
          </Text>
        </View>
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
  sectionLabel: {
    color: '#666',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  planRow: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d2d4e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planRowLeft: {
    gap: 2,
  },
  planName: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '600',
  },
  planMeta: {
    color: '#ccc',
    fontSize: 13,
  },
  planArrow: {
    color: '#22c55e',
    fontSize: 18,
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
