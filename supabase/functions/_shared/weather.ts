import { epochToJakartaDate } from './daily-date.ts';

const DEFAULT_BASE_URL = 'https://api.openweathermap.org';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_DESCRIPTION_LENGTH = 160;
const MAX_FORECAST_ENTRIES = 8;

export type NormalizedWeather = {
  observedAt: string;
  current: {
    conditionCode: number;
    description: string;
    temperatureC: number;
    humidityPercent: number;
    windSpeedMps: number;
    rainMm: number;
  };
  forecast: Array<{
    timestamp: string;
    conditionCode: number;
    description: string;
    temperatureC: number;
    minTemperatureC: number;
    maxTemperatureC: number;
    humidityPercent: number;
    windSpeedMps: number;
    rainProbability: number;
    rainMm: number;
  }>;
};

export type WeatherErrorCode =
  | 'OPENWEATHER_INPUT_INVALID'
  | 'OPENWEATHER_TIMEOUT'
  | 'OPENWEATHER_NETWORK_ERROR'
  | 'OPENWEATHER_RATE_LIMITED'
  | 'OPENWEATHER_UNAVAILABLE'
  | 'OPENWEATHER_REQUEST_FAILED'
  | 'OPENWEATHER_INVALID_RESPONSE'
  | 'OPENWEATHER_INVALID_PAYLOAD';

export class WeatherError extends Error {
  readonly code: WeatherErrorCode;

  constructor(code: WeatherErrorCode) {
    super(code);
    this.name = 'WeatherError';
    this.code = code;
  }
}

export type WeatherFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type NormalizeOpenWeatherInput = {
  scheduledFor: string;
  current: unknown;
  forecast: unknown;
};

type FetchOpenWeatherInput = {
  latitude: number;
  longitude: number;
  scheduledFor: string;
  apiKey: string;
  fetcher?: WeatherFetcher;
  timeoutMs?: number;
  baseUrl?: string;
};

type UnknownRecord = Record<string, unknown>;

function invalidPayload(): never {
  throw new WeatherError('OPENWEATHER_INVALID_PAYLOAD');
}

function asRecord(value: unknown): UnknownRecord {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return invalidPayload();
  }

  return value as UnknownRecord;
}

function boundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
  ) {
    return invalidPayload();
  }

  return value;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  const number = boundedNumber(value, minimum, maximum);
  if (!Number.isInteger(number)) {
    return invalidPayload();
  }

  return number;
}

function boundedDescription(value: unknown): string {
  if (typeof value !== 'string') {
    return invalidPayload();
  }

  const description = value.trim();
  if (description.length === 0) {
    return invalidPayload();
  }

  return description.slice(0, MAX_DESCRIPTION_LENGTH);
}

function weatherCondition(value: unknown): {
  conditionCode: number;
  description: string;
} {
  if (!Array.isArray(value) || value.length === 0) {
    return invalidPayload();
  }

  const condition = asRecord(value[0]);
  return {
    conditionCode: boundedInteger(condition.id, 0, 9_999),
    description: boundedDescription(condition.description),
  };
}

function rainAmount(value: unknown, property: '1h' | '3h'): number {
  if (value === undefined) {
    return 0;
  }

  const rain = asRecord(value);
  if (rain[property] === undefined) {
    return 0;
  }

  return boundedNumber(rain[property], 0, 10_000);
}

function epochSeconds(value: unknown): number {
  return boundedInteger(value, 0, 4_102_444_800);
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function normalizeCurrent(value: unknown): NormalizedWeather['current'] & {
  observedAt: string;
} {
  const current = asRecord(value);
  const main = asRecord(current.main);
  const wind = asRecord(current.wind);
  const condition = weatherCondition(current.weather);
  const observedAt = new Date(epochSeconds(current.dt) * 1000).toISOString();

  return {
    observedAt,
    ...condition,
    temperatureC: boundedNumber(main.temp, -100, 100),
    humidityPercent: boundedNumber(main.humidity, 0, 100),
    windSpeedMps: boundedNumber(wind.speed, 0, 200),
    rainMm: rainAmount(current.rain, '1h'),
  };
}

function normalizeForecastEntry(
  value: unknown,
): NormalizedWeather['forecast'][number] & { epoch: number } {
  const entry = asRecord(value);
  const main = asRecord(entry.main);
  const wind = asRecord(entry.wind);
  const condition = weatherCondition(entry.weather);
  const epoch = epochSeconds(entry.dt);

  return {
    epoch,
    timestamp: new Date(epoch * 1000).toISOString(),
    ...condition,
    temperatureC: boundedNumber(main.temp, -100, 100),
    minTemperatureC: boundedNumber(main.temp_min, -100, 100),
    maxTemperatureC: boundedNumber(main.temp_max, -100, 100),
    humidityPercent: boundedNumber(main.humidity, 0, 100),
    windSpeedMps: boundedNumber(wind.speed, 0, 200),
    rainProbability: entry.pop === undefined
      ? 0
      : boundedNumber(entry.pop, 0, 1),
    rainMm: rainAmount(entry.rain, '3h'),
  };
}

export function normalizeOpenWeather(
  input: NormalizeOpenWeatherInput,
): NormalizedWeather {
  if (!isCalendarDate(input.scheduledFor)) {
    return invalidPayload();
  }

  const normalizedCurrent = normalizeCurrent(input.current);
  const forecast = asRecord(input.forecast);
  if (!Array.isArray(forecast.list) || forecast.list.length > 80) {
    return invalidPayload();
  }

  const normalizedForecast = forecast.list
    .map(normalizeForecastEntry)
    .filter(({ epoch }) =>
      epochToJakartaDate(epoch) === input.scheduledFor
    )
    .slice(0, MAX_FORECAST_ENTRIES)
    .map(({ epoch: _epoch, ...entry }) => entry);
  const { observedAt, ...current } = normalizedCurrent;

  return {
    observedAt,
    current,
    forecast: normalizedForecast,
  };
}

function buildEndpointUrl(
  baseUrl: string,
  endpoint: 'weather' | 'forecast',
  input: Pick<
    FetchOpenWeatherInput,
    'latitude' | 'longitude' | 'apiKey'
  >,
): URL {
  let url: URL;
  try {
    url = new URL(`/data/2.5/${endpoint}`, baseUrl);
  } catch {
    throw new WeatherError('OPENWEATHER_INPUT_INVALID');
  }

  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new WeatherError('OPENWEATHER_INPUT_INVALID');
  }

  url.searchParams.set('lat', String(input.latitude));
  url.searchParams.set('lon', String(input.longitude));
  url.searchParams.set('appid', input.apiKey);
  url.searchParams.set('units', 'metric');
  url.searchParams.set('lang', 'id');
  return url;
}

function transientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function terminalStatusError(status: number): WeatherError {
  if (status === 429) {
    return new WeatherError('OPENWEATHER_RATE_LIMITED');
  }
  if (status >= 500) {
    return new WeatherError('OPENWEATHER_UNAVAILABLE');
  }
  return new WeatherError('OPENWEATHER_REQUEST_FAILED');
}

async function requestJson(
  url: URL,
  fetcher: WeatherFetcher,
  timeoutMs: number,
): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    let didTimeout = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        reject(new WeatherError('OPENWEATHER_TIMEOUT'));
      }, timeoutMs);
    });

    try {
      const response = await Promise.race([
        fetcher(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }),
        timeout,
      ]);

      if (!response.ok) {
        if (transientStatus(response.status) && attempt === 0) {
          continue;
        }
        throw terminalStatusError(response.status);
      }

      try {
        return await Promise.race([response.json(), timeout]);
      } catch (error) {
        if (error instanceof WeatherError) {
          throw error;
        }
        throw new WeatherError('OPENWEATHER_INVALID_RESPONSE');
      }
    } catch (error) {
      if (error instanceof WeatherError) {
        throw error;
      }
      if (
        didTimeout
        || controller.signal.aborted
        || (
          error !== null
          && typeof error === 'object'
          && 'name' in error
          && error.name === 'AbortError'
        )
      ) {
        throw new WeatherError('OPENWEATHER_TIMEOUT');
      }
      throw new WeatherError('OPENWEATHER_NETWORK_ERROR');
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  throw new WeatherError('OPENWEATHER_UNAVAILABLE');
}

function validateFetchInput(
  input: FetchOpenWeatherInput,
): {
  apiKey: string;
  timeoutMs: number;
  baseUrl: string;
} {
  const apiKey = typeof input.apiKey === 'string'
    ? input.apiKey.trim()
    : '';
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = input.baseUrl ?? DEFAULT_BASE_URL;

  if (
    !Number.isFinite(input.latitude)
    || input.latitude < -90
    || input.latitude > 90
    || !Number.isFinite(input.longitude)
    || input.longitude < -180
    || input.longitude > 180
    || !isCalendarDate(input.scheduledFor)
    || apiKey.length === 0
    || apiKey.length > 512
    || !Number.isInteger(timeoutMs)
    || timeoutMs < 1
    || timeoutMs > MAX_TIMEOUT_MS
    || typeof baseUrl !== 'string'
    || baseUrl.length === 0
  ) {
    throw new WeatherError('OPENWEATHER_INPUT_INVALID');
  }

  return { apiKey, timeoutMs, baseUrl };
}

export async function fetchOpenWeather(
  input: FetchOpenWeatherInput,
): Promise<NormalizedWeather> {
  const { apiKey, timeoutMs, baseUrl } = validateFetchInput(input);
  const fetcher = input.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== 'function') {
    throw new WeatherError('OPENWEATHER_INPUT_INVALID');
  }

  const endpointInput = {
    latitude: input.latitude,
    longitude: input.longitude,
    apiKey,
  };
  const current = await requestJson(
    buildEndpointUrl(baseUrl, 'weather', endpointInput),
    fetcher,
    timeoutMs,
  );
  const forecast = await requestJson(
    buildEndpointUrl(baseUrl, 'forecast', endpointInput),
    fetcher,
    timeoutMs,
  );

  return normalizeOpenWeather({
    scheduledFor: input.scheduledFor,
    current,
    forecast,
  });
}
