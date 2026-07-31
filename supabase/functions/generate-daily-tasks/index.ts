import { createClient } from 'npm:@supabase/supabase-js@2';

import { jakartaDate } from '../_shared/daily-date.ts';
import { generateDailyTasks } from '../_shared/generator.ts';
import {
  createSupabaseGenerationDependencies,
} from '../_shared/supabase-generation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-agroweather-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const required = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error('SERVER_CONFIGURATION_ERROR');
  }
  return value;
};

const safeJson = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

const parsePlotIds = async (
  request: Request,
): Promise<string[] | undefined> => {
  const raw = await request.json().catch(() => {
    throw new HttpError(400, 'INVALID_JSON');
  });
  if (
    raw === null
    || typeof raw !== 'object'
    || Array.isArray(raw)
    || Object.keys(raw).some((key) => key !== 'plotIds')
  ) {
    throw new HttpError(400, 'INVALID_BODY');
  }

  const body = raw as Record<string, unknown>;
  if (body.plotIds === undefined) {
    return undefined;
  }
  if (!Array.isArray(body.plotIds) || body.plotIds.length > 100) {
    throw new HttpError(400, 'INVALID_PLOT_IDS');
  }
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (
    body.plotIds.some((id) =>
      typeof id !== 'string' || !uuid.test(id)
    )
  ) {
    throw new HttpError(400, 'INVALID_PLOT_IDS');
  }
  return [
    ...new Set(
      (body.plotIds as string[]).map((id) => id.toLowerCase()),
    ),
  ];
};

const authenticateRequest = async (
  request: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<{
  trigger: 'cron' | 'manual';
  requestedBy: string | null;
}> => {
  const cronSecret = request.headers.get(
    'x-agroweather-cron-secret',
  );
  if (
    cronSecret !== null
    && cronSecret === required('CRON_SHARED_SECRET')
  ) {
    return { trigger: 'cron', requestedBy: null };
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHENTICATED');
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    throw new HttpError(401, 'UNAUTHENTICATED');
  }

  const { data: profile, error: profileError } = await userClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || profile?.role !== 'internal') {
    throw new HttpError(403, 'FORBIDDEN');
  }
  return { trigger: 'manual', requestedBy: user.id };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  if (request.method !== 'POST') {
    return safeJson(405, { error: 'Metode tidak didukung.' });
  }

  try {
    const supabaseUrl = required('SUPABASE_URL');
    const anonKey = required('SUPABASE_ANON_KEY');
    const auth = await authenticateRequest(
      request,
      supabaseUrl,
      anonKey,
    );
    const plotIds = await parsePlotIds(request);
    const admin = createClient(
      supabaseUrl,
      required('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
    const dependencies = createSupabaseGenerationDependencies({
      admin,
      openWeatherApiKey: required('OPENWEATHER_API_KEY'),
      openRouterApiKey: required('OPENROUTER_API_KEY'),
      openRouterModel: required('OPENROUTER_MODEL'),
    });
    const result = await generateDailyTasks({
      trigger: auth.trigger,
      requestedBy: auth.requestedBy,
      scheduledFor: jakartaDate(),
      plotIds,
    }, dependencies);

    return safeJson(200, result);
  } catch (error) {
    if (error instanceof HttpError) {
      const message = error.status === 401
        ? 'Silakan masuk kembali.'
        : error.status === 403
        ? 'Akses ditolak.'
        : 'Permintaan tidak valid.';
      return safeJson(error.status, {
        error: message,
        code: error.code,
      });
    }

    console.error('generate-daily-tasks failed', {
      code: 'GENERATION_FAILED',
    });
    return safeJson(500, {
      error: 'Generate task belum berhasil. Coba lagi.',
    });
  }
});
