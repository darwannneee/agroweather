import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FarmPlot } from '@/lib/farm-types';

import { PlotCard } from '../plot-card';
import { PlotStats } from '../plot-stats';

const plot: FarmPlot = {
  id: 'plot-a',
  namaLahan: 'Sawah A',
  farmerId: 'farmer-1',
  farmerName: 'Budi',
  luasHektar: 2.5,
  jenisTanaman: 'Padi',
  faseLahan: 'Tanam',
  latCenter: -7.25,
  lngCenter: 112.76,
  radiusGeofenceM: 875,
  status: 'aktif',
};

describe('PlotCard', () => {
  test('exposes accessible edit and status actions with the configured radius', () => {
    const onEdit = jest.fn();
    const onToggleStatus = jest.fn();
    render(<PlotCard plot={plot} onEdit={onEdit} onToggleStatus={onToggleStatus} />);

    expect(screen.getByLabelText('Lahan Sawah A')).toBeOnTheScreen();
    expect(screen.getByText('Sawah A')).toBeOnTheScreen();
    expect(screen.getByText('Radius: 875 meter')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Edit Sawah A' }));
    fireEvent.press(screen.getByRole('button', { name: 'Nonaktifkan Sawah A' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onToggleStatus).toHaveBeenCalledTimes(1);
  });

  test('offers an accessible activate action for an inactive plot', () => {
    const onToggleStatus = jest.fn();
    render(
      <PlotCard
        plot={{ ...plot, status: 'tidak aktif' }}
        onEdit={() => undefined}
        onToggleStatus={onToggleStatus}
      />
    );

    expect(screen.getByText('Nonaktif')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Aktifkan Sawah A' }));
    expect(onToggleStatus).toHaveBeenCalledTimes(1);
  });

  test('disables and announces the status action while mutation is in progress', () => {
    const onToggleStatus = jest.fn();
    render(
      <PlotCard
        plot={plot}
        statusLoading
        onEdit={() => undefined}
        onToggleStatus={onToggleStatus}
      />
    );

    const statusAction = screen.getByRole('button', { name: 'Nonaktifkan Sawah A' });
    expect(statusAction).toBeDisabled();
    expect(statusAction).toBeBusy();

    fireEvent.press(statusAction);
    expect(onToggleStatus).not.toHaveBeenCalled();
  });
});

describe('PlotStats', () => {
  test('renders real plot totals', () => {
    render(<PlotStats total={6} active={4} assigned={3} />);

    expect(screen.getByText('6')).toBeOnTheScreen();
    expect(screen.getByText('4')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('Total')).toBeOnTheScreen();
    expect(screen.getByText('Aktif')).toBeOnTheScreen();
    expect(screen.getByText('Petani')).toBeOnTheScreen();
  });
});
