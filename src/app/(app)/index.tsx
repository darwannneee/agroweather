import { Redirect } from 'expo-router';

import { AppScreen } from '@/components/ui/app-screen';
import { FeedbackState } from '@/components/ui/feedback-state';
import { pickDashboardRoute } from '@/lib/routing';
import { useAuth } from '@/services/auth-context';

export default function AppIndex() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <AppScreen>
        <FeedbackState title="Memuat aplikasi…" loading />
      </AppScreen>
    );
  }

  if (!session || !profile) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={pickDashboardRoute(profile.role)} />;
}
