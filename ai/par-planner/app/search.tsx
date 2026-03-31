import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useCourseStore } from '../src/store/courseStore';
import { CourseSearchResult, Course } from '../src/types';

export default function SearchScreen() {
  const { searchResults, isSearching, searchError, searchCourses, fetchAndCacheCourse } =
    useCourseStore();

  const [query, setQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  async function handleSearch() {
    if (query.trim().length < 2) return;
    await searchCourses(query.trim());
  }

  async function handleSelectCourse(result: CourseSearchResult) {
    setIsFetching(true);
    try {
      const course = await fetchAndCacheCourse(result.id);
      setSelectedCourse(course);
    } catch {
      // Error handled by store
    } finally {
      setIsFetching(false);
    }
  }

  function handleSelectTee(teeName: string) {
    if (!selectedCourse) return;
    const courseId = selectedCourse.id;
    setSelectedCourse(null);
    // Navigate to planner — Plan 3 will implement this screen
    router.push({
      pathname: '/planner',
      params: { courseId, tee: teeName },
    });
  }

  return (
    <View style={styles.container}>
      {/* Search input */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Course name or location..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
        />
        <Pressable style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>

      {/* Loading / error states */}
      {isSearching && (
        <ActivityIndicator style={styles.spinner} color="#22c55e" />
      )}
      {searchError && (
        <Text style={styles.errorText}>{searchError}</Text>
      )}

      {/* Results list */}
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.result}
            onPress={() => handleSelectCourse(item)}
          >
            <Text style={styles.resultName}>{item.name}</Text>
            <Text style={styles.resultSub}>{item.club} · {item.location}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !isSearching && searchResults.length === 0 && query.length > 0 ? (
            <Text style={styles.emptyText}>No courses found</Text>
          ) : null
        }
      />

      {/* Fetching overlay */}
      {isFetching && (
        <View style={styles.fetchingOverlay}>
          <ActivityIndicator color="#22c55e" size="large" />
          <Text style={styles.fetchingText}>Loading course data...</Text>
        </View>
      )}

      {/* Tee selection modal */}
      <Modal
        visible={!!selectedCourse}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCourse(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Your Tee</Text>
            <Text style={styles.modalSubtitle}>
              {selectedCourse?.name}
            </Text>
            {selectedCourse?.tees.map((tee) => (
              <Pressable
                key={tee.name}
                style={styles.teeOption}
                onPress={() => handleSelectTee(tee.name)}
              >
                <Text style={styles.teeName}>{tee.name}</Text>
                <Text style={styles.teeDistance}>
                  {tee.holes.reduce((sum, h) => sum + h.distanceYards, 0)} yds
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.cancelButton}
              onPress={() => setSelectedCourse(null)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1923',
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a3a5c',
    color: '#f0f0f0',
    padding: 12,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  spinner: {
    marginTop: 20,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  result: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d2d4e',
  },
  resultName: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  resultSub: {
    color: '#ccc',
    fontSize: 13,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  fetchingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,25,35,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  fetchingText: {
    color: '#ccc',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#16213e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: '#f0f0f0',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 20,
  },
  teeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f1923',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d2d4e',
  },
  teeName: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '600',
  },
  teeDistance: {
    color: '#ccc',
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#666',
    fontSize: 14,
  },
});
