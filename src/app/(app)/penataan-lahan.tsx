import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, ThemedInput } from '@/components/form-field';
import { MapPicker } from '@/components/map-picker';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hasErrors } from '@/lib/validation';
import { validatePlotForm } from '@/lib/farm-validation';
import type { FarmPlot, PlotFormErrors, PlotFormValues } from '@/lib/farm-types';
import { fetchFarmers } from '@/services/auth';
import { createPlot, fetchPlots, setPlotStatus, updatePlot } from '@/services/plots';
import type { AppUser } from '@/services/supabase';

const DEFAULT_FORM: PlotFormValues = {
  namaLahan: '',
  farmerId: null,
  luasHektar: '',
  jenisTanaman: '',
  faseLahan: '',
  latCenter: null,
  lngCenter: null,
  radiusGeofenceM: 1000,
};

const EMPTY_ERRORS: PlotFormErrors = {
  namaLahan: null,
  luasHektar: null,
  jenisTanaman: null,
  faseLahan: null,
  latCenter: null,
  lngCenter: null,
  radiusGeofenceM: null,
};

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

function formFromPlot(plot: FarmPlot): PlotFormValues {
  return {
    namaLahan: plot.namaLahan,
    farmerId: plot.farmerId,
    luasHektar: plot.luasHektar === null ? '' : String(plot.luasHektar),
    jenisTanaman: plot.jenisTanaman,
    faseLahan: plot.faseLahan ?? '',
    latCenter: plot.latCenter,
    lngCenter: plot.lngCenter,
    radiusGeofenceM: plot.radiusGeofenceM,
  };
}

