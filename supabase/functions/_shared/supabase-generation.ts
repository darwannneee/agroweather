import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  type CachedGenerationWeather,
  type CurrentGenerationTarget,
  type GenerationDependencies,
  type GenerationPersistenceResult,
  type GenerationPlot,
  type GenerationRequest,
  type RecentGenerationTask,
} from './generator.ts';
import {
  generateOpenRouterDrafts,
  type OpenRouterContext,
} from './openrouter.ts';
import {
  fetchOpenWeather,
  type NormalizedWeather,
} from './weather.ts';

const WEATHER_CACHE_MS = 6 * 60 * 60 * 1_000;

function unwrap<T>(result: {
  data: T;
  error: { code?: string; message: string } | null;
}): T {
  if (result.error) {
    throw new Error(result.error.code ?? 'DATABASE_ERROR');
  }
  return result.data;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    throw new Error('WEATHER_CACHE_INVALID');
  }
  return value as JsonRecord;
}

function finiteNumber(
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
    throw new Error('WEATHER_CACHE_INVALID');
  }
  return value;
}

function normalizedPoint(
  value: unknown,
  forecast: boolean,
): JsonRecord {
  const point = asRecord(value);
  if (
    typeof point.description !== 'string'
    || point.description.trim().length === 0
  ) {
    throw new Error('WEATHER_CACHE_INVALID');
  }

  const result: JsonRecord = {
    conditionCode: finiteNumber(point.conditionCode, 0, 9_999),
    description: point.description.trim().slice(0, 160),
    temperatureC: finiteNumber(point.temperatureC, -100, 100),
    humidityPercent: finiteNumber(point.humidityPercent, 0, 100),
    windSpeedMps: finiteNumber(point.windSpeedMps, 0, 200),
    rainMm: finiteNumber(point.rainMm, 0, 10_000),
  };
  if (forecast) {
    if (typeof point.timestamp !== 'string') {
      throw new Error('WEATHER_CACHE_INVALID');
    }
    result.timestamp = point.timestamp;
    result.minTemperatureC = finiteNumber(
      point.minTemperatureC,
      -100,
      100,
    );
    result.maxTemperatureC = finiteNumber(
      point.maxTemperatureC,
      -100,
      100,
    );
    result.rainProbability = finiteNumber(
      point.rainProbability,
      0,
      1,
    );
  }
  return result;
}

function normalizeCachedWeather(row: {
  observed_at: string;
  current_data: unknown;
  forecast_data: unknown;
}): NormalizedWeather {
  if (
    typeof row.observed_at !== 'string'
    || !Number.isFinite(new Date(row.observed_at).getTime())
    || !Array.isArray(row.forecast_data)
    || row.forecast_data.length > 8
  ) {
    throw new Error('WEATHER_CACHE_INVALID');
  }

  return {
    observedAt: new Date(row.observed_at).toISOString(),
    current: normalizedPoint(
      row.current_data,
      false,
    ) as NormalizedWeather['current'],
    forecast: row.forecast_data.map((entry) =>
      normalizedPoint(entry, true)
    ) as NormalizedWeather['forecast'],
  };
}

