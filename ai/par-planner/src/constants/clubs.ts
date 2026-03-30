import { Club } from '../types';

// Default bag — pre-selected when user first opens the app
export const DEFAULT_BAG: Club[] = [
  { id: 'driver', name: 'Driver', carryYards: null, selected: true },
  { id: '3w', name: '3 Wood', carryYards: null, selected: true },
  { id: '5w', name: '5 Wood', carryYards: null, selected: false },
  { id: '4i', name: '4 Iron', carryYards: null, selected: false },
  { id: '5i', name: '5 Iron', carryYards: null, selected: true },
  { id: '6i', name: '6 Iron', carryYards: null, selected: true },
  { id: '7i', name: '7 Iron', carryYards: null, selected: true },
  { id: '8i', name: '8 Iron', carryYards: null, selected: true },
  { id: '9i', name: '9 Iron', carryYards: null, selected: true },
  { id: 'pw', name: 'Pitching Wedge', carryYards: null, selected: true },
  { id: 'gw', name: 'Gap Wedge', carryYards: null, selected: false },
  { id: 'sw', name: 'Sand Wedge', carryYards: null, selected: true },
  { id: 'lw', name: 'Lob Wedge', carryYards: null, selected: false },
  { id: 'putter', name: 'Putter', carryYards: null, selected: true },
];

// Additional clubs available to add
export const EXTRA_CLUBS: Club[] = [
  { id: '2i', name: '2 Iron', carryYards: null, selected: false },
  { id: '3i', name: '3 Iron', carryYards: null, selected: false },
  { id: '2h', name: '2 Hybrid', carryYards: null, selected: false },
  { id: '3h', name: '3 Hybrid', carryYards: null, selected: false },
  { id: '4h', name: '4 Hybrid', carryYards: null, selected: false },
  { id: '7w', name: '7 Wood', carryYards: null, selected: false },
  { id: '60w', name: '60° Wedge', carryYards: null, selected: false },
  { id: 'chipper', name: 'Chipper', carryYards: null, selected: false },
];

export const ALL_CLUBS: Club[] = [...DEFAULT_BAG, ...EXTRA_CLUBS];

export const TENDENCY_LABELS: Record<string, string> = {
  straight: 'Straight',
  'slight-fade': 'Slight Fade',
  fade: 'Fade',
  slice: 'Slice',
  'slight-draw': 'Slight Draw',
  draw: 'Draw',
  hook: 'Hook',
};
