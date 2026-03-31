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
