import {
  generateDailyTasks,
  type GenerationDependencies,
  type GenerationPlot,
} from '../generator';

const now = new Date('2026-07-29T22:00:00.000Z');

const plot: GenerationPlot = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Sawah Utara',
  farmerId: '00000000-0000-4000-8000-000000000101',
  crop: 'Padi',
  phase: 'Vegetatif',
  areaHectares: 2,
  latitude: -7.25,
  longitude: 112.76,
  status: 'aktif',
};

const weather = {
  observedAt: '2026-07-29T22:00:00.000Z',
  current: {
    conditionCode: 500,
    description: 'hujan ringan',
    temperatureC: 28,
    humidityPercent: 80,
    windSpeedMps: 2,
    rainMm: 0.4,
  },
  forecast: [],
};

const generatedTasks = [{
  judul: 'Periksa drainase',
  deskripsi: 'Periksa seluruh saluran drainase dan catat hambatan.',
  priority: 'high' as const,
  requires_location: true,
  ai_reason: 'Hujan ringan dapat menghambat aliran air.',
}];

const manualRequest = {
  trigger: 'manual' as const,
  scheduledFor: '2026-07-30',
  requestedBy: '00000000-0000-4000-8000-000000000201',
  plotIds: [plot.id],
};

function dependencies(
  overrides: Partial<GenerationDependencies> = {},
): jest.Mocked<GenerationDependencies> {
  return {
    listPlots: jest.fn().mockResolvedValue([plot]),
    listRecentTasks: jest.fn().mockResolvedValue([]),
    findCurrentTarget: jest.fn().mockResolvedValue(null),
    findWeatherCache: jest.fn().mockResolvedValue(null),
    saveWeather: jest.fn().mockResolvedValue('weather-1'),
    fetchWeather: jest.fn().mockResolvedValue(weather),
    generateDrafts: jest.fn().mockResolvedValue({
      summary: 'Satu pekerjaan',
      tasks: generatedTasks,
      usage: null,
    }),
    createRun: jest.fn().mockResolvedValue('run-1'),
    replaceDrafts: jest.fn().mockResolvedValue('target-1'),
    recordTargetResult: jest.fn().mockResolvedValue('target-result-1'),
    finishRun: jest.fn().mockResolvedValue(undefined),
    now: () => now,
    ...overrides,
  } as jest.Mocked<GenerationDependencies>;
}

test('unassigned active plot is skipped without provider calls', async () => {
  const deps = dependencies({
    listPlots: jest.fn().mockResolvedValue([{
      ...plot,
      farmerId: null,
    }]),
  });

  const result = await generateDailyTasks(manualRequest, deps);

  expect(result).toMatchObject({
    status: 'succeeded',
    successCount: 0,
    skippedCount: 1,
    failedCount: 0,
    warnings: [{ plotId: plot.id, code: 'plot_unassigned' }],
  });
  expect(deps.fetchWeather).not.toHaveBeenCalled();
  expect(deps.generateDrafts).not.toHaveBeenCalled();
  expect(deps.recordTargetResult).toHaveBeenCalledWith(
    expect.objectContaining({
      runId: 'run-1',
      plotId: plot.id,
      status: 'skipped',
      errorCode: 'plot_unassigned',
    }),
  );
});

test('fresh live weather is saved and passed into draft replacement', async () => {
  const deps = dependencies();

  const result = await generateDailyTasks(manualRequest, deps);

  expect(deps.saveWeather).toHaveBeenCalledWith(plot.id, weather, now);
  expect(deps.generateDrafts).toHaveBeenCalledWith(
    expect.objectContaining({
      plot: expect.objectContaining({ name: 'Sawah Utara', crop: 'Padi' }),
      weather: {
        current: weather.current,
        forecast: weather.forecast,
      },
      recentTasks: [],
    }),
  );
  expect(deps.replaceDrafts).toHaveBeenCalledWith({
    runId: 'run-1',
    plotId: plot.id,
    scheduledFor: '2026-07-30',
    weatherSnapshotId: 'weather-1',
    summary: 'Satu pekerjaan',
    tasks: generatedTasks,
  });
  expect(result).toMatchObject({
    status: 'succeeded',
    successCount: 1,
    skippedCount: 0,
    failedCount: 0,
  });
});

