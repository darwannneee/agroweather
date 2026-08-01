import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

import type { Coordinates } from '@/lib/geofence';

export type GrantedLocationResult = {
  status: 'granted';
  coords: Coordinates;
  accuracyM: number | null;
  timestamp: number;
  message: null;
  canOpenSettings: false;
};

export type CurrentLocationResult =
  | GrantedLocationResult
  | {
      status:
        | 'permission-denied'
        | 'permission-blocked'
        | 'services-disabled'
        | 'unavailable';
      coords: null;
      accuracyM: null;
      timestamp: null;
      message: string;
      canOpenSettings: boolean;
    }
  | {
      status: 'low-accuracy';
      coords: Coordinates;
      accuracyM: number | null;
      timestamp: number;
      message: string;
      canOpenSettings: false;
    };

type RequestCurrentLocationOptions = {
  maxAccuracyM?: number;
};

function failure(
  status: Exclude<CurrentLocationResult['status'], 'granted' | 'low-accuracy'>,
  message: string,
  canOpenSettings = false
): CurrentLocationResult {
  return {
    status,
    coords: null,
    accuracyM: null,
    timestamp: null,
    message,
    canOpenSettings,
  };
}

export async function requestCurrentLocation(
  options: RequestCurrentLocationOptions = {}
): Promise<CurrentLocationResult> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return failure(
        'services-disabled',
        'GPS perangkat belum aktif. Nyalakan layanan lokasi lalu coba lagi.',
        true
      );
    }

    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        return failure(
          'permission-blocked',
          'Izin lokasi diblokir. Aktifkan izin lokasi AgroWeather di Pengaturan.',
          true
        );
      }
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (!permission.granted) {
      return failure(
        permission.canAskAgain ? 'permission-denied' : 'permission-blocked',
        permission.canAskAgain
          ? 'Izin lokasi diperlukan untuk melanjutkan aksi ini.'
          : 'Izin lokasi diblokir. Aktifkan izin lokasi AgroWeather di Pengaturan.',
        !permission.canAskAgain
      );
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });
    const coords = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
    const accuracyM = current.coords.accuracy;

    if (
      options.maxAccuracyM !== undefined &&
      (accuracyM === null || accuracyM > options.maxAccuracyM)
    ) {
      return {
        status: 'low-accuracy',
        coords,
        accuracyM,
        timestamp: current.timestamp,
        message: 'Akurasi GPS belum cukup baik. Pindah ke area terbuka lalu periksa lagi.',
        canOpenSettings: false,
      };
    }

    return {
      status: 'granted',
      coords,
      accuracyM,
      timestamp: current.timestamp,
      message: null,
      canOpenSettings: false,
    };
  } catch {
    return failure(
      'unavailable',
      'Lokasi belum ditemukan. Coba lagi di area dengan sinyal GPS yang lebih baik.'
    );
  }
}

export async function openLocationSettings(
  status: CurrentLocationResult['status'] = 'permission-blocked'
): Promise<void> {
  if (status === 'services-disabled' && Platform.OS === 'android') {
    try {
      await Location.enableNetworkProviderAsync();
      return;
    } catch {
      // Fall through to app settings if the native recovery dialog is unavailable.
    }
  }
  await Linking.openSettings();
}