export function createSupabaseGenerationDependencies(input: {
  admin: SupabaseClient;
  openWeatherApiKey: string;
  openRouterApiKey: string;
  openRouterModel: string;
}): GenerationDependencies {
  const {
    admin,
    openWeatherApiKey,
    openRouterApiKey,
    openRouterModel,
  } = input;

  const persistenceResult = async (
    targetId: unknown,
    requestRunId: string,
  ): Promise<GenerationPersistenceResult> => {
    if (typeof targetId !== 'string' || targetId.length === 0) {
      throw new Error('DATABASE_INVALID_RESULT');
    }
    const row = unwrap(await admin
      .from('ai_generation_targets')
      .select('run_id')
      .eq('id', targetId)
      .single()) as { run_id?: unknown };
    if (typeof row.run_id !== 'string' || row.run_id.length === 0) {
      throw new Error('DATABASE_INVALID_RESULT');
    }
    return {
      targetId,
      skipped: row.run_id !== requestRunId,
    };
  };

  return {
    async listPlots(plotIds) {
      let query = admin
        .from('lahan')
        .select(
          'id,nama_lahan,farmer_id,jenis_tanaman,luas_hektar,lat_center,lng_center,radius_geofence_m,fase_lahan,status',
        )
        .eq('status', 'aktif')
        .order('id', { ascending: true });
      if (plotIds !== undefined) {
        query = query.in('id', plotIds);
      }

      const rows = unwrap(await query) as Array<{
        id: string;
        nama_lahan: string;
        farmer_id: string | null;
        jenis_tanaman: string | null;
        luas_hektar: number | null;
        lat_center: number;
        lng_center: number;
        fase_lahan: string | null;
        status: string;
      }>;
      return rows.map((row): GenerationPlot => ({
        id: row.id,
        name: row.nama_lahan,
        farmerId: row.farmer_id,
        crop: row.jenis_tanaman,
        phase: row.fase_lahan,
        areaHectares: row.luas_hektar,
        latitude: row.lat_center,
        longitude: row.lng_center,
        status: row.status,
      }));
    },

    async listRecentTasks(plotId) {
      const rows = unwrap(await admin
        .from('tasks')
        .select(
          'judul,deskripsi,status,scheduled_for,priority,source',
        )
        .eq('lahan_id', plotId)
        .order('scheduled_for', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10)) as Array<{
          judul: string;
          deskripsi: string | null;
          status: string;
          scheduled_for: string;
          priority: string;
          source: string;
        }>;
      return rows.map((row): RecentGenerationTask => ({
        title: row.judul,
        description: row.deskripsi,
        status: row.status,
        scheduledFor: row.scheduled_for,
        priority: row.priority,
        source: row.source,
      }));
    },

    async findCurrentTarget(plotId, scheduledFor) {
      const result = await admin
        .from('ai_generation_targets')
        .select('id,status')
        .eq('lahan_id', plotId)
        .eq('scheduled_for', scheduledFor)
        .eq('is_current', true)
        .single();
      if (result.error?.code === 'PGRST116') {
        return null;
      }
      const row = unwrap(result) as {
        id: string;
        status: string;
      };
      return {
        id: row.id,
        status: row.status,
      } satisfies CurrentGenerationTarget;
    },

    async findWeatherCache(plotId, now) {
      const result = await admin
        .from('weather_snapshots')
        .select(
          'id,observed_at,created_at,current_data,forecast_data',
        )
        .eq('lahan_id', plotId)
        .gte('expires_at', now.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (result.error?.code === 'PGRST116') {
        return null;
      }
      const row = unwrap(result) as {
        id: string;
        observed_at: string;
        created_at: string;
        current_data: unknown;
        forecast_data: unknown;
      };
      return {
        snapshotId: row.id,
        cachedAt: row.created_at,
        weather: normalizeCachedWeather(row),
      } satisfies CachedGenerationWeather;
    },

    async saveWeather(plotId, weather, now) {
      const expiresAt = new Date(
        now.getTime() + WEATHER_CACHE_MS,
      ).toISOString();
      const row = unwrap(await admin
        .from('weather_snapshots')
        .insert({
          lahan_id: plotId,
          provider: 'openweather',
          observed_at: weather.observedAt,
          expires_at: expiresAt,
          current_data: weather.current,
          forecast_data: weather.forecast,
        })
        .select('id')
        .single()) as { id: string };
      return row.id;
    },

    fetchWeather(plot, scheduledFor) {
      return fetchOpenWeather({
        latitude: plot.latitude,
        longitude: plot.longitude,
        scheduledFor,
        apiKey: openWeatherApiKey,
      });
    },

    generateDrafts(context: OpenRouterContext) {
      return generateOpenRouterDrafts({
        apiKey: openRouterApiKey,
        model: openRouterModel,
        context,
      });
    },

    async createRun(request: GenerationRequest, plotCount: number) {
      const row = unwrap(await admin
        .from('ai_generation_runs')
        .insert({
          trigger: request.trigger,
          scheduled_for: request.scheduledFor,
          requested_by: request.requestedBy,
          status: 'running',
          model: openRouterModel,
          plot_count: plotCount,
        })
        .select('id')
        .single()) as { id: string };
      return row.id;
    },

    async replaceDrafts(request) {
      const targetId = unwrap(await admin.rpc('replace_ai_task_drafts', {
        p_run_id: request.runId,
        p_lahan_id: request.plotId,
        p_scheduled_for: request.scheduledFor,
        p_weather_snapshot_id: request.weatherSnapshotId,
        p_model: openRouterModel,
        p_result_summary: request.summary,
        p_drafts: request.tasks,
      }));
      return persistenceResult(targetId, request.runId);
    },

    async recordTargetResult(request) {
      const targetId = unwrap(await admin.rpc('record_ai_generation_target', {
        p_run_id: request.runId,
        p_lahan_id: request.plotId,
        p_scheduled_for: request.scheduledFor,
        p_status: request.status,
        p_error_code: request.errorCode,
        p_result_summary: request.summary,
        p_weather_snapshot_id: request.weatherSnapshotId,
      }));
      return persistenceResult(targetId, request.runId);
    },

    async finishRun(result) {
      unwrap(await admin
        .from('ai_generation_runs')
        .update({
          status: result.status,
          success_count: result.successCount,
          skipped_count: result.skippedCount,
          failed_count: result.failedCount,
          warning_summary: result.warnings,
          provider_usage: result.providerUsage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', result.runId));
    },

    now() {
      return new Date();
    },
  };
}
