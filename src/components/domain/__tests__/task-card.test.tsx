import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FarmTask } from '@/lib/farm-types';

import { TaskCard, type TaskCardState } from '../task-card';

const task: FarmTask = {
  id: 'task-a',
  lahanId: 'plot-a',
  assignedTo: 'farmer-1',
  assignedBy: 'internal-1',
  judul: 'Bersihkan saluran',
  deskripsi: 'Bersihkan saluran air di sisi utara.',
  status: 'belum_dikerjakan',
  deadline: '2026-08-02',
  scheduledFor: '2026-07-30',
  priority: 'medium',
  source: 'manual',
  aiReason: null,
  requiresLocation: true,
  unlockedAt: null,
  latestEvidence: null,
};

describe('TaskCard', () => {
  test('announces that location must be checked using the configured radius and deadline', () => {
    const onPress = jest.fn();
    render(
      <TaskCard
        task={task}
        plotName="Sawah A"
        state="check-location"
        radiusM={750}
        onPress={onPress}
      />
    );

    expect(screen.getByText('Perlu cek lokasi')).toBeOnTheScreen();
    expect(screen.getByText('Radius lahan: 750 meter')).toBeOnTheScreen();
    expect(screen.getByText('Deadline: 2026-08-02')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Buka tugas Bersihkan saluran' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Buka tugas Bersihkan saluran' })
    ).toHaveStyle({ minHeight: 44 });
  });

  test.each([
    ['not-started', 'Belum dimulai'],
    ['ready', 'Siap'],
    ['outside', 'Di luar radius'],
    ['pending-review', 'Menunggu review'],
    ['revision-needed', 'Perlu perbaikan'],
    ['completed', 'Selesai'],
  ] satisfies [TaskCardState, string][])('renders the %s state as %s', (state, label) => {
    render(
      <TaskCard
        task={task}
        plotName="Sawah A"
        state={state}
        radiusM={625}
        onPress={() => undefined}
      />
    );

    expect(screen.getByText(label)).toBeOnTheScreen();
    if (state === 'outside') {
      expect(screen.getByText('Radius lahan: 625 meter')).toBeOnTheScreen();
    } else {
      expect(screen.queryByText('Radius lahan: 625 meter')).not.toBeOnTheScreen();
    }
  });

  test('renders priority and scheduled date from the task domain data', () => {
    render(
      <TaskCard
        task={{
          ...task,
          priority: 'low',
          scheduledFor: '2026-08-17',
        }}
        plotName="Sawah A"
        state="not-started"
        onPress={() => undefined}
      />
    );

    expect(screen.getByText('Prioritas: Rendah')).toBeOnTheScreen();
    expect(screen.getByText('Tanggal tugas: 2026-08-17')).toBeOnTheScreen();
    expect(screen.queryByText('Prioritas: Sedang')).toBeNull();
    expect(screen.queryByText('Tanggal tugas: 2026-07-30')).toBeNull();
  });
});
