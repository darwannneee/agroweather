import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/services/auth-context';
import { pickDashboardRoute } from '@/lib/routing';

export default function AppIndex() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <ThemedText type="small" style={{ marginTop: 12 }}>
            Memuat...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!session || !profile) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={pickDashboardRoute(profile.role)} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
