import { render, screen } from '@testing-library/react-native';

import type {
  EvidenceAttempt,
  EvidenceReviewStatus,
} from '@/lib/farm-types';

import { EvidenceAttemptCard } from '../evidence-attempt-card';

const attempt: EvidenceAttempt = {
  id: 'evidence-1',
  taskId: 'task-1',
  attemptNumber: 2,
  photoPath: 'farmer-1/task-1/photo.jpg',
  photoUrl: 'https://signed.example/photo',
  note: 'Saluran dibersihkan',
  latitude: -7.25,
  longitude: 112.76,
  status: 'revision_requested',
  reviewNote: 'Ambil foto lebih dekat',
  reviewedAt: '2026-07-30T02:00:00Z',
  createdAt: '2026-07-30T01:00:00Z',
};

test('announces attempt photo, farmer note, and reviewer note', () => {
  render(<EvidenceAttemptCard attempt={attempt} />);

  expect(screen.getByText('Percobaan 2')).toBeOnTheScreen();
  expect(screen.getByText('Perlu perbaikan')).toBeOnTheScreen();
  expect(screen.getByLabelText('Foto bukti percobaan 2')).toBeOnTheScreen();
  expect(screen.getByText('Catatan petani: Saluran dibersihkan')).toBeOnTheScreen();
  expect(
    screen.getByText('Catatan reviewer: Ambil foto lebih dekat')
  ).toBeOnTheScreen();
});

test.each([
  ['pending', 'Menunggu review'],
  ['accepted', 'Diterima'],
  ['revision_requested', 'Perlu perbaikan'],
] satisfies [EvidenceReviewStatus, string][])(
  'maps %s review status to %s',
  (status, label) => {
    render(
      <EvidenceAttemptCard
        attempt={{
          ...attempt,
          status,
          reviewNote: null,
        }}
      />
    );

    expect(screen.getByText(label)).toBeOnTheScreen();
  }
);
