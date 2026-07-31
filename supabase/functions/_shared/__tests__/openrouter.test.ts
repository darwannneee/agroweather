import {
  buildOpenRouterRequest,
  generateOpenRouterDrafts,
  parseOpenRouterDrafts,
} from '../openrouter';

const context = {
  plot: {
    name: 'Sawah Utara',
    crop: 'Padi',
    phase: 'Vegetatif',
    areaHectares: 2,
  },
  weather: {
    current: {
      conditionCode: 500,
      description: 'hujan ringan',
      temperatureC: 28,
      humidityPercent: 80,
      windSpeedMps: 2,
      rainMm: 0.4,
    },
    forecast: [],
  },
  recentTasks: [],
};

const providerDraft = {
  title: 'Periksa drainase',
  instruction: 'Periksa seluruh saluran drainase dan catat hambatan.',
  priority: 'high',
  requires_location: true,
  reason: 'Hujan ringan dapat menghambat aliran air.',
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

describe('buildOpenRouterRequest', () => {
  test('requires strict structured output from the configured model', () => {
    const request = buildOpenRouterRequest({
      model: 'provider/model',
      ...context,
    });

    expect(request).toMatchObject({
      model: 'provider/model',
      stream: false,
      provider: { require_parameters: true },
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'agroweather_task_drafts',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['summary', 'tasks'],
            properties: {
              tasks: {
                type: 'array',
                minItems: 1,
                maxItems: 5,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'title',
                    'instruction',
                    'priority',
                    'requires_location',
                    'reason',
                  ],
                },
              },
            },
          },
        },
      },
    });
    expect(request.max_tokens).toBeGreaterThan(0);
    expect(request.max_tokens).toBeLessThanOrEqual(2_000);
  });

  test('system prompt constrains safety, evidence, and untrusted context', () => {
    const request = buildOpenRouterRequest({
      model: 'provider/model',
      context,
    });
    const systemPrompt = request.messages[0].content;

    expect(systemPrompt).toMatch(/Bahasa Indonesia/i);
    expect(systemPrompt).toMatch(/1 sampai 5 tugas/i);
    expect(systemPrompt).not.toMatch(/nol tugas/i);
    expect(systemPrompt).toMatch(/dosis kimia/i);
    expect(systemPrompt).toMatch(/data tidak tepercaya/i);
    expect(systemPrompt).toMatch(/review internal/i);
    expect(systemPrompt).toMatch(/hanya.*fakta/i);
  });

  test('bounds untrusted plot and task strings before prompting', () => {
    const request = buildOpenRouterRequest({
      model: 'provider/model',
      context: {
        ...context,
        plot: { ...context.plot, name: 'x'.repeat(1_000) },
        recentTasks: Array.from({ length: 20 }, (_, index) => ({
          title: `${index}-${'y'.repeat(500)}`,
          status: 'selesai',
          scheduledFor: '2026-07-30',
        })),
      },
    });
    const sentContext = JSON.parse(request.messages[1].content);

    expect(sentContext.plot.name).toHaveLength(160);
    expect(sentContext.recentTasks).toHaveLength(10);
    expect(sentContext.recentTasks[0].title.length).toBeLessThanOrEqual(160);
    expect(request.messages[1].content.length).toBeLessThan(20_000);
  });

  test('truncates untrusted context by Unicode code point', () => {
    const request = buildOpenRouterRequest({
      model: 'provider/model',
      context: {
        ...context,
        plot: { ...context.plot, name: '🌾'.repeat(200) },
      },
    });
    const sentContext = JSON.parse(request.messages[1].content);

    expect(Array.from(sentContext.plot.name)).toHaveLength(160);
    expect(sentContext.plot.name.endsWith('🌾')).toBe(true);
  });
});

