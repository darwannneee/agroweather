import * as Location from 'expo-location';

import { requestCurrentLocation } from '../location';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  PermissionStatus: {
    DENIED: 'denied',
    GRANTED: 'granted',
    UNDETERMINED: 'undetermined',
  },
  getCurrentPositionAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

const mockedLocation = jest.mocked(Location);

describe('requestCurrentLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLocation.hasServicesEnabledAsync.mockResolvedValue(true);
  });

  test('requests permission only when the existing permission is not granted', async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      status: Location.PermissionStatus.UNDETERMINED,
      canAskAgain: true,
      expires: 'never',
    });
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      status: Location.PermissionStatus.GRANTED,
      canAskAgain: true,
      expires: 'never',
    });
    mockedLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: -7.25,
        longitude: 112.76,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1_000,
    });

    await expect(requestCurrentLocation()).resolves.toMatchObject({
      status: 'granted',
      coords: { latitude: -7.25, longitude: 112.76 },
      accuracyM: 12,
      timestamp: 1_000,
    });
    expect(mockedLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  test('returns permission-blocked without requesting again', async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      status: Location.PermissionStatus.DENIED,
      canAskAgain: false,
      expires: 'never',
    });

    await expect(requestCurrentLocation()).resolves.toMatchObject({
      status: 'permission-blocked',
      canOpenSettings: true,
    });
    expect(mockedLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  test('returns services-disabled before asking permission', async () => {
    mockedLocation.hasServicesEnabledAsync.mockResolvedValue(false);

    await expect(requestCurrentLocation()).resolves.toMatchObject({
      status: 'services-disabled',
    });
    expect(mockedLocation.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  test('returns low-accuracy when a maximum is provided', async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      status: Location.PermissionStatus.GRANTED,
      canAskAgain: true,
      expires: 'never',
    });
    mockedLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: -7.25,
        longitude: 112.76,
        accuracy: 250,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });

    await expect(requestCurrentLocation({ maxAccuracyM: 200 })).resolves.toMatchObject({
      status: 'low-accuracy',
      accuracyM: 250,
    });
  });
});
