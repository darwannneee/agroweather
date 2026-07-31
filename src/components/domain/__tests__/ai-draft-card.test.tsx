import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AiTaskDraft } from '@/lib/farm-types';

import { AiDraftCard } from '../ai-draft-card';

const draft: AiTaskDraft = {
  id: 'draft-1',
  plotId: 'plot-1',
  plotName: 'Sawah Utara',
  proposedAssigneeId: 'farmer-1',
  proposedAssigneeName: 'Budi',
  scheduledFor: '2026-07-30',
  title: 'Periksa irigasi',
  description: 'Pastikan saluran air tidak tersumbat.',
  priority: 'high',
  requiresLocation: true,
  aiReason: 'Hujan diperkirakan rendah.',
  status: 'pending',
  model: 'provider/model',
  weather: {
    observedAt: '2026-07-29T23:00:00.000Z',
    description: 'cerah berawan',
    temperatureC: 28,
    humidityPercent: 80,
    windSpeedMps: 2,
    rainMm: 0,
    forecastMinTemperatureC: 25,
    forecastMaxTemperatureC: 31,
    forecastMaxRainProbability: 0.4,
  },
  createdAt: '2026-07-29T23:10:00.000Z',
};

test('announces draft plot, assignee, priority, and accessible open action', () => {
  const onPress = jest.fn();
  render(<AiDraftCard draft={draft} onPress={onPress} />);

  expect(screen.getByText('Periksa irigasi')).toBeOnTheScreen();
  expect(screen.getByText('Lahan: Sawah Utara')).toBeOnTheScreen();
  expect(screen.getByText('Petani: Budi')).toBeOnTheScreen();
  expect(screen.getByText('Prioritas tinggi')).toBeOnTheScreen();
  expect(screen.getByText('Tanggal tugas: 2026-07-30')).toBeOnTheScreen();

  const action = screen.getByRole('button', {
    name: 'Buka draft AI Periksa irigasi, lahan Sawah Utara, petani Budi, prioritas tinggi',
  });
  expect(action).toHaveStyle({ minHeight: 44 });
  fireEvent.press(action);
  expect(onPress).toHaveBeenCalledTimes(1);
});
