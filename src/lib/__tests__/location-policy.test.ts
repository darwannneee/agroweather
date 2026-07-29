import type { FarmPlot } from '../farm-types';
import {
  accuracyLimitForRadius,
  findNearestActivePlot,
  isCoordinateInBounds,
  validateLocationReading,
} from '../location-policy';

const basePlot: FarmPlot = {
  id: 'plot-a',
  namaLahan: 'Sawah A',
  farmerId: 'farmer-1',
  farmerName: 'Budi',
  luasHektar: 1,
  jenisTanaman: 'Padi',
  faseLahan: 'Tanam',
  latCenter: -7.25,
  lngCenter: 112.76,
  radiusGeofenceM: 1000,
  status: 'aktif',
};

describe('location policy', () => {
  test.each([
    [-90, -180],
    [0, 0],
    [90, 180],
  ])('accepts bounded coordinate %p, %p', (latitude, longitude) => {
    expect(isCoordinateInBounds({ latitude, longitude })).toBe(true);
  });

  test.each([
    [-90.01, 0],
    [90.01, 0],
    [0, -180.01],
    [0, 180.01],
    [Number.NaN, 0],
  ])('rejects invalid coordinate %p, %p', (latitude, longitude) => {
    expect(isCoordinateInBounds({ latitude, longitude })).toBe(false);
  });

  test('caps accepted accuracy at 200 meters', () => {
    expect(accuracyLimitForRadius(1000)).toBe(200);
    expect(accuracyLimitForRadius(100)).toBe(50);
  });

  test('rejects missing, stale, and imprecise readings', () => {
    const now = 1_000_000;
    expect(
      validateLocationReading(
        { latitude: -7.25, longitude: 112.76, accuracyM: null, timestamp: now },
        1000,
        now
      )
    ).toBe('missing-accuracy');
    expect(
      validateLocationReading(
        { latitude: -7.25, longitude: 112.76, accuracyM: 20, timestamp: now - 60_001 },
        1000,
        now
      )
    ).toBe('stale');
    expect(
      validateLocationReading(
        { latitude: -7.25, longitude: 112.76, accuracyM: 250, timestamp: now },
        1000,
        now
      )
    ).toBe('low-accuracy');
  });

  test('finds the nearest active plot and ignores inactive plots', () => {
    const nearest = findNearestActivePlot(
      [
        { ...basePlot, id: 'inactive', latCenter: -7.25, status: 'tidak aktif' },
        { ...basePlot, id: 'far', latCenter: -7.35 },
        { ...basePlot, id: 'near', latCenter: -7.251 },
      ],
      { latitude: -7.25, longitude: 112.76 }
    );

    expect(nearest?.plot.id).toBe('near');
    expect(nearest?.distanceM).toBeLessThan(200);
  });
});
