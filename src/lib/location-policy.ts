import type { FarmPlot } from './farm-types';
import { distanceMeters, type Coordinates } from './geofence';

export const LOCATION_MAX_AGE_MS = 60_000;
export const LOCATION_MAX_ACCURACY_M = 200;

export type LocationReading = Coordinates & {
  accuracyM: number | null;
  timestamp: number;
};

export type LocationReadingIssue =
  | 'invalid-coordinates'
  | 'missing-accuracy'
  | 'low-accuracy'
  | 'stale';

export function isCoordinateInBounds(coords: Coordinates): boolean {
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

export function accuracyLimitForRadius(radiusM: number): number {
  return Math.min(radiusM / 2, LOCATION_MAX_ACCURACY_M);
}

export function validateLocationReading(
  reading: LocationReading,
  radiusM: number,
  now = Date.now()
): LocationReadingIssue | null {
  if (!isCoordinateInBounds(reading)) return 'invalid-coordinates';
  if (reading.accuracyM === null) return 'missing-accuracy';
  if (now - reading.timestamp > LOCATION_MAX_AGE_MS) return 'stale';
  if (reading.accuracyM > accuracyLimitForRadius(radiusM)) return 'low-accuracy';
  return null;
}

export function findNearestActivePlot(
  plots: FarmPlot[],
  user: Coordinates
): { plot: FarmPlot; distanceM: number } | null {
  return (
    plots
      .filter((plot) => plot.status === 'aktif')
      .map((plot) => ({
        plot,
        distanceM: distanceMeters(user, {
          latitude: plot.latCenter,
          longitude: plot.lngCenter,
        }),
      }))
      .sort((a, b) => a.distanceM - b.distanceM)[0] ?? null
  );
}
