import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';

import { AppScreen } from '@/components/ui/app-screen';
import { FeedbackState } from '@/components/ui/feedback-state';
import { pickDashboardRoute } from '@/lib/routing';
import { useAuth } from '@/services/auth-context';
import type { UserRole } from '@/services/supabase';

export function RoleGuard({
  requiredRole,
  children,
}: {
  requiredRole: UserRole;
  children: ReactNode;
}) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <AppScreen>
        <FeedbackState title="Memeriksa akses…" loading />
      </AppScreen>
    );
  }

  if (!session || !profile) {
    return <Redirect href="/login" />;
  }

  if (profile.role !== requiredRole) {
    return <Redirect href={pickDashboardRoute(profile.role)} />;
  }

  return <>{children}</>;
}