test('live weather failure uses cache no older than six hours', async () => {
  const deps = dependencies({
    fetchWeather: jest.fn().mockRejectedValue(new Error('safe-weather-code')),
    findWeatherCache: jest.fn().mockResolvedValue({
      snapshotId: 'weather-cache',
      cachedAt: '2026-07-29T16:00:00.000Z',
      weather,
    }),
  });

  await generateDailyTasks(manualRequest, deps);

  expect(deps.findWeatherCache).toHaveBeenCalledWith(plot.id, now);
  expect(deps.saveWeather).not.toHaveBeenCalled();
  expect(deps.replaceDrafts).toHaveBeenCalledWith(
    expect.objectContaining({ weatherSnapshotId: 'weather-cache' }),
  );
});

test('weather snapshot persistence failure never falls back to cache', async () => {
  const deps = dependencies({
    saveWeather: jest.fn().mockRejectedValue(new Error('raw-db-message')),
    findWeatherCache: jest.fn().mockResolvedValue({
      snapshotId: 'weather-cache',
      cachedAt: '2026-07-29T16:00:00.000Z',
      weather,
    }),
  });

  const result = await generateDailyTasks(manualRequest, deps);

  expect(deps.findWeatherCache).not.toHaveBeenCalled();
  expect(deps.generateDrafts).not.toHaveBeenCalled();
  expect(result.warnings).toEqual([{
    plotId: plot.id,
    code: 'persistence_error',
  }]);
  expect(deps.finishRun).toHaveBeenCalledTimes(1);
});

test.each([
  ['no cache', null],
  ['stale cache', {
    snapshotId: 'weather-old',
    cachedAt: '2026-07-29T15:59:59.999Z',
    weather,
  }],
])('%s produces weather_unavailable for only that plot', async (
  _label,
  cached,
) => {
  const deps = dependencies({
    fetchWeather: jest.fn().mockRejectedValue(new Error('weather-down')),
    findWeatherCache: jest.fn().mockResolvedValue(cached),
  });

  const result = await generateDailyTasks(manualRequest, deps);

  expect(result).toMatchObject({
    status: 'failed',
    successCount: 0,
    failedCount: 1,
    warnings: [{ plotId: plot.id, code: 'weather_unavailable' }],
  });
  expect(deps.generateDrafts).not.toHaveBeenCalled();
  expect(deps.recordTargetResult).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'failed',
      errorCode: 'weather_unavailable',
    }),
  );
  expect(deps.finishRun).toHaveBeenCalledTimes(1);
});

test('invalid model output fails only that plot and finishes a partial run', async () => {
  const secondPlot = {
    ...plot,
    id: '00000000-0000-4000-8000-000000000002',
  };
  const deps = dependencies({
    listPlots: jest.fn().mockResolvedValue([plot, secondPlot]),
    generateDrafts: jest.fn()
      .mockResolvedValueOnce({
        summary: 'Satu pekerjaan',
        tasks: generatedTasks,
        usage: { total_tokens: 10 },
      })
      .mockRejectedValueOnce(Object.assign(new Error('safe'), {
        code: 'OPENROUTER_INVALID_STRUCTURED_OUTPUT',
      })),
  });

  const result = await generateDailyTasks(
    { ...manualRequest, plotIds: [plot.id, secondPlot.id] },
    deps,
  );

  expect(result).toMatchObject({
    status: 'partial',
    successCount: 1,
    failedCount: 1,
  });
  expect(result.warnings).toContainEqual({
    plotId: secondPlot.id,
    code: 'invalid_model_output',
  });
  expect(deps.replaceDrafts).toHaveBeenCalledTimes(1);
  expect(deps.finishRun).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'partial',
      successCount: 1,
      failedCount: 1,
    }),
  );
});

