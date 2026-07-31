import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AttendanceRecord } from '@/lib/farm-types';

import { AttendanceRow } from '../attendance-row';

const record: AttendanceRecord = {
  id: 'attendance-1',
  farmerId: 'farmer-1',
  farmerName: 'Budi',
  plotId: 'plot-1',
  plotName: 'Sawah Utara',
  attendanceDate: '2026-07-30',
  checkedInAt: '2026-07-30T00:05:00.000Z',
  distanceM: 12,
  latitude: -7.25,
  longitude: 112.76,
};

describe('AttendanceRow', () => {
  test('announces present attendance and exposes an accessible detail action', () => {
    const onPress = jest.fn();
    render(
      <AttendanceRow
        farmerName="Budi"
        status="present"
        record={record}
        onPress={onPress}
      />
    );

    expect(screen.getByText('Budi')).toBeOnTheScreen();
    expect(screen.getByText('Sudah absen')).toBeOnTheScreen();
    expect(screen.getByText('07.05 WIB · Sawah Utara')).toBeOnTheScreen();

    const action = screen.getByRole('button', {
      name: 'Buka detail kehadiran Budi, sudah absen pukul 07.05 WIB di Sawah Utara',
    });
    expect(action).toHaveStyle({ minHeight: 44 });
    fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('announces an absent farmer without exposing a detail action', () => {
    render(
      <AttendanceRow
        farmerName="Sari"
        status="absent"
        record={null}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('Sari')).toBeOnTheScreen();
    expect(screen.getByText('Belum absen')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Kehadiran Sari, belum absen')
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
