import { distanceMeters, evaluateGeofence } from '../geofence';

describe('distanceMeters', () => {
  test('returns 0 for identical points', () => {
    expect(
      distanceMeters(
        { latitude: -7.250445, longitude: 112.768845 },
        { latitude: -7.250445, longitude: 112.768845 }
      )
    ).toBe(0);
  });

  test('returns about 111 meters for 0.001 latitude degrees', () => {
    const distance = distanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0.001, longitude: 0 }
    );
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });
});

describe('evaluateGeofence', () => {
  const plot = { latitude: -7.250445, longitude: 112.768845, radiusMeters: 1000 };

  test('unlocks inside radius', () => {
    expect(
      evaluateGeofence({
        user: { latitude: -7.2509, longitude: 112.769 },
        plot,
      })
    ).toMatchObject({ status: 'inside', unlocked: true });
  });

  test('locks outside radius', () => {
    expect(
      evaluateGeofence({
        user: { latitude: -7.270445, longitude: 112.768845 },
        plot,
      })
    ).toMatchObject({ status: 'outside', unlocked: false });
  });

  test('locks when location is missing', () => {
    expect(evaluateGeofence({ user: null, plot })).toEqual({
      status: 'missing-location',
      unlocked: false,
      distanceM: null,
    });
  });
});
