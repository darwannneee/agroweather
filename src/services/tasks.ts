import type { SupabaseClient } from '@supabase/supabase-js';

import type { FarmTask, FarmTaskStatus } from '@/lib/farm-types';

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
  requires_location: boolean | null;
  unlocked_at: string | null;
};

const TASK_SELECT =
  'id,lahan_id,assigned_to,assigned_by,judul,deskripsi,status,deadline,requires_location,unlocked_at';

export function mapTaskRow(row: TaskRow): FarmTask {
  return {
    id: row.id,
    lahanId: row.lahan_id,
    assignedTo: row.assigned_to,
    assignedBy: row.assigned_by,
    judul: row.judul,
    deskripsi: row.deskripsi,
    status: row.status,
    deadline: row.deadline,
    requiresLocation: row.requires_location ?? true,
    unlockedAt: row.unlocked_at,
  };
}

export async function fetchFarmerTasks(
  farmerId: string,
  client: SupabaseClient = supabase
): Promise<FarmTask[]> {
  const { data, error } = await client
    .from('tasks')
    .select(TASK_SELECT)
    .eq('assigned_to', farmerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as TaskRow[]).map(mapTaskRow);
}

export async function fetchTaskDetail(
  taskId: string,
  client: SupabaseClient = supabase
): Promise<FarmTask> {
  const { data, error } = await client.from('tasks').select(TASK_SELECT).eq('id', taskId).single();
  if (error) throw error;
  return mapTaskRow(data as TaskRow);
}

export async function createTaskForPlot(
  input: {
    lahanId: string;
    assignedTo: string;
    assignedBy: string | null;
    judul: string;
    deskripsi: string | null;
    deadline: string | null;
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
    requires_location: true,
  });
  if (error) throw error;
}

export async function unlockTask(taskId: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client
    .from('tasks')
    .update({ unlocked_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

export async function markTaskComplete(
  taskId: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client
    .from('tasks')
    .update({ status: 'selesai' satisfies FarmTaskStatus })
    .eq('id', taskId);
  if (error) throw error;
}
