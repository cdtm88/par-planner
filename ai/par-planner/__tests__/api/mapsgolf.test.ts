// Force fixture mode for all tests
process.env.EXPO_PUBLIC_MAPS4GOLF_API_KEY = '';

import { searchCourses, fetchCourse } from '../../src/api/mapsgolf';

describe('mapsgolf (fixture mode)', () => {
  it('searchCourses returns an array of CourseSearchResult', async () => {
    const results = await searchCourses('st andrews');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      club: expect.any(String),
      location: expect.any(String),
    });
  });

  it('fetchCourse returns a Course with tees and holes', async () => {
    const course = await fetchCourse('fixture-course-001');
    expect(course.id).toBe('fixture-course-001');
    expect(course.tees.length).toBeGreaterThan(0);
    expect(course.tees[0].holes.length).toBeGreaterThan(0);
  });

  it('fetchCourse hole has required fields', async () => {
    const course = await fetchCourse('fixture-course-001');
    const hole = course.tees[0].holes[0];
    expect(hole.number).toBe(1);
    expect(typeof hole.par).toBe('number');
    expect(typeof hole.distanceYards).toBe('number');
  });
});
