import type { SupabaseClient } from '@supabase/supabase-js';

import {
  fetchTaskEvidenceAttempts,
  reviewTaskEvidence,
  uploadTaskEvidence,
} from '../evidence';

jest.mock('@react-native-async-storage/async-storage', () => ({
  clear: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../supabase', () => ({ supabase: {} }));

const evidenceRow = {
  id: 'evidence-1',
  task_id: 'task-1',
  attempt_number: 1,
  photo_path: 'farmer-1/task-1/evidence.jpg',
  note: 'Saluran sudah dibersihkan.',
  lat: -7.25,
  lng: 112.76,
  review_status: 'pending',
  review_note: null,
  reviewed_at: null,
  created_at: '2026-07-30T01:00:00.000Z',
};

const uploadInput = {
  taskId: 'task-1',
  farmerId: 'farmer-1',
  lahanId: 'plot-1',
  photoUri: 'file://evidence.jpg',
  contentType: 'image/jpeg',
  note: 'Saluran sudah dibersihkan.',
  lat: -7.25,
  lng: 112.76,
  aiPlaceholderSummary: null,
};

function uploadClient(input?: {
  registrationError?: Error;
  cleanupError?: Error;
}) {
  const upload = jest.fn().mockResolvedValue({ error: null });
  const remove = jest.fn().mockResolvedValue({
    error: input?.cleanupError ?? null,
  });
  const createSignedUrl = jest.fn();
  const bucket = { upload, remove, createSignedUrl };
  const from = jest.fn(() => bucket);
  const rpc = jest.fn().mockResolvedValue({
    data: input?.registrationError ? null : evidenceRow,
    error: input?.registrationError ?? null,
  });
  const client = {
    storage: { from },
    rpc,
  } as unknown as SupabaseClient;

  return { client, from, upload, remove, rpc };
}

describe('evidence upload registration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
    } as unknown as Response);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('registers an uploaded object through the constrained RPC and returns a pending attempt', async () => {
    const { client, rpc, upload } = uploadClient();

    await expect(uploadTaskEvidence(uploadInput, client)).resolves.toEqual({
      id: 'evidence-1',
      taskId: 'task-1',
      attemptNumber: 1,
      photoPath: 'farmer-1/task-1/evidence.jpg',
      photoUrl: null,
      note: 'Saluran sudah dibersihkan.',
      latitude: -7.25,
      longitude: 112.76,
      status: 'pending',
      reviewNote: null,
      reviewedAt: null,
      createdAt: '2026-07-30T01:00:00.000Z',
    });

    const uploadedPath = upload.mock.calls[0][0] as string;
    expect(uploadedPath).toMatch(/^farmer-1\/task-1\/[0-9]+\.jpg$/);
    expect(rpc).toHaveBeenCalledWith('register_task_evidence', {
      p_task_id: 'task-1',
      p_photo_path: uploadedPath,
      p_note: 'Saluran sudah dibersihkan.',
      p_lat: -7.25,
      p_lng: 112.76,
      p_ai_placeholder_summary: null,
    });
  });

  test('best-effort removes the exact object and rethrows the original registration error', async () => {
    const registrationError = new Error('raw registration detail');
    const { client, upload, remove } = uploadClient({
      registrationError,
      cleanupError: new Error('cleanup also failed'),
    });

    await expect(uploadTaskEvidence(uploadInput, client)).rejects.toBe(
      registrationError
    );

    const uploadedPath = upload.mock.calls[0][0] as string;
    expect(remove).toHaveBeenCalledWith([uploadedPath]);
  });
});

describe('evidence attempt reads and review', () => {
  test('maps attempts and uses null when a private object cannot be signed', async () => {
    const rows = [
      evidenceRow,
      {
        ...evidenceRow,
        id: 'evidence-2',
        attempt_number: 2,
        photo_path: 'farmer-1/task-1/revision.jpg',
        review_status: 'revision_requested',
        review_note: 'Foto terlalu gelap.',
        reviewed_at: '2026-07-30T02:00:00.000Z',
        created_at: '2026-07-30T01:30:00.000Z',
      },
    ];
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    const createSignedUrl = jest
      .fn()
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://signed.example/evidence-1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: new Error('signing failed'),
      });
    const bucket = { createSignedUrl };
    const client = {
      from: jest.fn(() => ({ select })),
      storage: { from: jest.fn(() => bucket) },
    } as unknown as SupabaseClient;

    const attempts = await fetchTaskEvidenceAttempts('task-1', client);

    expect(eq).toHaveBeenCalledWith('task_id', 'task-1');
    expect(order).toHaveBeenCalledWith('attempt_number', { ascending: true });
    expect(createSignedUrl).toHaveBeenNthCalledWith(
      1,
      'farmer-1/task-1/evidence.jpg',
      600
    );
    expect(attempts).toEqual([
      expect.objectContaining({
        id: 'evidence-1',
        photoPath: 'farmer-1/task-1/evidence.jpg',
        photoUrl: 'https://signed.example/evidence-1',
      }),
      expect.objectContaining({
        id: 'evidence-2',
        photoPath: 'farmer-1/task-1/revision.jpg',
        photoUrl: null,
      }),
    ]);
    expect(attempts.map(({ photoUrl }) => photoUrl)).not.toContain(
      'farmer-1/task-1/evidence.jpg'
    );
  });

  test('reviews evidence through the atomic transition RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: evidenceRow, error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(
      reviewTaskEvidence(
        'evidence-1',
        'revision_requested',
        'Ambil foto yang lebih terang.',
        client
      )
    ).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('review_task_evidence', {
      p_evidence_id: 'evidence-1',
      p_decision: 'revision_requested',
      p_note: 'Ambil foto yang lebih terang.',
    });
  });

  test('rethrows the original review error without converting it to UI copy', async () => {
    const reviewError = new Error('raw database review detail');
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: reviewError }),
    } as unknown as SupabaseClient;

    await expect(
      reviewTaskEvidence('evidence-1', 'accepted', null, client)
    ).rejects.toBe(reviewError);
  });
});
