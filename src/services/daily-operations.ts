import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AttendanceRecord,
  DashboardWeatherSummary,
  GenerationStatus,
  OperationalTask,
} from '@/lib/farm-types';

import {
  mapAttendanceRow,
  type AttendanceRow,
} from './attendance';
import { supabase } from './supabase';
import {
  latestEvidenceByTask,
  mapTaskRow,
  TASK_SELECT,
  type LatestTaskEvidenceRow,
  type TaskRow,
} from './tasks';
import { fetchLatestWeatherSummaries } from './weather';

export type DailyOperations = {
  scheduledFor: string;
  attendance: {
    farmerId: string;
    farmerName: string;
    status: 'present' | 'absent';
    record: AttendanceRecord | null;
  }[];
  tasks: OperationalTask[];
  weather?: DashboardWeatherSummary[];
  pendingDraftCount: number;
  lastGeneration: {
    status: GenerationStatus;
    completedAt: string | null;
    successCount: number;
    skippedCount: number;
    failedCount: number;
  } | null;
};

type FarmerRow = {
  id: string;
  nama: string;
};

type DisplayRelation = { nama: string } | { nama: string }[] | null;
type PlotDisplayRelation =
  | { nama_lahan: string }
  | { nama_lahan: string }[]
  | null;

type DailyTaskRow = TaskRow & {
  lahan: PlotDisplayRelation;
  assigned_user: DisplayRelation;
};

type GenerationRow = {
  status: GenerationStatus;
  completed_at: string | null;
  success_count: number;
  skipped_count: number;
  failed_count: number;
};

const DAILY_ATTENDANCE_SELECT =
  'id,farmer_id,lahan_id,attendance_date,waktu_masuk,distance_m,lat,lng,lahan(nama_lahan),users!absensi_farmer_id_fkey(nama)';
const DAILY_TASK_SELECT =
  `${TASK_SELECT},lahan!tasks_lahan_id_fkey(nama_lahan),assigned_user:users!tasks_assigned_to_fkey(nama)`;
const LATEST_EVIDENCE_SELECT =
  'task_id,review_status,review_note,created_at';

function firstRelation<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function mapLastGeneration(
  row: GenerationRow | null
): DailyOperations['lastGeneration'] {
  return row
    ? {
        status: row.status,
        completedAt: row.completed_at,
        successCount: safeCount(row.success_count),
        skippedCount: safeCount(row.skipped_count),
        failedCount: safeCount(row.failed_count),
      }
    : null;
}

export async function fetchDailyOperations(
  scheduledFor: string,
  client: SupabaseClient = supabase
): Promise<DailyOperations> {
  const [
    farmerResult,
    attendanceResult,
    taskResult,
    draftResult,
    generationResult,
    weather,
  ] = await Promise.all([
    client
      .from('users')
      .select('id,nama')
      .eq('role', 'farmer')
      .order('nama', { ascending: true }),
    client
      .from('absensi')
      .select(DAILY_ATTENDANCE_SELECT)
      .eq('attendance_date', scheduledFor)
      .eq('status_geofence', 'valid')
      .order('waktu_masuk', { ascending: true }),
    client
      .from('tasks')
      .select(DAILY_TASK_SELECT)
      .eq('scheduled_for', scheduledFor)
      .order('created_at', { ascending: false }),
    client
      .from('ai_task_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_for', scheduledFor)
      .eq('status', 'pending'),
    client
      .from('ai_generation_runs')
      .select(
        'status,completed_at,success_count,skipped_count,failed_count'
      )
      .eq('scheduled_for', scheduledFor)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchLatestWeatherSummaries({ client, limit: 50 }),
  ]);

  if (farmerResult.error) throw farmerResult.error;
  if (attendanceResult.error) throw attendanceResult.error;
  if (taskResult.error) throw taskResult.error;
  if (draftResult.error) throw draftResult.error;
  if (generationResult.error) throw generationResult.error;

  const taskRows = (taskResult.data ?? []) as unknown as DailyTaskRow[];
  let evidenceRows: LatestTaskEvidenceRow[] = [];
  if (taskRows.length > 0) {
    const { data, error } = await client
      .from('task_evidence')
      .select(LATEST_EVIDENCE_SELECT)
      .in('task_id', taskRows.map(({ id }) => id))
      .order('created_at', { ascending: false });
    if (error) throw error;
    evidenceRows = (data ?? []) as LatestTaskEvidenceRow[];
  }

  const attendanceByFarmer = new Map<string, AttendanceRecord>();
  for (const row of (attendanceResult.data ?? []) as unknown as AttendanceRow[]) {
    if (!attendanceByFarmer.has(row.farmer_id)) {
      attendanceByFarmer.set(row.farmer_id, mapAttendanceRow(row));
    }
  }

  const attendance = (
    (farmerResult.data ?? []) as unknown as FarmerRow[]
  ).map((farmer) => {
    const record = attendanceByFarmer.get(farmer.id) ?? null;
    return {
      farmerId: farmer.id,
      farmerName: farmer.nama,
      status: record ? 'present' as const : 'absent' as const,
      record,
    };
  });

  const evidenceByTask = latestEvidenceByTask(evidenceRows);
  const tasks = taskRows.map((row): OperationalTask => {
    const plotName = firstRelation(row.lahan)?.nama_lahan?.trim();
    const farmerName = firstRelation(row.assigned_user)?.nama?.trim();
    if (!plotName || !farmerName) {
      throw new Error('DAILY_TASK_DISPLAY_DATA_MISSING');
    }
    const evidence = evidenceByTask.get(row.id);

    return {
      task: mapTaskRow(
        row,
        evidence
          ? {
              review_status: evidence.status,
              review_note: evidence.reviewNote,
            }
          : null
      ),
      plotName,
      farmerName,
    };
  });

  return {
    scheduledFor,
    attendance,
    tasks,
    weather,
    pendingDraftCount: safeCount(draftResult.count),
    lastGeneration: mapLastGeneration(
      generationResult.data as unknown as GenerationRow | null
    ),
  };
}