export default function PenataanLahanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [farmers, setFarmers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlotFormValues>(DEFAULT_FORM);
  const [errors, setErrors] = useState<PlotFormErrors>(EMPTY_ERRORS);

  const stats = useMemo(
    () => ({
      total: plots.length,
      active: plots.filter((plot) => plot.status === 'aktif').length,
      assigned: plots.filter((plot) => plot.farmerId).length,
    }),
    [plots]
  );

  const loadData = useCallback(async () => {
    try {
      const [nextPlots, nextFarmers] = await Promise.all([fetchPlots(), fetchFarmers()]);
      setPlots(nextPlots);
      setFarmers(nextFarmers);
    } catch (e) {
      Alert.alert('Gagal memuat lahan', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadData]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    await loadData();
  }, [loadData]);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setErrors(EMPTY_ERRORS);
    setEditingId(null);
  }

  function closeModal() {
    setModalVisible(false);
    resetForm();
  }

  function openAdd() {
    resetForm();
    setModalVisible(true);
  }

  function openEdit(plot: FarmPlot) {
    setForm(formFromPlot(plot));
    setErrors(EMPTY_ERRORS);
    setEditingId(plot.id);
    setModalVisible(true);
  }

  async function handleSave() {
    const nextErrors = validatePlotForm(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSaving(true);
    try {
      if (editingId) {
        await updatePlot(editingId, form);
      } else {
        await createPlot(form);
      }
      await loadData();
      closeModal();
    } catch (e) {
      Alert.alert('Gagal menyimpan lahan', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  }

  function handleToggleStatus(plot: FarmPlot) {
    const nextStatus = plot.status === 'aktif' ? 'tidak aktif' : 'aktif';
    Alert.alert(
      nextStatus === 'aktif' ? 'Aktifkan Lahan' : 'Nonaktifkan Lahan',
      `Ubah status ${plot.namaLahan} menjadi ${nextStatus}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ubah',
          onPress: async () => {
            try {
              await setPlotStatus(plot.id, nextStatus);
              await refreshData();
            } catch (e) {
              Alert.alert('Gagal mengubah status', e instanceof Error ? e.message : 'Terjadi kesalahan');
            }
          },
        },
      ]
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ThemedText type="linkPrimary">Kembali</ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={styles.title}>
            Penataan Lahan
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Pemetaan lahan, petani, tanaman, dan fase kerja.
          </ThemedText>
        </View>

        <PrimaryButton label="+ Tambah Lahan" onPress={openAdd} />

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{stats.total}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Total
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{stats.active}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Aktif
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{stats.assigned}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Petani
            </ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                Memuat data lahan...
              </ThemedText>
            </View>
          ) : plots.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText type="small" themeColor="textSecondary">
                Belum ada data lahan. Tambahkan lahan pertama.
              </ThemedText>
            </View>
          ) : (
            plots.map((plot) => (
              <View key={plot.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitle}>
                    <ThemedText type="smallBold">{plot.namaLahan}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {plot.jenisTanaman} - {plot.faseLahan ?? 'Fase belum dicatat'}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => handleToggleStatus(plot)}
                    style={[
                      styles.badge,
                      { backgroundColor: plot.status === 'aktif' ? '#dcfce7' : '#fee2e2' },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: plot.status === 'aktif' ? '#166534' : '#991b1b' }}
                    >
                      {plot.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                    </ThemedText>
                  </Pressable>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.infoRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Luas
                    </ThemedText>
                    <ThemedText type="smallBold">{plot.luasHektar ?? '-'} ha</ThemedText>
                  </View>
                  <View style={styles.infoRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Petani
                    </ThemedText>
                    <ThemedText type="smallBold">{plot.farmerName ?? 'Belum diassign'}</ThemedText>
                  </View>
                  <View style={styles.infoRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Radius hadir
                    </ThemedText>
                    <ThemedText type="smallBold">{plot.radiusGeofenceM} m</ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatCoordinate(plot.latCenter)}, {formatCoordinate(plot.lngCenter)}
                  </ThemedText>
                </View>

                <View style={styles.cardActions}>
                  <Pressable onPress={() => openEdit(plot)} style={styles.actionBtn}>
                    <ThemedText type="linkPrimary">Edit</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                {editingId ? 'Edit Lahan' : 'Tambah Lahan'}
              </ThemedText>
              <Pressable onPress={closeModal}>
                <ThemedText type="linkPrimary">Tutup</ThemedText>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
              <FormField label="Nama Lahan *" error={errors.namaLahan}>
                {({ hasError }) => (
                  <ThemedInput
                    value={form.namaLahan}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, namaLahan: text }))}
                    placeholder="Contoh: Sawah Utara"
                    hasError={hasError}
                  />
                )}
              </FormField>

              <FormField label="Luas Lahan (ha) *" error={errors.luasHektar}>
                {({ hasError }) => (
                  <ThemedInput
                    value={form.luasHektar}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, luasHektar: text }))}
                    placeholder="Contoh: 2.5"
                    keyboardType="decimal-pad"
                    hasError={hasError}
                  />
                )}
              </FormField>

              <FormField label="Jenis Tanaman *" error={errors.jenisTanaman}>
                {({ hasError }) => (
                  <ThemedInput
                    value={form.jenisTanaman}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, jenisTanaman: text }))}
                    placeholder="Contoh: Padi"
                    hasError={hasError}
                  />
                )}
              </FormField>

              <FormField label="Fase Lahan *" error={errors.faseLahan}>
                {({ hasError }) => (
                  <ThemedInput
                    value={form.faseLahan}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, faseLahan: text }))}
                    placeholder="Contoh: Penyiraman"
                    hasError={hasError}
                  />
                )}
              </FormField>

              <View style={styles.formGroup}>
                <ThemedText type="smallBold">Petani Penanggung Jawab</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.farmerList}>
                  <Pressable
                    onPress={() => setForm((prev) => ({ ...prev, farmerId: null }))}
                    style={[
                      styles.farmerChip,
                      form.farmerId === null && styles.farmerChipSelected,
                    ]}
                  >
                    <ThemedText type="small" style={form.farmerId === null && styles.selectedText}>
                      Belum assign
                    </ThemedText>
                  </Pressable>
                  {farmers.map((farmer) => (
                    <Pressable
                      key={farmer.id}
                      onPress={() => setForm((prev) => ({ ...prev, farmerId: farmer.id }))}
                      style={[
                        styles.farmerChip,
                        form.farmerId === farmer.id && styles.farmerChipSelected,
                      ]}
                    >
                      <ThemedText type="small" style={form.farmerId === farmer.id && styles.selectedText}>
                        {farmer.nama}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <ThemedText type="smallBold">Lokasi Lahan *</ThemedText>
                <MapPicker
                  latitude={form.latCenter}
                  longitude={form.lngCenter}
                  radiusM={form.radiusGeofenceM}
                  onChange={(coords) =>
                    setForm((prev) => ({
                      ...prev,
                      latCenter: coords.latitude,
                      lngCenter: coords.longitude,
                    }))
                  }
                />
                {errors.latCenter || errors.lngCenter ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                    {errors.latCenter ?? errors.lngCenter}
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="textSecondary">
                  Radius hadir MVP: {form.radiusGeofenceM} meter dari titik lahan.
                </ThemedText>
              </View>

              <PrimaryButton
                label={editingId ? 'Simpan Perubahan' : 'Simpan Lahan'}
                onPress={handleSave}
                loading={saving}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, padding: Spacing.four },
  header: { gap: Spacing.one, marginBottom: Spacing.three },
  backBtn: { marginBottom: Spacing.one },
  title: { fontSize: 24, lineHeight: 32 },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginVertical: Spacing.three,
  },
  statCard: {
    flex: 1,
    borderRadius: 8,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.half,
  },
  scroll: { gap: Spacing.three, paddingBottom: Spacing.four },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  card: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardTitle: { flex: 1 },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 8,
  },
  cardBody: {
    gap: Spacing.one,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  modalTitle: { fontSize: 20, lineHeight: 28 },
  form: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  formGroup: {
    gap: Spacing.one,
  },
  farmerList: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  farmerChip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#e5e7eb',
  },
  farmerChipSelected: {
    backgroundColor: '#208AEF',
  },
  selectedText: {
    color: '#fff',
  },
  errorText: {
    marginLeft: Spacing.one,
  },
});
