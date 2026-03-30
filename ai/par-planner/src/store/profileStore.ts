import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProfile, ShotTendency } from '../types';
import { DEFAULT_BAG } from '../constants/clubs';

interface ProfileStore {
  profile: PlayerProfile;
  toggleClub: (clubId: string) => void;
  setCarryDistance: (clubId: string, yards: number) => void;
  setShotTendency: (tendency: ShotTendency) => void;
  setHandicap: (handicap: number | null) => void;
  completeOnboarding: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: {
        handicap: null,
        shotTendency: 'straight',
        bag: DEFAULT_BAG,
        hasCompletedOnboarding: false,
      },
      toggleClub: (clubId) =>
        set((state) => ({
          profile: {
            ...state.profile,
            bag: state.profile.bag.map((c) =>
              c.id === clubId ? { ...c, selected: !c.selected } : c
            ),
          },
        })),
      setCarryDistance: (clubId, yards) =>
        set((state) => ({
          profile: {
            ...state.profile,
            bag: state.profile.bag.map((c) =>
              c.id === clubId ? { ...c, carryYards: yards } : c
            ),
          },
        })),
      setShotTendency: (tendency) =>
        set((state) => ({
          profile: { ...state.profile, shotTendency: tendency },
        })),
      setHandicap: (handicap) =>
        set((state) => ({
          profile: { ...state.profile, handicap },
        })),
      completeOnboarding: () =>
        set((state) => ({
          profile: { ...state.profile, hasCompletedOnboarding: true },
        })),
    }),
    {
      name: 'player-profile',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
