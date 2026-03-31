process.env.EXPO_PUBLIC_MAPS4GOLF_API_KEY = '';

import { act, renderHook } from '@testing-library/react-native';
import { useCourseStore } from '../../src/store/courseStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('courseStore', () => {
  beforeEach(() => {
    useCourseStore.setState({
      courses: {},
      searchResults: [],
      isSearching: false,
      searchError: null,
    });
  });

  it('starts with empty state', () => {
    const { result } = renderHook(() => useCourseStore());
    expect(result.current.courses).toEqual({});
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it('searchCourses sets isSearching then populates results', async () => {
    const { result } = renderHook(() => useCourseStore());

    await act(async () => {
      await result.current.searchCourses('st andrews');
    });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchResults.length).toBeGreaterThan(0);
    expect(result.current.searchResults[0].name).toBeDefined();
  });

  it('fetchAndCacheCourse stores course by id', async () => {
    const { result } = renderHook(() => useCourseStore());

    await act(async () => {
      await result.current.fetchAndCacheCourse('fixture-course-001');
    });

    expect(result.current.courses['fixture-course-001']).toBeDefined();
    expect(result.current.courses['fixture-course-001'].tees.length).toBeGreaterThan(0);
  });

  it('fetchAndCacheCourse returns cached course without re-fetching', async () => {
    const { result } = renderHook(() => useCourseStore());

    // Fetch once
    await act(async () => {
      await result.current.fetchAndCacheCourse('fixture-course-001');
    });

    const courseAfterFirst = result.current.courses['fixture-course-001'];

    // Fetch again — should be same object reference (from cache)
    await act(async () => {
      await result.current.fetchAndCacheCourse('fixture-course-001');
    });

    expect(result.current.courses['fixture-course-001']).toBe(courseAfterFirst);
  });
});