test('zero-task model response still replaces pending drafts', async () => {
  const deps = dependencies({
    generateDrafts: jest.fn().mockResolvedValue({
      summary: 'Tidak ada pekerjaan aman hari ini.',
      tasks: [],
      usage: null,
    }),
  });

  const result = await generateDailyTasks(manualRequest, deps);

  expect(deps.replaceDrafts).toHaveBeenCalledWith(
    expect.objectContaining({
      summary: 'Tidak ada pekerjaan aman hari ini.',
      tasks: [],
    }),
  );
  expect(result.successCount).toBe(1);
});

test('cron skips an existing successful current target without mutation', async () => {
  const deps = dependencies({
    findCurrentTarget: jest.fn().mockResolvedValue({
      id: 'target-current',
      status: 'succeeded',
    }),
  });

  const result = await generateDailyTasks({
    trigger: 'cron',
    scheduledFor: '2026-07-30',
    requestedBy: null,
  }, deps);

  expect(result).toMatchObject({
    status: 'succeeded',
    skippedCount: 1,
    successCount: 0,
  });
  expect(deps.fetchWeather).not.toHaveBeenCalled();
  expect(deps.replaceDrafts).not.toHaveBeenCalled();
  expect(deps.recordTargetResult).not.toHaveBeenCalled();
});

test('cron preserves a successful target even when the plot is now unassigned', async () => {
  const deps = dependencies({
    listPlots: jest.fn().mockResolvedValue([{
      ...plot,
      farmerId: null,
    }]),
    findCurrentTarget: jest.fn().mockResolvedValue({
      id: 'target-current',
      status: 'succeeded',
    }),
  });

  const result = await generateDailyTasks({
    trigger: 'cron',
    scheduledFor: '2026-07-30',
    requestedBy: null,
  }, deps);

  expect(result).toMatchObject({
    status: 'succeeded',
    skippedCount: 1,
    warnings: [],
  });
  expect(deps.findCurrentTarget).toHaveBeenCalledWith(
    plot.id,
    '2026-07-30',
  );
  expect(deps.recordTargetResult).not.toHaveBeenCalled();
  expect(deps.replaceDrafts).not.toHaveBeenCalled();
});

test('manual generation replaces drafts even when a current target exists', async () => {
  const deps = dependencies({
    findCurrentTarget: jest.fn().mockResolvedValue({
      id: 'target-current',
      status: 'succeeded',
    }),
  });

  await generateDailyTasks(manualRequest, deps);

  expect(deps.findCurrentTarget).not.toHaveBeenCalled();
  expect(deps.replaceDrafts).toHaveBeenCalledTimes(1);
});

test('model and persistence failures use safe per-plot warning codes', async () => {
  const modelDeps = dependencies({
    generateDrafts: jest.fn().mockRejectedValue(new Error('raw-provider-body')),
  });
  const persistenceDeps = dependencies({
    replaceDrafts: jest.fn().mockRejectedValue(new Error('raw-db-message')),
  });

  const modelResult = await generateDailyTasks(manualRequest, modelDeps);
  const persistenceResult = await generateDailyTasks(
    manualRequest,
    persistenceDeps,
  );

  expect(modelResult.warnings).toEqual([{
    plotId: plot.id,
    code: 'model_error',
  }]);
  expect(persistenceResult.warnings).toEqual([{
    plotId: plot.id,
    code: 'persistence_error',
  }]);
  expect(JSON.stringify([modelResult, persistenceResult]))
    .not.toMatch(/raw-provider-body|raw-db-message/);
  expect(modelDeps.finishRun).toHaveBeenCalledTimes(1);
  expect(persistenceDeps.finishRun).toHaveBeenCalledTimes(1);
});

test('processes at most three plots concurrently', async () => {
  const plots = Array.from({ length: 7 }, (_, index) => ({
    ...plot,
    id: `00000000-0000-4000-8000-00000000000${index + 1}`,
  }));
  let active = 0;
  let maximum = 0;
  const deps = dependencies({
    listPlots: jest.fn().mockResolvedValue(plots),
    fetchWeather: jest.fn().mockImplementation(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return weather;
    }),
  });

  const result = await generateDailyTasks(
    { ...manualRequest, plotIds: plots.map(({ id }) => id) },
    deps,
  );

  expect(maximum).toBe(3);
  expect(result.successCount).toBe(7);
  expect(deps.finishRun).toHaveBeenCalledTimes(1);
});
