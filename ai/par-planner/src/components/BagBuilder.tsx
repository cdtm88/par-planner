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
