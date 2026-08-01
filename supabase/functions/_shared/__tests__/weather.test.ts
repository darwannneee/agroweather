import { epochToJakartaDate, jakartaDate } from '../daily-date';
import {
  fetchOpenWeather,
  normalizeOpenWeather,
} from '../weather';

const currentPayload = {
  dt: 1785362400,
  main: { temp: 28, humidity: 80 },
  wind: { speed: 2.5 },
  weather: [{ id: 500, description: 'hujan ringan' }],
  rain: { '1h': 0.4 },
};

const forecastEntry = {
  dt: 1785396600,
  main: {
    temp: 28,
    temp_min: 27,
    temp_max: 29,
    humidity: 80,
  },
  wind: { speed: 2.5 },
  weather: [{ id: 500, description: 'hujan ringan' }],
  pop: 0.7,
  rain: { '3h': 1.2 },
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function nonJsonResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockRejectedValue(new SyntaxError('not json')),
  } as unknown as Response;
}

describe('Jakarta dates', () => {
  test('uses the Asia/Jakarta calendar boundary', () => {
    expect(jakartaDate(new Date('2026-07-29T17:00:00.000Z'))).toBe(
      '2026-07-30',
    );
    expect(epochToJakartaDate(1785362400)).toBe('2026-07-30');
  });
});

describe('normalizeOpenWeather', () => {
  test('keeps only forecast entries on the requested Jakarta date', () => {
    const result = normalizeOpenWeather({
      scheduledFor: '2026-07-30',
      current: currentPayload,
      forecast: {
        list: [
          forecastEntry,
          {
            ...forecastEntry,
            dt: 1785448800,
            weather: [{ id: 801, description: 'berawan' }],
          },
        ],
      },
    });

    expect(result).toMatchObject({
      observedAt: '2026-07-29T22:00:00.000Z',
      current: {
        temperatureC: 28,
        humidityPercent: 80,
        rainMm: 0.4,
      },
    });
    expect(result.forecast).toHaveLength(1);
    expect(result.forecast[0]).toMatchObject({
      timestamp: '2026-07-30T07:30:00.000Z',
      rainProbability: 0.7,
      rainMm: 1.2,
    });
  });

  test('bounds descriptions and one day of three-hour forecast output', () => {
    const longDescription = `  ${'x'.repeat(220)}  `;
    const result = normalizeOpenWeather({
      scheduledFor: '2026-07-30',
      current: {
        ...currentPayload,
        weather: [{ id: 800, description: longDescription }],
      },
      forecast: {
        list: Array.from({ length: 10 }, (_, index) => ({
          ...forecastEntry,
          dt: 1785344400 + index * 3 * 60 * 60,
          weather: [{ id: 800, description: longDescription }],
        })),
      },
    });

    expect(result.current.description).toHaveLength(160);
    expect(result.current.description.startsWith('x')).toBe(true);
    expect(result.forecast).toHaveLength(8);
    expect(result.forecast.every(({ description }) => description.length <= 160))
      .toBe(true);
  });

  test('rejects non-finite or out-of-range provider fields', () => {
    expect(() =>
      normalizeOpenWeather({
        scheduledFor: '2026-07-30',
        current: {
          ...currentPayload,
          main: { temp: Number.NaN, humidity: 101 },
        },
        forecast: { list: [] },
      }),
    ).toThrow(expect.objectContaining({ code: 'OPENWEATHER_INVALID_PAYLOAD' }));
  });
});

