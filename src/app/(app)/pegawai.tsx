import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardSection } from '@/components/dashboard-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/services/auth-context';

export default function PegawaiDashboard() {
  const { profile, signOut } = useAuth();

  function handleLogout() {
    Alert.alert('Keluar', 'Yakin mau keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText type="small" themeColor="textSecondary">
                Halo internal,
              </ThemedText>
              <ThemedText type="subtitle">{profile?.nama ?? 'Internal'}</ThemedText>
            </View>
            <Pressable onPress={handleLogout} style={styles.logoutBtn}>
              <ThemedText type="smallBold" style={{ color: '#dc2626' }}>
                Keluar
              </ThemedText>
            </Pressable>
          </View>

          <DashboardSection title="Lahan Binaan" actionLabel="Kelola" onAction={() => {}}>
            <ThemedText type="small" themeColor="textSecondary">
              Belum ada lahan yang Anda bina.
            </ThemedText>
          </DashboardSection>

          <DashboardSection title="Tugas Perlu Verifikasi">
            <ThemedText type="small" themeColor="textSecondary">
              Tidak ada tugas pending verifikasi.
            </ThemedText>
          </DashboardSection>

          <DashboardSection title="Aktivitas Petani Binaan">
            <ThemedText type="small" themeColor="textSecondary">
              Aktivitas absensi & scan akan tampil di sini.
            </ThemedText>
          </DashboardSection>

          <DashboardSection title="Assign Tugas Baru" actionLabel="Buat" onAction={() => {}}>
            <ThemedText type="small" themeColor="textSecondary">
              Belum ada petani yang terdaftar di sistem.
            </ThemedText>
          </DashboardSection>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.two },
  logoutBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
});
