import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AiDraftStatus,
  AiTaskDraft,
  DraftWeatherSummary,
  GenerationStatus,
  TaskPriority,
} from '@/lib/farm-types';

import { supabase } from './supabase';

type NamedRelation = { nama: string } | { nama: string }[] | null;
type PlotRelation =
  | { nama_lahan: string }
  | { nama_lahan: string }[]
  | null;

type WeatherSnapshotRow = {
  observed_at: string;
  current_data: unknown;
  forecast_data: unknown;
};

export type AiTaskDraftRow = {
  id: string;
  lahan_id: string;
  proposed_assignee_id: string;
  scheduled_for: string;
  judul: string;
  deskripsi: string;
  priority: TaskPriority;
  requires_location: boolean;
  ai_reason: string;
  status: AiDraftStatus;
  model: string;
  created_at: string;
  lahan: PlotRelation;
  proposed_assignee: NamedRelation;
  weather_snapshot: WeatherSnapshotRow | WeatherSnapshotRow[] | null;
};

export type GenerationWarning = {
  plotId: string;
  code:
    | 'plot_unassigned'
    | 'weather_unavailable'
    | 'model_error'
    | 'invalid_model_output'
    | 'persistence_error';
};

export type GenerationInvocationResult = {
  runId: string;
  status: GenerationStatus;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  draftCount: number;
  warnings: GenerationWarning[];
};

type GenerationTargetStatus = 'running' | 'succeeded' | 'skipped' | 'failed';

export type AiGenerationTargetLog = {
  id: string;
  plotId: string;
  plotName: string;
  status: GenerationTargetStatus;
  draftCount: number;
  errorCode: GenerationWarning['code'] | null;
  summary: string | null;
  isCurrent: boolean;
  version: number;
  createdAt: string;
  completedAt: string | null;
};

export type AiGenerationLog = {
  runId: string;
  trigger: 'cron' | 'manual';
  scheduledFor: string;
  status: GenerationStatus;
  model: string;
  plotCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  draftCount: number;
  warnings: GenerationWarning[];
  startedAt: string;
  completedAt: string | null;
  targets: AiGenerationTargetLog[];
};

export type ApproveAiDraftInput = {
  draftId: string;
  assigneeId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  requiresLocation: boolean;
};

const DRAFT_SELECT =
  'id,lahan_id,proposed_assignee_id,scheduled_for,judul,deskripsi,priority,requires_location,ai_reason,status,model,created_at,lahan!ai_task_drafts_lahan_id_fkey(nama_lahan),proposed_assignee:users!ai_task_drafts_proposed_assignee_id_fkey(nama),weather_snapshot:weather_snapshots!ai_task_drafts_weather_snapshot_id_fkey(observed_at,current_data,forecast_data)';
const GENERATION_RUN_SELECT =
  'id,trigger,scheduled_for,status,model,plot_count,success_count,skipped_count,failed_count,warning_summary,started_at,completed_at';
const GENERATION_TARGET_SELECT =
  'id,run_id,lahan_id,scheduled_for,status,draft_count,error_code,result_summary,is_current,version,created_at,completed_at,lahan!ai_generation_targets_lahan_id_fkey(nama_lahan)';

const warningCodes = new Set<GenerationWarning['code']>([
  'plot_unassigned',
  'weather_unavailable',
  'model_error',
  'invalid_model_output',
  'persistence_error',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(value)))
    : fallback;
}

function safeText(value: unknown, maximum: number): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maximum)
    : null;
}

