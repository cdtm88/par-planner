import React from 'react';
import { render } from '@testing-library/react-native';
import { HoleMap, projectCoords } from '../../src/components/HoleMap';
import { HoleGeodata } from '../../src/types';

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

const sampleGeodata: HoleGeodata = {
  teeBox: { lat: 56.340, lng: -2.800 },
  fairwayPolygon: [
    { lat: 56.341, lng: -2.801 },
    { lat: 56.341, lng: -2.799 },
    { lat: 56.342, lng: -2.800 },
  ],
  greenPolygon: [
    { lat: 56.343, lng: -2.801 },
    { lat: 56.343, lng: -2.799 },
    { lat: 56.344, lng: -2.800 },
  ],
  hazards: [
    { type: 'bunker', label: 'Swilcan Bunker', polygon: [{ lat: 56.3415, lng: -2.800 }] },
    { type: 'water', polygon: [{ lat: 56.342, lng: -2.802 }, { lat: 56.342, lng: -2.803 }] },
  ],
};

describe('HoleMap', () => {
  it('renders without crashing with valid geodata', () => {
    const { toJSON } = render(<HoleMap geodata={sampleGeodata} width={200} height={300} />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders placeholder text when geodata is null', () => {
    const { getByText } = render(<HoleMap geodata={null} width={200} height={300} />);
    expect(getByText('No map data')).toBeTruthy();
  });

  it('renders placeholder text when geodata has no usable coordinates', () => {
    const emptyGeodata: HoleGeodata = {
      teeBox: { lat: 56.340, lng: -2.800 },
      fairwayPolygon: null,
      greenPolygon: [],
      hazards: [],
    };
    // Should still render (tee box alone is enough to display)
    const { toJSON } = render(<HoleMap geodata={emptyGeodata} width={200} height={300} />);
    expect(toJSON()).not.toBeNull();
  });
});

describe('projectCoords', () => {
  const bounds = { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };

  it('maps top-left geo coord to top-left screen coord (with padding)', () => {
    const result = projectCoords([{ lat: 1, lng: 0 }], bounds, 100, 100, 0);
    // lat=1 (max) → y=0 (top); lng=0 (min) → x=0 (left)
    expect(result[0].x).toBeCloseTo(0);
    expect(result[0].y).toBeCloseTo(0);
  });

  it('maps bottom-right geo coord to bottom-right screen coord (with padding)', () => {
    const result = projectCoords([{ lat: 0, lng: 1 }], bounds, 100, 100, 0);
    // lat=0 (min) → y=100 (bottom); lng=1 (max) → x=100 (right)
    expect(result[0].x).toBeCloseTo(100);
    expect(result[0].y).toBeCloseTo(100);
  });

  it('flips Y axis: higher latitude maps to lower y (top of screen)', () => {
    const result = projectCoords(
      [{ lat: 0.8, lng: 0.5 }, { lat: 0.2, lng: 0.5 }],
      bounds,
      100,
      100,
      0
    );
    expect(result[0].y).toBeLessThan(result[1].y);
  });

  it('applies padding so coords stay within padded viewport', () => {
    const padding = 0.1;
    const result = projectCoords([{ lat: 1, lng: 0 }], bounds, 100, 100, padding);
    expect(result[0].x).toBeCloseTo(10); // 10% padding
    expect(result[0].y).toBeCloseTo(10); // 10% padding
  });

  it('returns empty array for empty input', () => {
    expect(projectCoords([], bounds, 100, 100)).toEqual([]);
  });
});
