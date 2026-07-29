import { fireEvent, render, screen } from '@testing-library/react-native';

import { LocationActionCard } from '../location-action-card';

describe('LocationActionCard', () => {
  test('renders an explicit idle action', () => {
    const onAction = jest.fn();
    render(
      <LocationActionCard
        state="idle"
        title="Aktifkan lokasi"
        message="Lokasi hanya diambil saat diminta."
        actionLabel="Aktifkan GPS"
        onAction={onAction}
      />
    );
    expect(screen.getByText('GPS BELUM AKTIF')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Aktifkan GPS' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('announces checking without an active button', () => {
    render(
      <LocationActionCard
        state="checking"
        title="Mencari sinyal GPS…"
        message="Pastikan lokasi perangkat menyala."
      />
    );
    expect(screen.getByText('MENGAMBIL LOKASI')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('renders settings action for a blocked permission', () => {
    render(
      <LocationActionCard
        state="danger"
        title="GPS tidak dapat digunakan"
        message="Aktifkan izin lokasi di Pengaturan."
        actionLabel="Buka Pengaturan"
        onAction={() => undefined}
      />
    );
    expect(screen.getByRole('button', { name: 'Buka Pengaturan' })).toBeOnTheScreen();
  });
});
