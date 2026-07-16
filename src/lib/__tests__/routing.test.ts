import { pickDashboardRoute } from '../routing';

describe('pickDashboardRoute', () => {
  test('returns petani dashboard path for farmer role', () => {
    expect(pickDashboardRoute('farmer')).toBe('/(app)/petani');
  });

  test('returns pegawai dashboard path for internal role', () => {
    expect(pickDashboardRoute('internal')).toBe('/(app)/pegawai');
  });

  test('throws for unknown role (fail-fast)', () => {
    expect(() => pickDashboardRoute('supervisor' as never)).toThrow(/Invalid role/);
  });

  test('throws for empty string', () => {
    expect(() => pickDashboardRoute('' as never)).toThrow(/Invalid role/);
  });

  test('throws for legacy role "worker"', () => {
    expect(() => pickDashboardRoute('worker' as never)).toThrow(/Invalid role/);
  });

  test('throws for legacy role "admin"', () => {
    expect(() => pickDashboardRoute('admin' as never)).toThrow(/Invalid role/);
  });
});
