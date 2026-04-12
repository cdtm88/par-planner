import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Circle } from 'react-native-svg';
import { Coordinate, HoleGeodata } from '../types';

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Project an array of lat/lng coordinates into screen-space pixels.
 * Y axis is flipped: higher latitude → lower y (top of screen).
 * padding is a fraction of width/height added on each edge (default 10%).
 */
export function projectCoords(
  coords: Coordinate[],
  bounds: Bounds,
  width: number,
  height: number,
  padding = 0.1
): { x: number; y: number }[] {
  if (coords.length === 0) return [];
  const padW = width * padding;
  const padH = height * padding;
  const usableW = width - 2 * padW;
  const usableH = height - 2 * padH;
  const latRange = bounds.maxLat - bounds.minLat || 0.001;
  const lngRange = bounds.maxLng - bounds.minLng || 0.001;
  return coords.map(({ lat, lng }) => ({
    x: padW + ((lng - bounds.minLng) / lngRange) * usableW,
    y: padH + (1 - (lat - bounds.minLat) / latRange) * usableH,
  }));
}

function computeBounds(geodata: HoleGeodata): Bounds {
  const all: Coordinate[] = [
    geodata.teeBox,
    ...(geodata.fairwayPolygon ?? []),
    ...geodata.greenPolygon,
    ...geodata.hazards.flatMap((h) => h.polygon),
  ];
  const lats = all.map((c) => c.lat);
  const lngs = all.map((c) => c.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function toSvgPoints(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

interface HoleMapProps {
  geodata: HoleGeodata | null;
  width: number;
  height: number;
}

export function HoleMap({ geodata, width, height }: HoleMapProps) {
  if (!geodata) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <Text style={styles.placeholderText}>No map data</Text>
      </View>
    );
  }

  const bounds = computeBounds(geodata);
  const project = (coords: Coordinate[]) =>
    projectCoords(coords, bounds, width, height);

  const fairwayPts = geodata.fairwayPolygon
    ? toSvgPoints(project(geodata.fairwayPolygon))
    : null;
  const greenPts =
    geodata.greenPolygon.length > 0
      ? toSvgPoints(project(geodata.greenPolygon))
      : null;
  const tee = project([geodata.teeBox])[0];

  return (
    <Svg width={width} height={height}>
      {/* Fairway */}
      {fairwayPts && (
        <Polygon points={fairwayPts} fill="#4a7c59" opacity={0.7} />
      )}

      {/* Hazards */}
      {geodata.hazards.map((hazard, i) => {
        if (hazard.polygon.length < 2) return null;
        const fill =
          hazard.type === 'water'
            ? '#3b82f6'
            : hazard.type === 'ob'
            ? 'none'
            : '#d4a843';
        const stroke = hazard.type === 'ob' ? '#ef4444' : 'none';
        return (
          <Polygon
            key={i}
            points={toSvgPoints(project(hazard.polygon))}
            fill={fill}
            stroke={stroke}
            strokeWidth={hazard.type === 'ob' ? 2 : 0}
            opacity={0.8}
          />
        );
      })}

      {/* Green */}
      {greenPts && (
        <Polygon points={greenPts} fill="#22c55e" opacity={0.9} />
      )}

      {/* Tee box */}
      <Circle cx={tee.x} cy={tee.y} r={5} fill="#f0f0f0" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#16213e',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  placeholderText: {
    color: '#555',
    fontSize: 13,
  },
});