describe('parseOpenRouterDrafts', () => {
  test('rejects zero tasks', () => {
    expect(() =>
      parseOpenRouterDrafts(JSON.stringify({
        summary: 'Tidak ada pekerjaan mendesak.',
        tasks: [],
      })),
    ).toThrow(expect.objectContaining({
      code: 'OPENROUTER_INVALID_STRUCTURED_OUTPUT',
    }));
  });

  test('validates and maps provider field names to database field names', () => {
    expect(
      parseOpenRouterDrafts(JSON.stringify({
        summary: 'Satu pekerjaan aman untuk hari ini.',
        tasks: [providerDraft],
      })),
    ).toEqual({
      summary: 'Satu pekerjaan aman untuk hari ini.',
      tasks: [{
        judul: providerDraft.title,
        deskripsi: providerDraft.instruction,
        priority: 'high',
        requires_location: true,
        ai_reason: providerDraft.reason,
      }],
    });
  });

  test('uses Unicode code points for provider string boundaries', () => {
    expect(() =>
      parseOpenRouterDrafts(JSON.stringify({
        summary: 'Ringkasan valid.',
        tasks: [{ ...providerDraft, title: '🌾x' }],
      })),
    ).toThrow(expect.objectContaining({
      code: 'OPENROUTER_INVALID_STRUCTURED_OUTPUT',
    }));

    expect(
      parseOpenRouterDrafts(JSON.stringify({
        summary: 'Ringkasan valid.',
        tasks: [{ ...providerDraft, title: '🌾'.repeat(120) }],
      })).tasks[0].judul,
    ).toBe('🌾'.repeat(120));
  });

  test.each([
    ['non-JSON content', '{'],
    ['extra root property', JSON.stringify({
      summary: 'Ringkasan valid.',
      tasks: [],
      ignored: true,
    })],
    ['six tasks', JSON.stringify({
      summary: 'Terlalu banyak task.',
      tasks: Array.from({ length: 6 }, () => providerDraft),
    })],
    ['invalid priority', JSON.stringify({
      summary: 'Prioritas salah.',
      tasks: [{ ...providerDraft, priority: 'urgent' }],
    })],
    ['extra task property', JSON.stringify({
      summary: 'Properti tambahan.',
      tasks: [{ ...providerDraft, dosage: '10 ml' }],
    })],
    ['short trimmed title', JSON.stringify({
      summary: 'Judul terlalu pendek.',
      tasks: [{ ...providerDraft, title: '  x  ' }],
    })],
    ['wrong location type', JSON.stringify({
      summary: 'Tipe lokasi salah.',
      tasks: [{ ...providerDraft, requires_location: 'yes' }],
    })],
  ])('rejects %s independently from provider schema', (_label, content) => {
    expect(() => parseOpenRouterDrafts(content)).toThrow(
      expect.objectContaining({
        code: 'OPENROUTER_INVALID_STRUCTURED_OUTPUT',
      }),
    );
  });
});

describe('generateOpenRouterDrafts', () => {
  test('posts a non-streaming request and returns only bounded usage', async () => {
    const fetcher = jest.fn().mockResolvedValue(response({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Satu pekerjaan aman untuk hari ini.',
              tasks: [providerDraft],
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 80,
        total_tokens: 200,
        cost: 0.002,
        provider_internal: 'must-not-leak',
      },
    }));

    const result = await generateOpenRouterDrafts({
      apiKey: 'super-secret-key',
      model: 'provider/model',
      context,
      fetcher,
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.usage).toEqual({
      prompt_tokens: 120,
      completion_tokens: 80,
      total_tokens: 200,
      cost: 0.002,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    );
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer super-secret-key',
        'Content-Type': 'application/json',
      },
    });
    const body = JSON.parse(String(init.body));
    expect(body.stream).toBe(false);
    expect(JSON.stringify(body)).not.toContain('super-secret-key');
  });

  test('does not fall through to a later choice when choice zero is empty', async () => {
    const fetcher = jest.fn().mockResolvedValue(response({
      choices: [
        { message: { content: null } },
        {
          message: {
            content: JSON.stringify({
              summary: 'Pilihan kedua tidak boleh dipakai.',
              tasks: [],
            }),
          },
        },
      ],
    }));

    await expect(
      generateOpenRouterDrafts({
        apiKey: 'secret',
        model: 'provider/model',
        context,
        fetcher,
      }),
    ).rejects.toMatchObject({ code: 'OPENROUTER_MISSING_CONTENT' });
  });

  test.each([
    [
      'non-success',
      response({ error: { message: 'provider secret details' } }, 401),
      'OPENROUTER_REQUEST_FAILED',
    ],
    [
      'non-JSON response',
      nonJsonResponse(),
      'OPENROUTER_INVALID_RESPONSE',
    ],
    [
      'invalid structured content',
      response({
        choices: [{ message: { content: '{"summary":"x","tasks":[]}' } }],
      }),
      'OPENROUTER_INVALID_STRUCTURED_OUTPUT',
    ],
  ])('returns a safe code for %s', async (_label, providerResponse, code) => {
    const fetcher = jest.fn().mockResolvedValue(providerResponse);

    await expect(
      generateOpenRouterDrafts({
        apiKey: 'super-secret-key',
        model: 'provider/model',
        context,
        fetcher,
      }),
    ).rejects.toMatchObject({ code, message: code });
  });

  test('aborts a timed-out request and clears its timer', async () => {
    const fetcher = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    );

    await expect(
      generateOpenRouterDrafts({
        apiKey: 'secret',
        model: 'provider/model',
        context,
        fetcher,
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ code: 'OPENROUTER_TIMEOUT' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid credentials or model before calling fetch', async () => {
    const fetcher = jest.fn();

    await expect(
      generateOpenRouterDrafts({
        apiKey: '',
        model: 'provider/model',
        context,
        fetcher,
      }),
    ).rejects.toMatchObject({ code: 'OPENROUTER_INPUT_INVALID' });
    await expect(
      generateOpenRouterDrafts({
        apiKey: 'secret',
        model: ' ',
        context,
        fetcher,
      }),
    ).rejects.toMatchObject({ code: 'OPENROUTER_INPUT_INVALID' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
