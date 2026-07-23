import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from './supabase';

export function buildEvidencePath(farmerId: string, taskId: string, extension: string): string {
  return `${farmerId}/${taskId}/${Date.now()}.${extension.replace(/^\./, '')}`;
}

export async function countTaskEvidence(
  taskId: string,
  client: SupabaseClient = supabase
): Promise<number> {
  const { count, error } = await client
    .from('task_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId);
  if (error) throw error;
  return count ?? 0;
}

export async function uploadTaskEvidence(input: {
  taskId: string;
  farmerId: string;
  lahanId: string;
  photoUri: string;
  contentType: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  aiPlaceholderSummary: string | null;
  client?: SupabaseClient;
}): Promise<{ id: string; path: string }> {
  const client = input.client ?? supabase;
  const extension = input.contentType === 'image/png' ? 'png' : 'jpg';
  const path = buildEvidencePath(input.farmerId, input.taskId, extension);
  const bytes = await fetch(input.photoUri).then((response) => response.arrayBuffer());

  const { error: uploadError } = await client.storage
    .from('task-evidence')
    .upload(path, bytes, { contentType: input.contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await client
    .from('task_evidence')
    .insert({
      task_id: input.taskId,
      farmer_id: input.farmerId,
      lahan_id: input.lahanId,
      photo_path: path,
      note: input.note,
      lat: input.lat,
      lng: input.lng,
      ai_placeholder_summary: input.aiPlaceholderSummary,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id as string, path };
}
