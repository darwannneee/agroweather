import type { ReactElement } from 'react';

import PegawaiScreen, { PegawaiDashboard } from '@/app/(app)/pegawai';
import PlotListRoute, { PlotListScreen } from '@/app/(app)/penataan-lahan';
import PlotFormRoute, {
  PlotFormContent,
} from '@/app/(app)/penataan-lahan/form';
import PetaniScreen, { PetaniDashboard } from '@/app/(app)/petani';
import TaskDetailRoute, {
  TaskDetailScreen,
} from '@/app/(app)/task/[id]';
import { RoleGuard } from '@/components/domain/role-guard';
import type { UserRole } from '@/services/supabase';

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useNavigation: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock('@/services/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/auth', () => ({}));
jest.mock('@/services/attendance', () => ({}));
jest.mock('@/services/daily-operations', () => ({}));
jest.mock('@/services/evidence', () => ({}));
jest.mock('@/services/location', () => ({}));
jest.mock('@/services/plots', () => ({}));
jest.mock('@/services/tasks', () => ({}));

type GuardElement = ReactElement<{
  requiredRole: UserRole;
  children: ReactElement;
}>;

describe('protected role route wrappers', () => {
  test.each([
    ['farmer dashboard', PetaniScreen, PetaniDashboard, 'farmer'],
    ['task detail', TaskDetailRoute, TaskDetailScreen, 'farmer'],
    ['internal dashboard', PegawaiScreen, PegawaiDashboard, 'internal'],
    ['plot list', PlotListRoute, PlotListScreen, 'internal'],
    ['plot form', PlotFormRoute, PlotFormContent, 'internal'],
  ] as const)(
    'wraps %s content without evaluating it before RoleGuard',
    (_label, Route, Content, role) => {
      const element = Route() as GuardElement;

      expect(element.type).toBe(RoleGuard);
      expect(element.props.requiredRole).toBe(role);
      expect(element.props.children.type).toBe(Content);
    }
  );
});
