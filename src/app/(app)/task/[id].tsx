import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EvidencePicker, type EvidenceAsset } from '@/components/evidence-picker';
import { FormField, ThemedInput } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { buildMvpAnalysisSummary } from '@/lib/analysis';
import type { FarmPlot, FarmTask } from '@/lib/farm-types';
import { validateEvidenceUpload } from '@/lib/farm-validation';
import { evaluateGeofence, type GeofenceResult } from '@/lib/geofence';
import { useAuth } from '@/services/auth-context';
import { countTaskEvidence, uploadTaskEvidence } from '@/services/evidence';
import { requestCurrentLocation, type CurrentLocationResult } from '@/services/location';
import { fetchPlotById } from '@/services/plots';
import { fetchTaskDetail, markTaskComplete } from '@/services/tasks';

function formatDistance(distanceM: number | null): string {
  if (distanceM === null) return '-';
  if (distanceM < 1000) return `${distanceM} m`;
  return `${(distanceM / 1000).toFixed(2)} km`;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { profile } = useAuth();
  const [task, setTask] = useState<FarmTask | null>(null);
  const [plot, setPlot] = useState<FarmPlot | null>(null);
  const [location, setLocation] = useState<CurrentLocationResult | null>(null);
  const [geofence, setGeofence] = useState<GeofenceResult | null>(null);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [asset, setAsset] = useState<EvidenceAsset | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const unlocked = Boolean(task && (!task.requiresLocation || geofence?.unlocked));

  const analysisSummary = useMemo(() => {
    if (!task || !plot) return '';
    return buildMvpAnalysisSummary({
      plotName: plot.namaLahan,
      cropType: plot.jenisTanaman,
      phase: plot.faseLahan,
      taskTitle: task.judul,
      evidenceCount,
    });
  }, [evidenceCount, plot, task]);

  const loadDetail = useCallback(async () => {
    if (!taskId) return;

    try {
      const nextTask = await fetchTaskDetail(taskId);
      const [nextPlot, nextLocation, nextEvidenceCount] = await Promise.all([
        fetchPlotById(nextTask.lahanId),
        requestCurrentLocation(),
        countTaskEvidence(nextTask.id),
      ]);
      const nextGeofence = evaluateGeofence({
        user: nextLocation.coords,
        plot: {
          latitude: nextPlot.latCenter,
          longitude: nextPlot.lngCenter,
          radiusMeters: nextPlot.radiusGeofenceM,
        },
      });

      setTask(nextTask);
      setPlot(nextPlot);
      setLocation(nextLocation);
      setGeofence(nextGeofence);
      setEvidenceCount(nextEvidenceCount);
    } catch (e) {
      Alert.alert('Gagal memuat task', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadDetail]);

  const refreshDetail = useCallback(async () => {
    setLoading(true);
    await loadDetail();
  }, [loadDetail]);

  async function handleSubmit() {
    if (!task || !plot || !profile) return;

    const validation = validateEvidenceUpload({
      unlocked,
      photoUri: asset?.uri ?? null,
    });
    if (validation) {
      Alert.alert('Validasi', validation);
      return;
    }
    if (!asset) return;

    setSubmitting(true);
    try {
      await uploadTaskEvidence({
        taskId: task.id,
        farmerId: profile.id,
        lahanId: plot.id,
        photoUri: asset.uri,
        contentType: asset.mimeType,
        note: note.trim() || null,
        lat: location?.coords?.latitude ?? null,
        lng: location?.coords?.longitude ?? null,
        aiPlaceholderSummary: analysisSummary,
      });
      await markTaskComplete(task.id);
      Alert.alert('Bukti tersimpan', 'Task selesai dan bukti pekerjaan sudah diunggah.', [
        { text: 'OK', onPress: () => router.replace('/(app)/petani') },
      ]);
    } catch (e) {
      Alert.alert('Gagal upload bukti', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}>
            <ThemedText type="linkPrimary">Kembali</ThemedText>
          </Pressable>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                Memuat detail task...
              </ThemedText>
            </View>
          ) : !task || !plot ? (
            <View style={styles.center}>
              <ThemedText type="small" themeColor="textSecondary">
                Task tidak ditemukan.
              </ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <ThemedText type="subtitle" style={styles.title}>
                  {task.judul}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {plot.namaLahan} - {plot.jenisTanaman}
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText type="smallBold">Status Lokasi</ThemedText>
                {location?.status !== 'granted' ? (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      {location?.message ?? 'Lokasi belum tersedia.'}
                    </ThemedText>
                    <PrimaryButton label="Coba Lagi" onPress={refreshDetail} />
                  </>
                ) : (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      Jarak Anda {formatDistance(geofence?.distanceM ?? null)} dari lahan.
                    </ThemedText>
                    <ThemedText
                      type="smallBold"
                      style={{ color: unlocked ? '#166534' : '#991b1b' }}
                    >
                      {unlocked ? 'Task terbuka' : 'Task terkunci di luar radius 1 km'}
                    </ThemedText>
                  </>
                )}
              </View>

              <View style={styles.section}>
                <ThemedText type="smallBold">Instruksi</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {task.deskripsi ?? 'Kerjakan task sesuai arahan internal, lalu upload foto bukti.'}
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText type="smallBold">Analisis AI MVP</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {analysisSummary}
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText type="smallBold">Foto Bukti</ThemedText>
                <EvidencePicker asset={asset} onChange={setAsset} disabled={!unlocked || submitting} />
              </View>

              <FormField label="Catatan Bukti" error={null}>
                {() => (
                  <ThemedInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Contoh: Saluran air sudah dibersihkan"
                    multiline
                    numberOfLines={3}
                  />
                )}
              </FormField>

              <PrimaryButton
                label="Upload Bukti & Selesaikan"
                onPress={handleSubmit}
                loading={submitting}
                disabled={!unlocked}
              />
              {!unlocked ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Datang ke radius 1 km dari lahan untuk mengunggah bukti.
                </ThemedText>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
  },
  section: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
    backgroundColor: '#f8fafc',
  },
});
