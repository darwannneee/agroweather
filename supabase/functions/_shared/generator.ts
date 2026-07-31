import type { GeneratedDraft, OpenRouterContext } from './openrouter.ts';
import type { NormalizedWeather } from './weather.ts';

const WEATHER_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1_000;
const MAX_CONCURRENCY = 3;

export type GenerationTrigger = 'cron' | 'manual';
export type GenerationRunStatus =
  | 'succeeded'
  | 'partial'
  | 'failed';
export type GenerationWarningCode =
  | 'plot_unassigned'
  | 'weather_unavailable'
  | 'model_error'
  | 'invalid_model_output'
  | 'persistence_error';

export type GenerationRequest = {
  trigger: GenerationTrigger;
  scheduledFor: string;
  requestedBy: string | null;
  plotIds?: string[];
};

export type GenerationPlot = {
  id: string;
  name: string;
  farmerId: string | null;
  crop: string | null;
  phase: string | null;
  areaHectares: number | null;
  latitude: number;
  longitude: number;
  status: string;
};

export type RecentGenerationTask = {
  title: string;
  description?: string | null;
  status: string;
  scheduledFor: string;
  priority?: string;
  source?: string;
};

export type CurrentGenerationTarget = {
  id: string;
  status: string;
};

export type CachedGenerationWeather = {
  snapshotId: string;
  cachedAt: string;
  weather: NormalizedWeather;
};

export type GeneratedTaskResult = {
  summary: string;
  tasks: GeneratedDraft[];
  usage: Record<string, unknown> | null;
};

export type GenerationPersistenceResult = {
  targetId: string;
  skipped: boolean;
};

export type GenerationWarning = {
  plotId: string;
  code: GenerationWarningCode;
};

export type GenerationDependencies = {
  listPlots(plotIds?: string[]): Promise<GenerationPlot[]>;
  listRecentTasks(plotId: string): Promise<RecentGenerationTask[]>;
  findCurrentTarget(
    plotId: string,
    scheduledFor: string,
  ): Promise<CurrentGenerationTarget | null>;
  findWeatherCache(
    plotId: string,
    now: Date,
  ): Promise<CachedGenerationWeather | null>;
  saveWeather(
    plotId: string,
    weather: NormalizedWeather,
    now: Date,
  ): Promise<string>;
  fetchWeather(
    plot: GenerationPlot,
    scheduledFor: string,
  ): Promise<NormalizedWeather>;
  generateDrafts(context: OpenRouterContext): Promise<GeneratedTaskResult>;
  createRun(request: GenerationRequest, plotCount: number): Promise<string>;
  replaceDrafts(input: {
    runId: string;
    plotId: string;
    scheduledFor: string;
    weatherSnapshotId: string;
    summary: string;
    tasks: GeneratedDraft[];
  }): Promise<GenerationPersistenceResult>;
  recordTargetResult(input: {
    runId: string;
    plotId: string;
    scheduledFor: string;
    status: 'skipped' | 'failed';
    errorCode: GenerationWarningCode;
    summary: string | null;
    weatherSnapshotId: string | null;
  }): Promise<GenerationPersistenceResult>;
  finishRun(input: {
    runId: string;
    status: GenerationRunStatus;
    successCount: number;
    skippedCount: number;
    failedCount: number;
    warnings: GenerationWarning[];
    providerUsage: Array<{
      plotId: string;
      usage: Record<string, unknown>;
    }>;
  }): Promise<void>;
  now(): Date;
};

export type GenerationResult = {
  runId: string;
  status: GenerationRunStatus;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  draftCount: number;
  warnings: GenerationWarning[];
};

type PlotOutcome = {
  kind: 'success' | 'skipped' | 'failed';
  draftCount?: number;
  warning?: GenerationWarning;
  usage?: Record<string, unknown>;
};

function warning(
  plotId: string,
  code: GenerationWarningCode,
): GenerationWarning {
  return { plotId, code };
}

function isFreshCache(
  cache: CachedGenerationWeather,
  now: Date,
): boolean {
  const cachedAt = new Date(cache.cachedAt).getTime();
  const age = now.getTime() - cachedAt;
  return Number.isFinite(cachedAt)
    && age >= 0
    && age <= WEATHER_CACHE_MAX_AGE_MS;
}

function invalidModelOutput(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const value = error as { code?: unknown; message?: unknown };
  return value.code === 'OPENROUTER_INVALID_STRUCTURED_OUTPUT'
    || value.message === 'OPENROUTER_INVALID_STRUCTURED_OUTPUT';
}

async function recordFailure(
  dependencies: GenerationDependencies,
  input: {
    runId: string;
    plotId: string;
    scheduledFor: string;
    status: 'skipped' | 'failed';
    code: GenerationWarningCode;
    weatherSnapshotId?: string | null;
  },
): Promise<PlotOutcome> {
  try {
    const persisted = await dependencies.recordTargetResult({
      runId: input.runId,
      plotId: input.plotId,
      scheduledFor: input.scheduledFor,
      status: input.status,
      errorCode: input.code,
      summary: null,
      weatherSnapshotId: input.weatherSnapshotId ?? null,
    });
    if (persisted.skipped) {
      return { kind: 'skipped' };
    }
    return {
      kind: input.status === 'skipped' ? 'skipped' : 'failed',
      warning: warning(input.plotId, input.code),
    };
  } catch {
    return {
      kind: 'failed',
      warning: warning(input.plotId, 'persistence_error'),
    };
  }
}

