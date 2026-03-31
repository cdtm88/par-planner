import { Course, CourseSearchResult } from '../types';

// Fixture imports — used when no API key is configured
const searchFixture: CourseSearchResult[] = require('../../fixtures/search-sample.json');
const courseFixture: Course = require('../../fixtures/course-sample.json');

function isFixtureMode(): boolean {
  return !process.env.EXPO_PUBLIC_MAPS4GOLF_API_KEY;
}

/**
 * Search for courses by name or location.
 * Returns lightweight results for display in search list.
 *
 * Production: GET https://api.maps4golf.com/v1/courses/search?q={query}&api_key={key}
 * The response shape will need a transformer here once API credentials are obtained.
 */
export async function searchCourses(query: string): Promise<CourseSearchResult[]> {
  if (isFixtureMode()) {
    // Simulate network delay in dev
    await new Promise((r) => setTimeout(r, 300));
    const q = query.toLowerCase();
    return searchFixture.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.club.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
    );
  }

  const key = process.env.EXPO_PUBLIC_MAPS4GOLF_API_KEY;
  const res = await fetch(
    `https://api.maps4golf.com/v1/courses/search?q=${encodeURIComponent(query)}&api_key=${key}`
  );
  if (!res.ok) throw new Error(`Maps4Golf search failed: ${res.status}`);
  const data = await res.json();
  // TODO: transform Maps4Golf response shape to CourseSearchResult[] once API docs obtained
  return data as CourseSearchResult[];
}

/**
 * Fetch full course data including all holes and geodata for a given course ID.
 * This is called once per course and the result is cached permanently on-device.
 *
 * Production: GET https://api.maps4golf.com/v1/courses/{id}?api_key={key}
 */
export async function fetchCourse(courseId: string): Promise<Course> {
  if (isFixtureMode()) {
    await new Promise((r) => setTimeout(r, 500));
    if (courseId !== courseFixture.id) {
      throw new Error(`Fixture course not found: ${courseId}`);
    }
    return courseFixture;
  }

  const key = process.env.EXPO_PUBLIC_MAPS4GOLF_API_KEY;
  const res = await fetch(
    `https://api.maps4golf.com/v1/courses/${courseId}?api_key=${key}`
  );
  if (!res.ok) throw new Error(`Maps4Golf fetch failed: ${res.status}`);
  const data = await res.json();
  // TODO: transform Maps4Golf response shape to Course once API docs obtained
  return data as Course;
}
