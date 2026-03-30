import { act, renderHook } from '@testing-library/react-native';
import { useProfileStore } from '../../src/store/profileStore';
import { DEFAULT_BAG } from '../../src/constants/clubs';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.setState({
      profile: {
        handicap: null,
        shotTendency: 'straight',
        bag: DEFAULT_BAG,
        hasCompletedOnboarding: false,
      },
    });
  });

  it('starts with default bag', () => {
    const { result } = renderHook(() => useProfileStore());
    expect(result.current.profile.bag).toEqual(DEFAULT_BAG);
  });

  it('toggles a club on and off', async () => {
    const { result } = renderHook(() => useProfileStore());
    const driverId = 'driver';

    await act(async () => result.current.toggleClub(driverId));
    expect(result.current.profile.bag.find(c => c.id === driverId)?.selected).toBe(false);

    await act(async () => result.current.toggleClub(driverId));
    expect(result.current.profile.bag.find(c => c.id === driverId)?.selected).toBe(true);
  });

  it('sets carry distance for a club', async () => {
    const { result } = renderHook(() => useProfileStore());

    await act(async () => result.current.setCarryDistance('7i', 150));
    expect(result.current.profile.bag.find(c => c.id === '7i')?.carryYards).toBe(150);
  });

  it('sets shot tendency', async () => {
    const { result } = renderHook(() => useProfileStore());

    await act(async () => result.current.setShotTendency('slice'));
    expect(result.current.profile.shotTendency).toBe('slice');
  });

  it('sets handicap', async () => {
    const { result } = renderHook(() => useProfileStore());

    await act(async () => result.current.setHandicap(14));
    expect(result.current.profile.handicap).toBe(14);
  });

  it('marks onboarding complete', async () => {
    const { result } = renderHook(() => useProfileStore());

    await act(async () => result.current.completeOnboarding());
    expect(result.current.profile.hasCompletedOnboarding).toBe(true);
  });
});
