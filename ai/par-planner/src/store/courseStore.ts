import { create } from 'zustand';
import { Course } from '../types';

interface CourseStore {
  courses: Record<string, Course>;
}

export const useCourseStore = create<CourseStore>()(() => ({
  courses: {},
}));
