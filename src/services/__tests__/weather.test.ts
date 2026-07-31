import type { SupabaseClient } from '@supabase/supabase-js';

import {
  fetchLatestWeatherForPlots,
  mapDashboardWeatherSnapshotRow,
} from '../weather';

jest.mock('../supabase', () => ({ supabase: {} }));

function query(result: Record<string, unknown>) {
  const value: any = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    then: (
      resolve: (result: Record<string, unknown>) => unknown,
      reject: (error: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  value.in.mockReturnValue(value);
  value.order.mockReturnValue(value);
  value.limit.mockReturnValue(value);
  return value;
}

const snapshot = {
  lahan_id: 'plot-1',
  observed_at: '2026-07-30T00:00:00.000Z',
  current_data: {
    description: 'hujan ringan',
    temperatureC: 26.5,
    humidityPercent: 82,
    windSpeedMps: 0,
    rainMm: 0.4,
  },
  forecast_data: [
    {
      minTemperatureC: 25,
      maxTemperatureC: 30,
      rainProbability: 0.4,
    },
    {
      minTemperatureC: 24,
      maxTemperatureC: 31,
      rainProbability: 0.72,
    },
  ],
  lahan: { nama_lahan: 'Sawah Timur' },
};

test('maps current weather and upcoming forecast defensively', () => {
  expect(mapDashboardWeatherSnapshotRow(snapshot)).toEqual({
    plotId: 'plot-1',
    plotName: 'Sawah Timur',
    observedAt: '2026-07-30T00:00:00.000Z',
    description: 'hujan ringan',
    temperatureC: 26.5,
    humidityPercent: 82,
    windSpeedMps: 0,
    rainMm: 0.4,
    forecastMinTemperatureC: 24,
    forecastMaxTemperatureC: 31,
    forecastMaxRainProbability: 0.72,
  });
});

test('fetches only the latest snapshot for each requested plot', async () => {
  const plotOneWeather = query({
    data: [
      snapshot,
      {
        ...snapshot,
        observed_at: '2026-07-29T00:00:00.000Z',
        current_data: { ...snapshot.current_data, temperatureC: 25 },
      },
    ],
    error: null,
  });
  const plotTwoWeather = query({
    data: [
      {
        ...snapshot,
        lahan_id: 'plot-2',
        lahan: { nama_lahan: 'Sawah Barat' },
        current_data: { ...snapshot.current_data, temperatureC: 28 },
      },
    ],
    error: null,
  });
  const client = {
    from: jest.fn()
      .mockReturnValueOnce(plotOneWeather)
      .mockReturnValueOnce(plotTwoWeather),
  } as unknown as SupabaseClient;

  const result = await fetchLatestWeatherForPlots(['plot-1', 'plot-2'], client);

  expect(client.from).toHaveBeenCalledTimes(2);
  expect(plotOneWeather.eq).toHaveBeenCalledWith('lahan_id', 'plot-1');
  expect(plotTwoWeather.eq).toHaveBeenCalledWith('lahan_id', 'plot-2');
  expect(plotOneWeather.order).toHaveBeenCalledWith('observed_at', {
    ascending: false,
  });
  expect(plotOneWeather.limit).toHaveBeenCalledWith(1);
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({
    plotId: 'plot-1',
    temperatureC: 26.5,
  });
  expect(result[1]).toMatchObject({
    plotId: 'plot-2',
    temperatureC: 28,
  });
});
