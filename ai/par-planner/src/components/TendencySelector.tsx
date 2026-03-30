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
