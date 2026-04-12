import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../../app/index';
import { useProfileStore } from '../../src/store/profileStore';
import { usePlanStore } from '../../src/store/planStore';
import { router } from 'expo-router';
import { GamePlan } from '../../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const mockPush = router.push as jest.Mock;

const completedPlan: GamePlan = {
  id: 'plan-001',
  courseId: 'course-001',
  courseName: 'St Andrews Links',
  tee: 'White',
  createdAt: '2026-04-10T10:00:00.000Z',
  complete: true,
  holes: [],
};

describe('HomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    useProfileStore.setState({
      profile: {
        handicap: null,
        shotTendency: 'straight',
        bag: [],
        hasCompletedOnboarding: true,
      },
    });
    usePlanStore.setState({ plans: [] });
  });

  it('shows empty state when there are no plans', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('No rounds planned yet')).toBeTruthy();
  });

  it('renders a saved plan row with course name and tee', () => {
    usePlanStore.setState({ plans: [completedPlan] });
    const { getByText } = render(<HomeScreen />);
    expect(getByText('St Andrews Links')).toBeTruthy();
    expect(getByText('White · Apr 10')).toBeTruthy();
  });

  it('navigates to on-course screen when a plan row is tapped', () => {
    usePlanStore.setState({ plans: [completedPlan] });
    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('St Andrews Links'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/on-course',
      params: { id: 'plan-001' },
    });
  });

  it('navigates to search when Plan New Round is tapped', () => {
    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Plan New Round'));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });
});
