import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Course, CourseSearchResult } from '../types';
import { searchCourses as apiSearch, fetchCourse as apiFetch } from '../api/mapsgolf';

interface CourseStore {
  // Permanent cache of fully fetched courses (keyed by id)
  courses: Record<string, Course>;
  // Ephemeral search results (not persisted)
  searchResults: CourseSearchResult[];
  isSearching: boolean;
  searchError: string | null;
  // Actions
  searchCourses: (query: string) => Promise<void>;
  fetchAndCacheCourse: (courseId: string) => Promise<Course>;
}

export const useCourseStore = create<CourseStore>()(
  persist(
    (set, get) => ({
      courses: {},
      searchResults: [],
      isSearching: false,
      searchError: null,

      searchCourses: async (query) => {
        set({ isSearching: true, searchError: null });
        try {
          const results = await apiSearch(query);
          set({ searchResults: results, isSearching: false });
        } catch (e) {
          set({
            isSearching: false,
            searchError: e instanceof Error ? e.message : 'Search failed',
          });
        }
      },

      fetchAndCacheCourse: async (courseId) => {
        // Return from cache if available — no API call needed
        const cached = get().courses[courseId];
        if (cached) return cached;

        const course = await apiFetch(courseId);
        set((state) => ({
          courses: { ...state.courses, [courseId]: course },
        }));
        return course;
      },
    }),
    {
      name: 'course-cache',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the course cache, not ephemeral search state
      partialize: (state) => ({ courses: state.courses }),
    }
  )
);
