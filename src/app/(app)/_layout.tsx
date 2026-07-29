import { Redirect, Stack } from 'expo-router';

import { AppScreen } from '@/components/ui/app-screen';
import { FeedbackState } from '@/components/ui/feedback-state';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/services/auth-context';

export default function AppLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <AppScreen>
        <FeedbackState title="Memuat aplikasi…" loading />
      </AppScreen>
    );
  }
  if (!session || !profile) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        contentStyle: { backgroundColor: Colors.canvas },
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.forest,
        headerTitleStyle: { color: Colors.ink },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="petani" options={{ title: 'Dashboard Petani' }} />
      <Stack.Screen name="pegawai" options={{ title: 'Dashboard Pegawai' }} />
      <Stack.Screen name="penataan-lahan" options={{ title: 'Penataan Lahan' }} />
      <Stack.Screen
        name="penataan-lahan/form"
        options={{ title: 'Form Lahan', presentation: 'card' }}
      />
      <Stack.Screen name="task/[id]" options={{ title: 'Detail Task' }} />
    </Stack>
  );
}