async function processPlot(
  request: GenerationRequest,
  runId: string,
  plot: GenerationPlot,
  dependencies: GenerationDependencies,
  now: Date,
): Promise<PlotOutcome> {
  if (request.trigger === 'cron') {
    try {
      const currentTarget = await dependencies.findCurrentTarget(
        plot.id,
        request.scheduledFor,
      );
      if (currentTarget?.status === 'succeeded') {
        return { kind: 'skipped' };
      }
    } catch {
      return {
        kind: 'failed',
        warning: warning(plot.id, 'persistence_error'),
      };
    }
  }

  if (plot.farmerId === null) {
    return recordFailure(dependencies, {
      runId,
      plotId: plot.id,
      scheduledFor: request.scheduledFor,
      status: 'skipped',
      code: 'plot_unassigned',
    });
  }

  let weather: NormalizedWeather;
  let weatherSnapshotId: string;
  try {
    let liveWeather: NormalizedWeather | null = null;
    try {
      liveWeather = await dependencies.fetchWeather(
        plot,
        request.scheduledFor,
      );
    } catch {
      const cache = await dependencies.findWeatherCache(plot.id, now);
      if (cache === null || !isFreshCache(cache, now)) {
        return recordFailure(dependencies, {
          runId,
          plotId: plot.id,
          scheduledFor: request.scheduledFor,
          status: 'failed',
          code: 'weather_unavailable',
        });
      }
      weather = cache.weather;
      weatherSnapshotId = cache.snapshotId;
    }

    if (liveWeather !== null) {
      weather = liveWeather;
      weatherSnapshotId = await dependencies.saveWeather(
        plot.id,
        weather,
        now,
      );
    }
  } catch {
    return recordFailure(dependencies, {
      runId,
      plotId: plot.id,
      scheduledFor: request.scheduledFor,
      status: 'failed',
      code: 'persistence_error',
    });
  }

  let recentTasks: RecentGenerationTask[];
  try {
    recentTasks = await dependencies.listRecentTasks(plot.id);
  } catch {
    return recordFailure(dependencies, {
      runId,
      plotId: plot.id,
      scheduledFor: request.scheduledFor,
      status: 'failed',
      code: 'persistence_error',
      weatherSnapshotId,
    });
  }

  let generated: GeneratedTaskResult;
  try {
    generated = await dependencies.generateDrafts({
      plot: {
        name: plot.name,
        crop: plot.crop,
        phase: plot.phase,
        areaHectares: plot.areaHectares,
      },
      weather: {
        current: weather.current,
        forecast: weather.forecast,
      },
      recentTasks,
    });
  } catch (error) {
    return recordFailure(dependencies, {
      runId,
      plotId: plot.id,
      scheduledFor: request.scheduledFor,
      status: 'failed',
      code: invalidModelOutput(error)
        ? 'invalid_model_output'
        : 'model_error',
      weatherSnapshotId,
    });
  }

  try {
    const persisted = await dependencies.replaceDrafts({
      runId,
      plotId: plot.id,
      scheduledFor: request.scheduledFor,
      weatherSnapshotId,
      summary: generated.summary,
      tasks: generated.tasks,
    });
    if (persisted.skipped) {
      return { kind: 'skipped' };
    }
  } catch {
    return recordFailure(dependencies, {
      runId,
      plotId: plot.id,
      scheduledFor: request.scheduledFor,
      status: 'failed',
      code: 'persistence_error',
      weatherSnapshotId,
    });
  }

  return {
    kind: 'success',
    draftCount: generated.tasks.length,
    ...(generated.usage === null ? {} : { usage: generated.usage }),
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  map: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await map(values[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => worker(),
    ),
  );
  return results;
}

function runStatus(
  successCount: number,
  failedCount: number,
): GenerationRunStatus {
  if (failedCount === 0) {
    return 'succeeded';
  }
  return successCount > 0 ? 'partial' : 'failed';
}

export async function generateDailyTasks(
  request: GenerationRequest,
  dependencies: GenerationDependencies,
): Promise<GenerationResult> {
  const plots = await dependencies.listPlots(request.plotIds);
  const runId = await dependencies.createRun(request, plots.length);
  const startedAt = dependencies.now();
  const outcomes = await mapWithConcurrency(
    plots,
    MAX_CONCURRENCY,
    (plot) => processPlot(
      request,
      runId,
      plot,
      dependencies,
      startedAt,
    ),
  );
  const successCount = outcomes.filter(({ kind }) =>
    kind === 'success'
  ).length;
  const skippedCount = outcomes.filter(({ kind }) =>
    kind === 'skipped'
  ).length;
  const failedCount = outcomes.filter(({ kind }) =>
    kind === 'failed'
  ).length;
  const draftCount = outcomes.reduce(
    (total, outcome) => total + (outcome.draftCount ?? 0),
    0,
  );
  const warnings = outcomes.flatMap(({ warning: item }) =>
    item === undefined ? [] : [item]
  );
  const providerUsage = outcomes.flatMap((outcome, index) =>
    outcome.usage === undefined
      ? []
      : [{ plotId: plots[index].id, usage: outcome.usage }]
  );
  const status = runStatus(successCount, failedCount);

  await dependencies.finishRun({
    runId,
    status,
    successCount,
    skippedCount,
    failedCount,
    warnings,
    providerUsage,
  });

  return {
    runId,
    status,
    successCount,
    skippedCount,
    failedCount,
    draftCount,
    warnings,
  };
}
