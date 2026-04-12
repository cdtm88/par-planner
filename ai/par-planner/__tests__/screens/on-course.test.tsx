import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OnCourseScreen from '../../app/on-course';
import { usePlanStore } from '../../src/store/planStore';
import { useCourseStore } from '../../src/store/courseStore';
import { GamePlan, Course } from '../../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'plan-001' })),
  router: { back: jest.fn() },
}));

import { router } from 'expo-router';
const mockBack = router.back as jest.Mock;

jest.mock('react-native-svg', () => {
  const React = require('react');
  const SvgComponent = ({ children }: { children: React.ReactNode }) =>
    React.createElement('Svg', null, children);
  return {
    __esModule: true,
    default: SvgComponent,
    Svg: SvgComponent,
    Polygon: () => null,
    Circle: () => null,
  };
});

const mockCourse: Course = {
  id: 'course-001',
  name: 'St Andrews Links',
  club: 'St Andrews Links',
  location: 'St Andrews, Scotland',
  lat: 56.34,
  lng: -2.80,
  tees: [
    {
      name: 'White',
      holes: [
        {
          number: 1,
          par: 4,
          distanceYards: 376,
          strokeIndex: 11,
          geodata: {
            teeBox: { lat: 56.340, lng: -2.800 },
            fairwayPolygon: [
              { lat: 56.341, lng: -2.801 },
              { lat: 56.341, lng: -2.799 },
              { lat: 56.342, lng: -2.800 },
            ],
            greenPolygon: [
              { lat: 56.343, lng: -2.801 },
              { lat: 56.343, lng: -2.799 },
            ],
            hazards: [],
          },
        },
        {
          number: 2,
          par: 4,
          distanceYards: 411,
          strokeIndex: 3,
          geodata: null,
        },
      ],
    },
  ],
};

const mockPlan: GamePlan = {
  id: 'plan-001',
  courseId: 'course-001',
  courseName: 'St Andrews Links',
  tee: 'White',
  createdAt: '2026-04-10T10:00:00.000Z',
  complete: true,
  holes: [
    {
      holeNumber: 1,
      teeClub: 'Driver',
      target: 'Centre fairway, short of bunker',
      avoid: 'Swilcan Bunker right at 220 yds',
      reasoning: 'Your draw tracks centre-left naturally.',
      confirmed: true,
    },
    {
      holeNumber: 2,
      teeClub: '3 Wood',
      target: 'Left side of fairway',
      avoid: 'Swilcan Burn short of the green',
      reasoning: 'A 3 Wood leaves a full approach.',
      confirmed: true,
    },
  ],
};

describe('OnCourseScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    usePlanStore.setState({ plans: [mockPlan] });
    useCourseStore.setState({ courses: { 'course-001': mockCourse } });
  });

  it('shows hole 1 by default with correct header info', () => {
    const { getByText } = render(<OnCourseScreen />);
    expect(getByText('HOLE 1')).toBeTruthy();
    expect(getByText('PAR 4')).toBeTruthy();
    expect(getByText('376 YDS')).toBeTruthy();
  });

  it('shows the AI strategy for hole 1', () => {
    const { getByText } = render(<OnCourseScreen />);
    expect(getByText('Driver')).toBeTruthy();
    expect(getByText('Centre fairway, short of bunker')).toBeTruthy();
    expect(getByText('Swilcan Bunker right at 220 yds')).toBeTruthy();
  });

  it('shows course name in subheader', () => {
    const { getByText } = render(<OnCourseScreen />);
    expect(getByText('St Andrews Links · White')).toBeTruthy();
  });

  it('shows error state when plan id is not found', () => {
    const { useLocalSearchParams } = require('expo-router');
    useLocalSearchParams.mockReturnValueOnce({ id: 'nonexistent' });
    const { getByText } = render(<OnCourseScreen />);
    expect(getByText('Plan not found')).toBeTruthy();
  });

  it('back button calls router.back', () => {
    const { getByText } = render(<OnCourseScreen />);
    fireEvent.press(getByText('←'));
    expect(mockBack).toHaveBeenCalled();
  });
});
