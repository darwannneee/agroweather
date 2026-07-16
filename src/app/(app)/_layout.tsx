import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/services/auth-context';

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="petani" options={{ title: 'Dashboard Petani' }} />
      <Stack.Screen name="pegawai" options={{ title: 'Dashboard Pegawai' }} />
    </Stack>
  );
}