describe('fetchOpenWeather', () => {
  test('requests compatible current and 5-day forecast endpoints', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response(currentPayload))
      .mockResolvedValueOnce(response({ list: [forecastEntry] }));

    await fetchOpenWeather({
      latitude: -7.25,
      longitude: 112.76,
      scheduledFor: '2026-07-30',
      apiKey: 'test key',
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    const currentUrl = new URL(String(fetcher.mock.calls[0][0]));
    const forecastUrl = new URL(String(fetcher.mock.calls[1][0]));
    expect(currentUrl.pathname).toBe('/data/2.5/weather');
    expect(forecastUrl.pathname).toBe('/data/2.5/forecast');
    for (const url of [currentUrl, forecastUrl]) {
      expect(url.searchParams.get('lat')).toBe('-7.25');
      expect(url.searchParams.get('lon')).toBe('112.76');
      expect(url.searchParams.get('appid')).toBe('test key');
      expect(url.searchParams.get('units')).toBe('metric');
      expect(url.searchParams.get('lang')).toBe('id');
    }
  });

  test('pins requests to OpenWeather even when an extra baseUrl is supplied', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response(currentPayload))
      .mockResolvedValueOnce(response({ list: [] }));

    await fetchOpenWeather({
      latitude: -7.25,
      longitude: 112.76,
      scheduledFor: '2026-07-30',
      apiKey: 'secret-key',
      fetcher,
      baseUrl: 'https://attacker.example',
    } as Parameters<typeof fetchOpenWeather>[0]);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      fetcher.mock.calls.every(([url]) =>
        new URL(String(url)).origin === 'https://api.openweathermap.org'
      ),
    ).toBe(true);
  });

  test('retries one transient response then continues to forecast', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response(null, 503))
      .mockResolvedValueOnce(response(currentPayload))
      .mockResolvedValueOnce(response({ list: [] }));

    await expect(
      fetchOpenWeather({
        latitude: -7.25,
        longitude: 112.76,
        scheduledFor: '2026-07-30',
        apiKey: 'test-key',
        fetcher,
      }),
    ).resolves.toMatchObject({ current: { temperatureC: 28 } });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  test('retries 429 exactly once and returns a safe rate-limit code', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(response(null, 429));

    await expect(
      fetchOpenWeather({
        latitude: -7.25,
        longitude: 112.76,
        scheduledFor: '2026-07-30',
        apiKey: 'secret-key',
        fetcher,
      }),
    ).rejects.toMatchObject({
      code: 'OPENWEATHER_RATE_LIMITED',
      message: 'OPENWEATHER_RATE_LIMITED',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('does not retry a permanent non-success response', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(response(null, 401));

    await expect(
      fetchOpenWeather({
        latitude: -7.25,
        longitude: 112.76,
        scheduledFor: '2026-07-30',
        apiKey: 'secret-key',
        fetcher,
      }),
    ).rejects.toMatchObject({ code: 'OPENWEATHER_REQUEST_FAILED' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('rejects a successful non-JSON response without retrying', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(nonJsonResponse());

    await expect(
      fetchOpenWeather({
        latitude: -7.25,
        longitude: 112.76,
        scheduledFor: '2026-07-30',
        apiKey: 'secret-key',
        fetcher,
      }),
    ).rejects.toMatchObject({ code: 'OPENWEATHER_INVALID_RESPONSE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('aborts a timed-out request without retrying', async () => {
    const fetcher = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    );

    await expect(
      fetchOpenWeather({
        latitude: -7.25,
        longitude: 112.76,
        scheduledFor: '2026-07-30',
        apiKey: 'secret-key',
        fetcher,
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ code: 'OPENWEATHER_TIMEOUT' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid input and invalid JSON payloads with safe codes', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response({ nope: true }))
      .mockResolvedValueOnce(response({ list: [] }));

    await expect(
      fetchOpenWeather({
        latitude: -7.25,
        longitude: 112.76,
        scheduledFor: '2026-07-30',
        apiKey: 'secret-key',
        fetcher,
      }),
    ).rejects.toMatchObject({ code: 'OPENWEATHER_INVALID_PAYLOAD' });

    await expect(
      fetchOpenWeather({
        latitude: 91,
        longitude: 112.76,
        scheduledFor: '2026-07-30',
        apiKey: 'secret-key',
        fetcher,
      }),
    ).rejects.toMatchObject({ code: 'OPENWEATHER_INPUT_INVALID' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
