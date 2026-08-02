import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components/ui/app-screen';
import { FeedbackState } from '@/components/ui/feedback-state';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/services/auth-context';

export default function AppLayout() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets(); // Untuk menghitung ruang aman layar bawah

  if (loading) {
    return (
      <AppScreen>
        <FeedbackState title="Memuat aplikasi…" loading />
      </AppScreen>
    );
  }

  if (!session || !profile) return <Redirect href="/login" />;

  // Pengecekan role agar tab manajemen tidak muncul di layar Petani
  const isInternal = profile.role === 'internal';

  // Kalkulasi tinggi navbar yang aman agar tidak terpotong garis bawah layar
  const bottomPadding = Math.max(insets.bottom, 12); 

  // Konfigurasi khusus untuk halaman detail yang disembunyikan dari Navbar
  const detailScreenOptions = {
    href: null as any, // Sembunyikan dari menu Navbar
    tabBarStyle: { display: 'none' as const }, // Sembunyikan Navbar saat layar ini aktif
    headerLeft: () => (
      <Pressable onPress={() => router.back()} style={{ paddingHorizontal: Spacing.four }}>
        <Feather name="arrow-left" size={24} color={Colors.forest} />
      </Pressable>
    ),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.forest,
        headerTitleStyle: {
          color: Colors.ink,
          fontWeight: '700',
        },
        headerShadowVisible: false,
        
        // --- Styling Bottom Navbar ---
        tabBarActiveTintColor: Colors.forest,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: bottomPadding,
            height: 56 + bottomPadding, // Ketinggian otomatis menyesuaikan HP
          }
        ],
      }}
    >
      {/* ======================================= */}
      {/* 1. BERANDA (DASHBOARD)                  */}
      {/* ======================================= */}
      <Tabs.Screen 
        name="index" 
        options={{ 
          headerShown: false, 
          title: 'Dashboard',
          tabBarLabel: 'Beranda',
          tabBarIcon: ({ color }) => <Feather name="home" size={24} color={color} />,
        }} 
      />

      {/* ======================================= */}
      {/* 2. TASK AI                              */}
      {/* ======================================= */}
      <Tabs.Screen
        name="ai-tasks/index"
        options={{ 
          title: 'Rekomendasi AI',
          tabBarLabel: 'Task AI',
          tabBarIcon: ({ color }) => <Feather name="cpu" size={24} color={color} />,
          href: isInternal ? '/ai-tasks' : null, // Hanya untuk Internal
        }}
      />

      {/* ======================================= */}
      {/* 3. OPERASIONAL HARIAN                   */}
      {/* ======================================= */}
      <Tabs.Screen
        name="daily-operations"
        options={{ 
          title: 'Operasional Harian',
          tabBarLabel: 'Harian',
          tabBarIcon: ({ color }) => <Feather name="calendar" size={24} color={color} />,
          href: isInternal ? '/daily-operations' : null, // Hanya untuk Internal
        }}
      />

      {/* ======================================= */}
      {/* 4. MANAJEMEN LAHAN                      */}
      {/* ======================================= */}
      <Tabs.Screen 
        name="penataan-lahan" 
        options={{ 
          title: 'Manajemen Lahan',
          tabBarLabel: 'Lahan',
          tabBarIcon: ({ color }) => <Feather name="map" size={24} color={color} />,
          href: isInternal ? '/penataan-lahan' : null, // Hanya untuk Internal
        }} 
      />

      {/* ======================================= */}
      {/* 5. MANAJEMEN PETANI                     */}
      {/* ======================================= */}
      <Tabs.Screen 
        name="petani-management" 
        options={{ 
          title: 'Manajemen Petani',
          tabBarLabel: 'Petani',
          tabBarIcon: ({ color }) => <Feather name="users" size={24} color={color} />,
          href: isInternal ? '/petani-management' : null, // Hanya untuk Internal
        }} 
      />

      {/* ======================================= */}
      {/* HALAMAN DETAIL (DISEMBUNYIKAN DARI TAB) */}
      {/* ======================================= */}
      
      {/* Sembunyikan Dashboard Petani dari Tab (Bukan Petani Management) */}
      <Tabs.Screen name="petani" options={{ href: null, headerShown: false }} />

      {/* Sembunyikan Halaman Pegawai */}
      <Tabs.Screen name="pegawai" options={{ href: null, headerShown: false }} />

      {/* Halaman Formulir dan Detail Tugas */}
      <Tabs.Screen name="penataan-lahan/form" options={{ title: 'Formulir Data Lahan', ...detailScreenOptions }} />
      <Tabs.Screen name="task/[id]" options={{ title: 'Detail Pengerjaan Tugas', ...detailScreenOptions }} />
      <Tabs.Screen name="ai-tasks/[id]" options={{ title: 'Review Rekomendasi AI', ...detailScreenOptions }} />
      <Tabs.Screen name="task-review/[id]" options={{ title: 'Review Bukti Pengerjaan', ...detailScreenOptions }} />

    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.two,
    elevation: 10,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  tabLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});