import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  EvidenceAttempt,
  EvidenceReviewStatus,
} from '@/lib/farm-types';

import { supabase } from './supabase';

type EvidenceRow = {
  id: string;
  task_id: string;
  attempt_number: number;
  photo_path: string;
  note: string | null;
  lat: number | string | null;
  lng: number | string | null;
  review_status: EvidenceReviewStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const EVIDENCE_SELECT =
  'id,task_id,attempt_number,photo_path,note,lat,lng,review_status,review_note,reviewed_at,created_at';

export function buildEvidencePath(
  farmerId: string,
  taskId: string,
  extension: string
): string {
  return `${farmerId}/${taskId}/${Date.now()}.${extension.replace(/^\./, '')}`;
}

function nullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapEvidenceAttempt(
  row: EvidenceRow,
  photoUrl: string | null
): EvidenceAttempt {
  return {
    id: row.id,
    taskId: row.task_id,
    attemptNumber: row.attempt_number,
    photoPath: row.photo_path,
    photoUrl,
    note: row.note,
    latitude: nullableNumber(row.lat),
    longitude: nullableNumber(row.lng),
    status: row.review_status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
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
},
injectedClient?: SupabaseClient
): Promise<EvidenceAttempt> {
  const client = injectedClient ?? input.client ?? supabase;
  const extension = input.contentType === 'image/png' ? 'png' : 'jpg';
  const path = buildEvidencePath(input.farmerId, input.taskId, extension);
  const bytes = await fetch(input.photoUri).then((response) => response.arrayBuffer());
  const bucket = client.storage.from('task-evidence');

  const { error: uploadError } = await bucket.upload(path, bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await client.rpc('register_task_evidence', {
    p_task_id: input.taskId,
    p_photo_path: path,
    p_note: input.note,
    p_lat: input.lat,
    p_lng: input.lng,
    p_ai_placeholder_summary: input.aiPlaceholderSummary,
  });
  if (error) {
    try {
      await bucket.remove([path]);
    } catch {
      // Cleanup is best-effort; preserve the registration error for the caller.
    }
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as EvidenceRow;
  return mapEvidenceAttempt(row, null);
}

export async function fetchTaskEvidenceAttempts(
  taskId: string,
  client: SupabaseClient = supabase
): Promise<EvidenceAttempt[]> {
  const { data, error } = await client
    .from('task_evidence')
    .select(EVIDENCE_SELECT)
    .eq('task_id', taskId)
    .order('attempt_number', { ascending: true });
  if (error) throw error;

  const bucket = client.storage.from('task-evidence');
  return Promise.all(
    ((data ?? []) as EvidenceRow[]).map(async (row) => {
      let photoUrl: string | null = null;
      try {
        const { data: signed, error: signingError } =
          await bucket.createSignedUrl(row.photo_path, 600);
        if (
          !signingError &&
          typeof signed?.signedUrl === 'string' &&
          signed.signedUrl !== row.photo_path
        ) {
          photoUrl = signed.signedUrl;
        }
      } catch {
        photoUrl = null;
      }
      return mapEvidenceAttempt(row, photoUrl);
    })
  );
}

export async function reviewTaskEvidence(
  evidenceId: string,
  decision: 'accepted' | 'revision_requested',
  note: string | null,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.rpc('review_task_evidence', {
    p_evidence_id: evidenceId,
    p_decision: decision,
    p_note: note,
  });
  if (error) throw error;
}
