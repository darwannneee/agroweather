export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type GeofenceStatus = 'inside' | 'outside' | 'missing-location';

export type GeofenceResult = {
  status: GeofenceStatus;
  unlocked: boolean;
  distanceM: number | null;
};

const EARTH_RADIUS_M = 6371000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  if (a.latitude === b.latitude && a.longitude === b.longitude) return 0;

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function evaluateGeofence(input: {
  user: Coordinates | null;
  plot: Coordinates & { radiusMeters: number };
}): GeofenceResult {
  if (!input.user) {
    return { status: 'missing-location', unlocked: false, distanceM: null };
  }

  const distanceM = distanceMeters(input.user, input.plot);
  if (distanceM <= input.plot.radiusMeters) {
    return { status: 'inside', unlocked: true, distanceM };
  }

  return { status: 'outside', unlocked: false, distanceM };
}
