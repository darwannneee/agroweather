import type { UserRole } from '@/services/supabase';

export type DashboardRoute = '/(app)/petani' | '/(app)/pegawai';

export function pickDashboardRoute(role: UserRole): DashboardRoute {
  if (role === 'farmer') return '/(app)/petani';
  if (role === 'internal') return '/(app)/pegawai';
  throw new Error(`Invalid role: ${String(role)}`);
}
