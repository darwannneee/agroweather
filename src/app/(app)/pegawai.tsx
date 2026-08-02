import { Feather } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoleGuard } from '@/components/domain/role-guard';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { jakartaDate } from '@/lib/daily-operations';
import { useAuth } from '@/services/auth-context';
import { fetchDailyOperations, type DailyOperations } from '@/services/daily-operations';

const { width } = Dimensions.get('window');

const generationLabel = {
  running: 'Sedang diproses',
  succeeded: 'Selesai',
  partial: 'Selesai Sebagian',
  failed: 'Gagal',
} as const;

// 1. Fungsi Sapaan Dinamis
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

// 2. Komponen Lokal: Insight Card (Menggunakan warna theme.ts)
function InsightCard({ title, value, icon, subtitle, bgTone }: { title: string, value: string | number, icon: keyof typeof Feather.glyphMap, subtitle: string, bgTone: string }) {
  return (
    <View style={[styles.insightCard, { backgroundColor: bgTone }]}>
      <View style={styles.insightHeader}>
        <AppText variant="smallStrong" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</AppText>
        <View style={styles.insightIconWrapper}>
          <Feather name={icon} size={16} color={bgTone} />
        </View>
      </View>
      <AppText variant="display" style={styles.insightValue}>{value}</AppText>
      <AppText variant="small" style={{ color: 'rgba(255,255,255,0.9)' }}>{subtitle}</AppText>
    </View>
  );
}

// 3. Komponen Lokal: Menu Grid Item
function MenuGridItem({ icon, label, tone, onPress }: { icon: keyof typeof Feather.glyphMap, label: string, tone: string, onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.menuItem}>
      <View style={[styles.menuIconContainer, { backgroundColor: tone }]}>
        <Feather name={icon} size={24} color={Colors.surface} />
      </View>
      <AppText variant="smallStrong" style={styles.menuLabel}>{label}</AppText>
    </TouchableOpacity>
  );
}

