import type { SupabaseClient } from '@supabase/supabase-js';

import type { DashboardWeatherSummary } from '@/lib/farm-types';

import { supabase } from './supabase';

type PlotRelation =
  | { nama_lahan: string }
  | { nama_lahan: string }[]
  | null;

export type DashboardWeatherSnapshotRow = {
  lahan_id: string;
  observed_at: string;
  current_data: unknown;
  forecast_data: unknown;
  lahan: PlotRelation;
};

const WEATHER_SELECT =
  'lahan_id,observed_at,current_data,forecast_data,lahan!weather_snapshots_lahan_id_fkey(nama_lahan)';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function relationPlotName(relation: PlotRelation): string | null {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return typeof value?.nama_lahan === 'string' && value.nama_lahan.trim()
    ? value.nama_lahan.trim()
    : null;
}

function boundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function nullableBoundedNumber(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : null;
}

function safeDescription(value: unknown): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 160)
    : 'Cuaca tidak tersedia';
}

function forecastNumbers(
  forecastData: unknown,
  key: 'minTemperatureC' | 'maxTemperatureC' | 'rainProbability',
  minimum: number,
  maximum: number
): number[] {
  return Array.isArray(forecastData)
    ? forecastData
        .slice(0, 8)
        .map(asRecord)
        .map((point) => nullableBoundedNumber(point[key], minimum, maximum))
        .filter((value): value is number => value !== null)
    : [];
}

export function mapDashboardWeatherSnapshotRow(
  row: DashboardWeatherSnapshotRow
): DashboardWeatherSummary {
  const plotName = relationPlotName(row.lahan);
  if (!row.lahan_id || !plotName) {
    throw new Error('WEATHER_DISPLAY_DATA_MISSING');
  }

  const current = asRecord(row.current_data);
  const minimums = forecastNumbers(
    row.forecast_data,
    'minTemperatureC',
    -100,
    100
  );
  const maximums = forecastNumbers(
    row.forecast_data,
    'maxTemperatureC',
    -100,
    100
  );
  const probabilities = forecastNumbers(
    row.forecast_data,
    'rainProbability',
    0,
    1
  );

  return {
    plotId: row.lahan_id,
    plotName,
    observedAt: typeof row.observed_at === 'string' ? row.observed_at : '',
    description: safeDescription(current.description),
    temperatureC: boundedNumber(current.temperatureC, -100, 100, 0),
    humidityPercent: boundedNumber(current.humidityPercent, 0, 100, 0),
    windSpeedMps: boundedNumber(current.windSpeedMps, 0, 200, 0),
    rainMm: boundedNumber(current.rainMm, 0, 10_000, 0),
    forecastMinTemperatureC:
      minimums.length > 0 ? Math.min(...minimums) : null,
    forecastMaxTemperatureC:
      maximums.length > 0 ? Math.max(...maximums) : null,
    forecastMaxRainProbability:
      probabilities.length > 0 ? Math.max(...probabilities) : null,
  };
}

export async function fetchLatestWeatherSummaries(
  options: {
    plotIds?: string[];
    limit?: number;
    client?: SupabaseClient;
  } = {}
): Promise<DashboardWeatherSummary[]> {
  const client = options.client ?? supabase;
  const uniquePlotIds = options.plotIds
    ? Array.from(new Set(
        options.plotIds
          .map((plotId) => plotId.trim())
          .filter((plotId) => plotId.length > 0)
      ))
    : null;

  if (uniquePlotIds?.length === 0) {
    return [];
  }
  if (uniquePlotIds) {
    return fetchLatestWeatherForPlots(uniquePlotIds, client);
  }

  const limit = Number.isInteger(options.limit)
    ? Math.max(1, Math.min(100, options.limit ?? 40))
    : 40;
  let query = client
    .from('weather_snapshots')
    .select(WEATHER_SELECT);

  const { data, error } = await query
    .order('observed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const latestByPlot = new Map<string, DashboardWeatherSummary>();
  for (const row of (data ?? []) as unknown as DashboardWeatherSnapshotRow[]) {
    const summary = mapDashboardWeatherSnapshotRow(row);
    if (!latestByPlot.has(summary.plotId)) {
      latestByPlot.set(summary.plotId, summary);
    }
  }
  return Array.from(latestByPlot.values());
}

async function fetchLatestWeatherForPlot(
  plotId: string,
  client: SupabaseClient
): Promise<DashboardWeatherSummary | null> {
  const { data, error } = await client
    .from('weather_snapshots')
    .select(WEATHER_SELECT)
    .eq('lahan_id', plotId)
    .order('observed_at', { ascending: false })
    .limit(1);
  if (error) throw error;

  const row = ((data ?? []) as unknown as DashboardWeatherSnapshotRow[])[0];
  return row ? mapDashboardWeatherSnapshotRow(row) : null;
}

export async function fetchLatestWeatherForPlots(
  plotIds: string[],
  client: SupabaseClient = supabase
): Promise<DashboardWeatherSummary[]> {
  const uniquePlotIds = Array.from(new Set(
    plotIds
      .map((plotId) => plotId.trim())
      .filter((plotId) => plotId.length > 0)
  ));
  const summaries = await Promise.all(
    uniquePlotIds.map((plotId) => fetchLatestWeatherForPlot(plotId, client))
  );
  return summaries.filter(
    (summary): summary is DashboardWeatherSummary => summary !== null
  );
}
