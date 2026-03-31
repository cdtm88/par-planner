export type ShotTendency =
  | 'straight'
  | 'slight-fade'
  | 'fade'
  | 'slice'
  | 'slight-draw'
  | 'draw'
  | 'hook';

export interface Club {
  id: string;        // e.g. 'driver', '7i', 'sw'
  name: string;      // e.g. 'Driver', '7 Iron', 'Sand Wedge'
  carryYards: number | null;
  selected: boolean;
}

export interface CourseSearchResult {
  id: string;
  name: string;
  club: string;
  location: string;
}

export interface PlayerProfile {
  handicap: number | null;
  shotTendency: ShotTendency;
  bag: Club[];
  hasCompletedOnboarding: boolean;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Hazard {
  type: 'bunker' | 'water' | 'ob';
  polygon: Coordinate[];
  label?: string;
}

export interface HoleGeodata {
  fairwayPolygon: Coordinate[] | null;
  greenPolygon: Coordinate[];
  teeBox: Coordinate;
  hazards: Hazard[];
}

export interface Hole {
  number: number;
  par: number;
  distanceYards: number;
  strokeIndex: number;
  geodata: HoleGeodata | null;
}

export interface Tee {
  name: string;  // e.g. 'Yellow', 'White', 'Red'
  holes: Hole[];
}

export interface Course {
  id: string;
  name: string;
  club: string;
  location: string;
  lat: number;
  lng: number;
  tees: Tee[];
}

export interface HolePlan {
  holeNumber: number;
  teeClub: string;
  target: string;
  avoid: string;
  reasoning: string;
  confirmed: boolean;
}

export interface GamePlan {
  id: string;
  courseId: string;
  courseName: string;
  tee: string;
  createdAt: string;
  holes: HolePlan[];
  complete: boolean;
}