// 4. Komponen Lokal: Status List Item
function StatusListItem({ icon, title, subtitle, statusValue, statusColor, iconBg }: { icon: keyof typeof Feather.glyphMap, title: string, subtitle: string, statusValue: string, statusColor: string, iconBg: string }) {
  return (
    <View style={styles.statusListRow}>
      <View style={[styles.statusIconBox, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={Colors.surface} />
      </View>
      <View style={styles.statusInfo}>
        <AppText variant="bodyStrong" numberOfLines={1}>{title}</AppText>
        <AppText variant="small" color={Colors.muted} numberOfLines={1}>{subtitle}</AppText>
      </View>
      <View style={styles.statusBadge}>
        <AppText variant="smallStrong" style={{ color: statusColor, textAlign: 'right' }}>
          {statusValue}
        </AppText>
      </View>
    </View>
  );
}

export function PegawaiDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [operations, setOperations] = useState<DailyOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false); // State untuk Dropdown Menu

  const requestVersion = useRef(0);
  const profileId = profile?.id ?? null;

  const loadDashboard = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);

    if (!profileId) {
      setOperations(null);
      setLoading(false);
      return;
    }

    try {
      const nextOperations = await fetchDailyOperations(jakartaDate());
      if (requestVersion.current === version) {
        setOperations(nextOperations);
      }
    } catch {
      if (requestVersion.current === version) {
        setLoadError('Data operasional belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      }
    } finally {
      if (requestVersion.current === version) {
        setLoading(false);
      }
    }
  }, [profileId]);

  useEffect(() => {
    void loadDashboard();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const attendance = operations?.attendance ?? [];
    const present = attendance.filter(({ status, record }) => status === 'present' && record !== null).length;
    const lastGeneration = operations?.lastGeneration ?? null;

    return {
      present,
      farmers: attendance.length,
      tasks: operations?.tasks.length ?? 0,
      drafts: operations?.pendingDraftCount ?? 0,
      warnings: lastGeneration ? lastGeneration.skippedCount + lastGeneration.failedCount : 0,
    };
  }, [operations]);

  function handleLogout() {
    Alert.alert('Keluar Akun', 'Anda yakin ingin keluar dari aplikasi?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  function handleSettings() {
    Alert.alert('Info', 'Menu pengaturan akan segera hadir.');
  }

  return (
    <View style={{ flex: 1 }}>
      <AppScreen scroll contentContainerStyle={styles.screenContainer}>
        
        {/* HEADER dengan Dropdown Menu */}
        <View style={[styles.headerArea, styles.paddedContent, { paddingTop: Math.max(insets.top + 10, 20) }]}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <AppText variant="bodyStrong" color={Colors.surface}>
                {profile?.nama?.charAt(0).toUpperCase() ?? 'I'}
              </AppText>
            </View>
            <View style={styles.greetingText}>
              <AppText variant="small" color={Colors.muted}>{getGreeting()}</AppText>
              <AppText variant="subtitle" numberOfLines={1}>{profile?.nama ?? 'Tim Internal'}</AppText>
            </View>
          </View>
          
          {/* Tombol Titik Tiga */}
          <TouchableOpacity 
            onPress={() => setMenuVisible(true)} 
            style={styles.moreBtn} 
            activeOpacity={0.6}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Feather name="more-vertical" size={20} color={Colors.ink} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <FeedbackState title="Menyiapkan data ruang kerja…" loading />
        ) : loadError ? (
          <FeedbackState
            title="Gagal memuat data"
            message={loadError}
            actionLabel="Coba Lagi"
            onAction={() => void loadDashboard()}
          />
        ) : (
          <>
            {/* INSIGHTS - Sepenuhnya memakai palet theme.ts */}
            <View style={styles.sectionContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.insightScroll}
                snapToInterval={width * 0.75 + Spacing.three}
                snapToAlignment="start"
                decelerationRate="fast"
              >
                <InsightCard 
                  title="Kehadiran Lahan" 
                  value={`${metrics.present}/${metrics.farmers}`} 
                  icon="user-check" 
                  subtitle="Petani aktif hari ini" 
                  bgTone={Colors.forest} 
                />
                <InsightCard 
                  title="Tugas Berjalan" 
                  value={metrics.tasks} 
                  icon="file-text" 
                  subtitle="Total operasional aktif" 
                  bgTone={Colors.skyText} 
                />
                <InsightCard 
                  title="Menunggu Review" 
                  value={metrics.drafts} 
                  icon="cpu" 
                  subtitle="Draft otomatisasi AI" 
                  bgTone={Colors.harvest} 
                />
              </ScrollView>
            </View>

            {/* MENU UTAMA - Sepenuhnya memakai palet theme.ts */}
            <View style={[styles.sectionContainer, styles.paddedContent]}>
              <AppText variant="subtitle" style={styles.sectionTitle}>Layanan</AppText>
              <View style={styles.menuGrid}>
                <MenuGridItem 
                  icon="zap" 
                  label="Review AI" 
                  tone={Colors.harvest} 
                  onPress={() => router.push('/(app)/ai-tasks' as Href)} 
                />
                <MenuGridItem 
                  icon="calendar" 
                  label="Harian" 
                  tone={Colors.skyText} 
                  onPress={() => router.push('/(app)/daily-operations' as Href)} 
                />
                <MenuGridItem 
                  icon="map" 
                  label="Lahan" 
                  tone={Colors.leaf} 
                  onPress={() => router.push('/(app)/penataan-lahan')} 
                />
                <MenuGridItem 
                  icon="users" 
                  label="Petani" 
                  tone={Colors.forest} 
                  onPress={() => router.push('/(app)/petani-management' as Href)} 
                />
              </View>
            </View>

            {/* AKTIVITAS TERKINI */}
            <View style={[styles.sectionContainer, styles.paddedContent]}>
              <AppText variant="subtitle" style={styles.sectionTitle}>Aktivitas Sistem</AppText>
              
              <View style={styles.statusListContainer}>
                {operations?.lastGeneration ? (
                  <>
                    <StatusListItem 
                      icon="cpu" 
                      title="Otomatisasi Task" 
                      subtitle={`${operations.lastGeneration.successCount} draft baru dibuat`} 
                      statusValue={generationLabel[operations.lastGeneration.status]} 
                      statusColor={operations.lastGeneration.status === 'succeeded' ? Colors.forest : Colors.amberText}
                      iconBg={Colors.leaf}
                    />
                    {metrics.warnings > 0 && (
                      <StatusListItem 
                        icon="alert-triangle" 
                        title="Peringatan Sistem" 
                        subtitle={`${operations.lastGeneration.skippedCount} lewat, ${operations.lastGeneration.failedCount} gagal`}
                        statusValue={`${metrics.warnings} Info`} 
                        statusColor={Colors.dangerText}
                        iconBg={Colors.warningBackground} 
                      />
                    )}
                  </>
                ) : (
                  <StatusListItem 
                    icon="clock" 
                    title="Otomatisasi Task" 
                    subtitle="Menunggu jadwal harian" 
                    statusValue="Standby" 
                    statusColor={Colors.muted}
                    iconBg={Colors.border}
                  />
                )}

                {operations?.weather?.slice(0, 2).map((w, index) => (
                  <StatusListItem 
                    key={w.plotId}
                    icon="cloud-drizzle" 
                    title={`Cuaca: ${w.plotName}`} 
                    subtitle={w.description} 
                    statusValue={`${w.temperatureC}°C`} 
                    statusColor={Colors.skyText}
                    iconBg={index === 0 ? Colors.skyText : Colors.forest} 
                  />
                ))}
              </View>
            </View>

          </>
        )}
      </AppScreen>

      {/* Modal Dropdown Menu DI LUAR AppScreen */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPressOut={() => setMenuVisible(false)}
        >
          <View style={[styles.dropdownMenu, { top: Math.max(insets.top + 60, 70) }]}>
            <TouchableOpacity 
              style={styles.dropdownItem} 
              activeOpacity={0.6}
              onPress={() => { setMenuVisible(false); handleSettings(); }}
            >
              <Feather name="settings" size={18} color={Colors.ink} />
              <AppText variant="bodyStrong">Pengaturan</AppText>
            </TouchableOpacity>
            
            <View style={styles.dropdownDivider} />
            
            <TouchableOpacity 
              style={styles.dropdownItem} 
              activeOpacity={0.6}
              onPress={() => { 
                setMenuVisible(false); 
                setTimeout(() => handleLogout(), 100); 
              }}
            >
              <Feather name="log-out" size={18} color={Colors.dangerText} />
              <AppText variant="bodyStrong" color={Colors.dangerText}>Keluar</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    paddingBottom: Spacing.seven,
    paddingHorizontal: 0,
  },
  paddedContent: {
    paddingHorizontal: Spacing.five, 
  },
  headerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  profileRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingRight: Spacing.four,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingText: {
    flex: 1,
    justifyContent: 'center',
  },
  moreBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.button,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Dropdown Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)', 
  },
  dropdownMenu: {
    position: 'absolute',
    right: Spacing.five,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    width: 180,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    paddingVertical: Spacing.two,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.four,
  },
  // End of Modal
  sectionContainer: {
    marginBottom: Spacing.six,
  },
  sectionTitle: {
    marginBottom: Spacing.three,
  },
  insightScroll: {
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  insightCard: {
    width: width * 0.75, 
    padding: Spacing.five,
    borderRadius: 24, 
    justifyContent: 'space-between',
    minHeight: 160,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  insightIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightValue: {
    color: Colors.surface,
    marginBottom: Spacing.one,
  },
  menuGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  menuItem: {
    flex: 1, 
    alignItems: 'center',
    gap: Spacing.two,
  },
  menuIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  menuLabel: {
    textAlign: 'center',
  },
  statusListContainer: {
    gap: Spacing.three,
  },
  statusListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.four,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  statusInfo: {
    flex: 1,
    marginRight: Spacing.two,
  },
  statusBadge: {
    flexShrink: 0, 
    minWidth: 70, 
    alignItems: 'flex-end',
  },
});

export default function PegawaiScreen() {
  return (
    <RoleGuard requiredRole="internal">
      <PegawaiDashboard />
    </RoleGuard>
  );
}