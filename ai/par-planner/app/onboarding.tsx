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