function relationName(
  relation: NamedRelation | PlotRelation,
  key: 'nama' | 'nama_lahan'
): string | null {
  const value = Array.isArray(relation) ? relation[0] : relation;
  if (!value) return null;
  const name = key === 'nama'
    ? 'nama' in value ? value.nama : null
    : 'nama_lahan' in value ? value.nama_lahan : null;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function mapWeatherSummary(
  snapshotRelation: AiTaskDraftRow['weather_snapshot']
): DraftWeatherSummary {
  const snapshot = Array.isArray(snapshotRelation)
    ? snapshotRelation[0]
    : snapshotRelation;
  const current = asRecord(snapshot?.current_data);
  const forecast = Array.isArray(snapshot?.forecast_data)
    ? snapshot.forecast_data.slice(0, 8).map(asRecord)
    : [];
  const minimums = forecast
    .map((point) => nullableBoundedNumber(
      point.minTemperatureC,
      -100,
      100
    ))
    .filter((value): value is number => value !== null);
  const maximums = forecast
    .map((point) => nullableBoundedNumber(
      point.maxTemperatureC,
      -100,
      100
    ))
    .filter((value): value is number => value !== null);
  const probabilities = forecast
    .map((point) => nullableBoundedNumber(point.rainProbability, 0, 1))
    .filter((value): value is number => value !== null);
  const description =
    typeof current.description === 'string' && current.description.trim()
      ? current.description.trim().slice(0, 160)
      : 'Cuaca tidak tersedia';

  return {
    observedAt:
      typeof snapshot?.observed_at === 'string'
        ? snapshot.observed_at
        : '',
    description,
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

function mapGenerationWarnings(value: unknown): GenerationWarning[] {
  return Array.isArray(value)
    ? value.slice(0, 100).flatMap((entry) => {
        const warning = asRecord(entry);
        return typeof warning.plotId === 'string'
          && warningCodes.has(warning.code as GenerationWarning['code'])
          ? [{
              plotId: warning.plotId,
              code: warning.code as GenerationWarning['code'],
            }]
          : [];
      })
    : [];
}

export function mapAiDraftRow(row: AiTaskDraftRow): AiTaskDraft {
  const plotName = relationName(row.lahan, 'nama_lahan');
  const assigneeName = relationName(row.proposed_assignee, 'nama');
  if (!plotName || !assigneeName) {
    throw new Error('AI_DRAFT_DISPLAY_DATA_MISSING');
  }

  return {
    id: row.id,
    plotId: row.lahan_id,
    plotName,
    proposedAssigneeId: row.proposed_assignee_id,
    proposedAssigneeName: assigneeName,
    scheduledFor: row.scheduled_for,
    title: row.judul,
    description: row.deskripsi,
    priority: row.priority,
    requiresLocation: row.requires_location,
    aiReason: row.ai_reason,
    status: row.status,
    model: row.model,
    weather: mapWeatherSummary(row.weather_snapshot),
    createdAt: row.created_at,
  };
}

export async function fetchAiDrafts(input: {
  scheduledFor: string;
  status?: AiDraftStatus;
  client?: SupabaseClient;
}): Promise<AiTaskDraft[]> {
  const client = input.client ?? supabase;
  let query = client
    .from('ai_task_drafts')
    .select(DRAFT_SELECT)
    .eq('scheduled_for', input.scheduledFor);
  if (input.status) {
    query = query.eq('status', input.status);
  }

  const { data, error } = await query.order('created_at', {
    ascending: false,
  });
  if (error) throw error;

  return ((data ?? []) as unknown as AiTaskDraftRow[]).map(mapAiDraftRow);
}

export async function fetchAiDraftById(
  draftId: string,
  client: SupabaseClient = supabase
): Promise<AiTaskDraft> {
  const { data, error } = await client
    .from('ai_task_drafts')
    .select(DRAFT_SELECT)
    .eq('id', draftId)
    .single();
  if (error) throw error;

  return mapAiDraftRow(data as unknown as AiTaskDraftRow);
}

function mapGenerationResult(value: unknown): GenerationInvocationResult {
  const row = asRecord(value);
  const status = row.status;
  const allowedStatuses = new Set<GenerationStatus>([
    'succeeded',
    'partial',
    'failed',
  ]);
  if (
    typeof row.runId !== 'string'
    || !allowedStatuses.has(status as GenerationStatus)
  ) {
    throw new Error('GENERATION_RESPONSE_INVALID');
  }

  return {
    runId: row.runId,
    status: status as GenerationStatus,
    successCount: boundedInteger(row.successCount, 0, 10_000, 0),
    skippedCount: boundedInteger(row.skippedCount, 0, 10_000, 0),
    failedCount: boundedInteger(row.failedCount, 0, 10_000, 0),
    draftCount: boundedInteger(row.draftCount, 0, 10_000, 0),
    warnings: mapGenerationWarnings(row.warnings),
  };
}

type GenerationRunRow = {
  id: string;
  trigger: 'cron' | 'manual';
  scheduled_for: string;
  status: GenerationStatus;
  model: string;
  plot_count: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  warning_summary: unknown;
  started_at: string;
  completed_at: string | null;
};

type GenerationTargetRow = {
  id: string;
  lahan_id: string;
  status: GenerationTargetStatus;
  draft_count: number;
  error_code: string | null;
  result_summary: string | null;
  is_current: boolean;
  version: number;
  created_at: string;
  completed_at: string | null;
  lahan: PlotRelation;
};

function mapGenerationTargetLog(
  row: GenerationTargetRow
): AiGenerationTargetLog {
  const plotName = relationName(row.lahan, 'nama_lahan');
  if (!plotName) {
    throw new Error('AI_GENERATION_TARGET_DISPLAY_DATA_MISSING');
  }
  const errorCode = safeText(row.error_code, 120);

  return {
    id: row.id,
    plotId: row.lahan_id,
    plotName,
    status: row.status,
    draftCount: boundedInteger(row.draft_count, 0, 5, 0),
    errorCode: errorCode !== null
      && warningCodes.has(errorCode as GenerationWarning['code'])
      ? errorCode as GenerationWarning['code']
      : null,
    summary: safeText(row.result_summary, 2_000),
    isCurrent: row.is_current === true,
    version: boundedInteger(row.version, 1, 10_000, 1),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapGenerationLog(
  run: GenerationRunRow,
  targets: GenerationTargetRow[]
): AiGenerationLog {
  return {
    runId: run.id,
    trigger: run.trigger,
    scheduledFor: run.scheduled_for,
    status: run.status,
    model: run.model,
    plotCount: boundedInteger(run.plot_count, 0, 10_000, 0),
    successCount: boundedInteger(run.success_count, 0, 10_000, 0),
    skippedCount: boundedInteger(run.skipped_count, 0, 10_000, 0),
    failedCount: boundedInteger(run.failed_count, 0, 10_000, 0),
    draftCount: targets.reduce(
      (total, target) =>
        total + boundedInteger(target.draft_count, 0, 5, 0),
      0
    ),
    warnings: mapGenerationWarnings(run.warning_summary),
    startedAt: run.started_at,
    completedAt: run.completed_at,
    targets: targets.map(mapGenerationTargetLog),
  };
}

export async function invokeAiGeneration(
  plotIds: string[],
  client: SupabaseClient = supabase
): Promise<GenerationInvocationResult> {
  const { data, error } = await client.functions.invoke(
    'generate-daily-tasks',
    { body: { plotIds } }
  );
  if (error) throw error;

  return mapGenerationResult(data);
}

export async function fetchLatestAiGenerationLog(input: {
  scheduledFor: string;
  client?: SupabaseClient;
}): Promise<AiGenerationLog | null> {
  const client = input.client ?? supabase;
  const runResult = await client
    .from('ai_generation_runs')
    .select(GENERATION_RUN_SELECT)
    .eq('scheduled_for', input.scheduledFor)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runResult.error) throw runResult.error;
  if (!runResult.data) return null;

  const run = runResult.data as unknown as GenerationRunRow;
  const targetResult = await client
    .from('ai_generation_targets')
    .select(GENERATION_TARGET_SELECT)
    .eq('run_id', run.id)
    .order('created_at', { ascending: true });
  if (targetResult.error) throw targetResult.error;

  return mapGenerationLog(
    run,
    (targetResult.data ?? []) as unknown as GenerationTargetRow[]
  );
}

export async function approveAiDraft(
  input: ApproveAiDraftInput,
  client: SupabaseClient = supabase
): Promise<string> {
  const { data, error } = await client.rpc('approve_ai_task_draft', {
    p_draft_id: input.draftId,
    p_assignee_id: input.assigneeId,
    p_judul: input.title.trim(),
    p_deskripsi: input.description.trim(),
    p_priority: input.priority,
    p_requires_location: input.requiresLocation,
  });
  if (error) throw error;
  if (typeof data !== 'string') {
    throw new Error('DRAFT_APPROVAL_RESPONSE_INVALID');
  }

  return data;
}

export async function approveAiDrafts(
  draftIds: string[],
  client: SupabaseClient = supabase
): Promise<string[]> {
  const { data, error } = await client.rpc('bulk_approve_ai_task_drafts', {
    p_draft_ids: draftIds,
  });
  if (error) throw error;
  if (!Array.isArray(data) || data.some((id) => typeof id !== 'string')) {
    throw new Error('DRAFT_APPROVAL_RESPONSE_INVALID');
  }

  return data as string[];
}

export async function rejectAiDraft(
  draftId: string,
  reason: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.rpc('reject_ai_task_draft', {
    p_draft_id: draftId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}
