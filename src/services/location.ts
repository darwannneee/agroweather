import * as Location from 'expo-location';

import type { Coordinates } from '@/lib/geofence';

export type CurrentLocationResult =
  | { status: 'granted'; coords: Coordinates; message: null }
  | { status: 'denied' | 'unavailable'; coords: null; message: string };

export async function requestCurrentLocation(): Promise<CurrentLocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return {
      status: 'denied',
      coords: null,
      message: 'Izin lokasi dibutuhkan untuk membuka task di sekitar lahan.',
    };
  }

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      status: 'granted',
      coords: {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      },
      message: null,
    };
  } catch {
    return {
      status: 'unavailable',
      coords: null,
      message: 'Lokasi tidak tersedia. Coba lagi beberapa saat.',
    };
  }
}
