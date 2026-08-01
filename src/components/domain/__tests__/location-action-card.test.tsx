import { fireEvent, render, screen } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';

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

  test('announces dynamic status politely without hiding its action', () => {
    render(
      <LocationActionCard
        state="idle"
        title="Aktifkan lokasi"
        message="Lokasi hanya diambil saat diminta."
        actionLabel="Aktifkan GPS"
        onAction={() => undefined}
      />
    );

    const container = screen.root;
    expect(container).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(container).toHaveProp('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Aktifkan GPS' })).toBeOnTheScreen();
  });

  test('announces checking without an active button', () => {
    render(
      <LocationActionCard
        state="checking"
        title="Mencari sinyal GPS…"
        message="Pastikan lokasi perangkat menyala."
        actionLabel="Coba Lagi"
        onAction={() => undefined}
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

  test.each([
    ['idle', 'GPS BELUM AKTIF', Colors.border],
    ['checking', 'MENGAMBIL LOKASI', Colors.border],
    ['success', 'DI DALAM RADIUS', Colors.successBorder],
    ['warning', 'PERIKSA LOKASI', Colors.warningBorder],
    ['danger', 'LOKASI BERMASALAH', Colors.dangerBorder],
    ['neutral', 'STATUS LOKASI', Colors.border],
  ] as const)('uses the %s state border token', (state, eyebrow, borderColor) => {
    render(
      <LocationActionCard
        state={state}
        title="Status lokasi"
        message="Detail status lokasi."
      />
    );

    expect(screen.getByText(eyebrow)).toBeOnTheScreen();
    expect(screen.root).toHaveStyle({ borderColor, borderWidth: 1 });
  });
});
