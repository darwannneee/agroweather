import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  EvidenceReviewStatus,
  FarmTask,
  FarmTaskStatus,
  LatestEvidenceSummary,
  TaskPriority,
  TaskSource,
} from '@/lib/farm-types';
import { jakartaDate } from '@/lib/daily-operations';

import { supabase } from './supabase';

export type TaskRow = {
  id: string;
  lahan_id: string;
  assigned_to: string;
  assigned_by: string | null;
  judul: string;
  deskripsi: string | null;
  status: FarmTaskStatus;
  deadline: string | null;
  scheduled_for: string;
  priority: TaskPriority;
  source: TaskSource;
  ai_reason: string | null;
  requires_location: boolean | null;
  unlocked_at: string | null;
};

export type LatestTaskEvidenceRow = {
  task_id: string;
  review_status: EvidenceReviewStatus;
  review_note: string | null;
  created_at: string;
};

type LatestTaskEvidenceSummaryRow =
  Pick<LatestTaskEvidenceRow, 'review_status' | 'review_note'>
  & Partial<Pick<LatestTaskEvidenceRow, 'task_id' | 'created_at'>>;

export const TASK_SELECT =
  'id,lahan_id,assigned_to,assigned_by,judul,deskripsi,status,deadline,scheduled_for,priority,source,ai_reason,requires_location,unlocked_at';

const LATEST_EVIDENCE_SELECT =
  'task_id,review_status,review_note,created_at';

export function mapTaskRow(
  row: TaskRow,
  latestEvidence: LatestTaskEvidenceSummaryRow | null = null
): FarmTask {
  return {
    id: row.id,
    lahanId: row.lahan_id,
    assignedTo: row.assigned_to,
    assignedBy: row.assigned_by,
    judul: row.judul,
    deskripsi: row.deskripsi,
    status: row.status,
    deadline: row.deadline,
    scheduledFor: row.scheduled_for,
    priority: row.priority,
    source: row.source,
    aiReason: row.ai_reason,
    requiresLocation: row.requires_location ?? true,
    unlockedAt: row.unlocked_at,
    latestEvidence: latestEvidence
      ? {
          status: latestEvidence.review_status,
          reviewNote: latestEvidence.review_note,
        }
      : null,
  };
}

export function latestEvidenceByTask(
  rows: LatestTaskEvidenceRow[]
): Map<string, LatestEvidenceSummary> {
  const latest = new Map<string, LatestEvidenceSummary>();

  for (const row of rows) {
    if (!latest.has(row.task_id)) {
      latest.set(row.task_id, {
        status: row.review_status,
        reviewNote: row.review_note,
      });
    }
  }

  return latest;
}

export async function fetchFarmerTasks(
  farmerId: string,
  scheduledFor: string = jakartaDate(),
  client: SupabaseClient = supabase
): Promise<FarmTask[]> {
  const { data, error } = await client
    .from('tasks')
    .select(TASK_SELECT)
    .eq('assigned_to', farmerId)
    .eq('scheduled_for', scheduledFor)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const taskRows = (data ?? []) as TaskRow[];
  if (taskRows.length === 0) return [];

  const { data: evidenceData, error: evidenceError } = await client
    .from('task_evidence')
    .select(LATEST_EVIDENCE_SELECT)
    .in('task_id', taskRows.map(({ id }) => id))
    .order('created_at', { ascending: false });
  if (evidenceError) throw evidenceError;

  const latestEvidence = latestEvidenceByTask(
    (evidenceData ?? []) as LatestTaskEvidenceRow[]
  );

  return taskRows.map((row) => {
    const evidence = latestEvidence.get(row.id);
    return mapTaskRow(
      row,
      evidence
        ? {
            review_status: evidence.status,
            review_note: evidence.reviewNote,
          }
        : null
    );
  });
}

export async function fetchTaskDetail(
  taskId: string,
  client: SupabaseClient = supabase
): Promise<FarmTask> {
  const { data, error } = await client.from('tasks').select(TASK_SELECT).eq('id', taskId).single();
  if (error) throw error;

  const { data: evidence, error: evidenceError } = await client
    .from('task_evidence')
    .select(LATEST_EVIDENCE_SELECT)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (evidenceError) throw evidenceError;

  return mapTaskRow(data as TaskRow, evidence as LatestTaskEvidenceRow | null);
}

export async function createTaskForPlot(
  input: {
    lahanId: string;
    assignedTo: string;
    assignedBy: string | null;
    judul: string;
    deskripsi: string | null;
    deadline: string | null;
    scheduledFor: string;
    priority: TaskPriority;
    requiresLocation: boolean;
  },
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.from('tasks').insert({
    lahan_id: input.lahanId,
    assigned_to: input.assignedTo,
    assigned_by: input.assignedBy,
    judul: input.judul.trim(),
    deskripsi: input.deskripsi?.trim() || null,
    deadline: input.deadline,
    scheduled_for: input.scheduledFor,
    priority: input.priority,
    source: 'manual' satisfies TaskSource,
    requires_location: input.requiresLocation,
  });
  if (error) throw error;
}

export async function startTask(
  taskId: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.rpc('start_assigned_task', {
    p_task_id: taskId,
  });
  if (error) throw error;
}
