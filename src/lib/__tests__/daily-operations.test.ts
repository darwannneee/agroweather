import {
  deriveTaskOperationalState,
  jakartaDate,
  sortDailyTasks,
} from '../daily-operations';
import type { FarmTask } from '../farm-types';

const task = (overrides: Partial<FarmTask> = {}): FarmTask => ({
  id: 'task-1',
  lahanId: 'plot-1',
  assignedTo: 'farmer-1',
  assignedBy: 'internal-1',
  judul: 'Periksa irigasi',
  deskripsi: null,
  status: 'belum_dikerjakan',
  deadline: null,
  scheduledFor: '2026-07-30',
  priority: 'medium',
  source: 'ai',
  aiReason: 'Hujan rendah.',
  requiresLocation: true,
  unlockedAt: null,
  latestEvidence: null,
  ...overrides,
});

test('formats the calendar date in Asia/Jakarta', () => {
  expect(jakartaDate(new Date('2026-07-29T22:00:00.000Z'))).toBe('2026-07-30');
});

test.each([
  [task(), 'not-started'],
  [task({ latestEvidence: { status: 'pending', reviewNote: null } }), 'pending-review'],
  [task({ latestEvidence: { status: 'revision_requested', reviewNote: 'Foto ulang' } }), 'revision-needed'],
  [
    task({
      status: 'selesai',
      latestEvidence: { status: 'accepted', reviewNote: null },
    }),
    'completed',
  ],
])('derives evidence-aware task state', (input, expected) => {
  expect(deriveTaskOperationalState(input)).toBe(expected);
});

test('orders revision, high priority, pending, then completed', () => {
  const result = sortDailyTasks([
    task({
      id: 'done',
      status: 'selesai',
      latestEvidence: { status: 'accepted', reviewNote: null },
    }),
    task({
      id: 'pending',
      latestEvidence: { status: 'pending', reviewNote: null },
    }),
    task({ id: 'normal' }),
    task({ id: 'high', priority: 'high' }),
    task({
      id: 'revision',
      latestEvidence: {
        status: 'revision_requested',
        reviewNote: 'Ulangi',
      },
    }),
  ]);

  expect(result.map(({ id }) => id)).toEqual([
    'revision',
    'high',
    'normal',
    'pending',
    'done',
  ]);
});
