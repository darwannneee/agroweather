import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardSection } from '@/components/dashboard-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/services/auth-context';

export default function PetaniDashboard() {
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
                Selamat datang,
              </ThemedText>
              <ThemedText type="subtitle">{profile?.nama ?? 'Petani'}</ThemedText>
            </View>
            <Pressable onPress={handleLogout} style={styles.logoutBtn}>
              <ThemedText type="smallBold" style={{ color: '#dc2626' }}>
                Keluar
              </ThemedText>
            </Pressable>
          </View>

          <DashboardSection title="Tugas Hari Ini" actionLabel="Lihat semua" onAction={() => {}}>
            <ThemedText type="small" themeColor="textSecondary">
              Belum ada tugas. Tunggu pegawai assign.
            </ThemedText>
          </DashboardSection>

          <DashboardSection title="Cuaca di Lahan Saya">
            <ThemedText type="small" themeColor="textSecondary">
              Data cuaca akan tampil setelah lahan dibuat.
            </ThemedText>
          </DashboardSection>

          <DashboardSection title="Absensi GPS">
            <ThemedText type="small" themeColor="textSecondary">
              Fitur absensi akan diaktifkan setelah lahan Anda terdaftar.
            </ThemedText>
          </DashboardSection>

          <DashboardSection title="Scan Tanaman Terbaru">
            <ThemedText type="small" themeColor="textSecondary">
              Belum ada riwayat scan.
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
