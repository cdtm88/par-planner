import { create } from 'zustand';
import { GamePlan } from '../types';

interface PlanStore {
  plans: GamePlan[];
}

export const usePlanStore = create<PlanStore>()(() => ({
  plans: [],
}));
