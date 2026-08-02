import { Feather, Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RoleGuard } from '@/components/domain/role-guard';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { FarmPlot } from '@/lib/farm-types';
import { fetchFarmers } from '@/services/auth';
import {
  createInternalFarmer,
  updateInternalFarmerProfile,
} from '@/services/farmer-management';
import { fetchPlots } from '@/services/plots';
import type { AppUser } from '@/services/supabase';

type FormMode = 'create' | 'edit';

type FarmerFormState = {
  nama: string;
  email: string;
  password: string;
  plotIds: string[];
};

const EMPTY_FORM: FarmerFormState = {
  nama: '',
  email: '',
  password: '',
  plotIds: [],
};

function emptyForm(): FarmerFormState {
  return { ...EMPTY_FORM, plotIds: [] };
}

function assignedToFarmer(plot: FarmPlot, farmerId: string): boolean {
  return Boolean(
    plot.farmerIds?.includes(farmerId) || plot.farmerId === farmerId
  );
}

function plotNamesForFarmer(plots: FarmPlot[], farmerId: string): string {
  const names = plots
    .filter((plot) => assignedToFarmer(plot, farmerId))
    .map((plot) => plot.namaLahan);
  return names.length > 0 ? names.join(', ') : 'Belum ditempatkan';
}

function getInitials(name: string) {
  const words = name.trim().split(' ');
  if (words.length === 0) return 'P';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

export function FarmerManagementScreen() {
  const [farmers, setFarmers] = useState<AppUser[]>([]);
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode | null>(null);
  const [editingFarmerId, setEditingFarmerId] = useState<string | null>(null);
  const [form, setForm] = useState<FarmerFormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);

  const editingFarmer = useMemo(
    () => farmers.find((farmer) => farmer.id === editingFarmerId) ?? null,
    [editingFarmerId, farmers]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [nextFarmers, nextPlots] = await Promise.all([
        fetchFarmers(),
        fetchPlots(),
      ]);
      setFarmers(nextFarmers);
      setPlots(nextPlots);
    } catch {
      setLoadError('Data petani belum dapat dimuat. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateForm() {
    setMode('create');
    setEditingFarmerId(null);
    setForm(emptyForm());
  }

  function openEditForm(farmer: AppUser) {
    setMode('edit');
    setEditingFarmerId(farmer.id);
    setForm({
      nama: farmer.nama,
      email: farmer.email,
      password: '',
      plotIds: plots
        .filter((plot) => assignedToFarmer(plot, farmer.id))
        .map((plot) => plot.id),
    });
  }

  function closeForm() {
    setMode(null);
    setEditingFarmerId(null);
    setForm(emptyForm());
  }

  function setField<K extends keyof FarmerFormState>(
    key: K,
    value: FarmerFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function togglePlot(plotId: string) {
    setForm((current) => ({
      ...current,
      plotIds: current.plotIds.includes(plotId)
        ? current.plotIds.filter((id) => id !== plotId)
        : [...current.plotIds, plotId],
    }));
  }

  async function handleSave() {
    const nama = form.nama.trim();
    const email = form.email.trim();
    const password = form.password;

    if (!nama || !email) {
      Alert.alert('Data belum lengkap', 'Nama dan email petani wajib diisi.');
      return;
    }

    if (mode === 'create' && password.length < 8) {
      Alert.alert('Password belum valid', 'Password awal minimal 8 karakter.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        await createInternalFarmer({
          nama,
          email,
          password,
          plotIds: form.plotIds,
        });
      } else if (mode === 'edit' && editingFarmer) {
        await updateInternalFarmerProfile({
          farmerId: editingFarmer.id,
          nama,
          email,
          plotIds: form.plotIds,
        });
      }

      await loadData();
      closeForm();
    } catch {
      Alert.alert('Petani belum tersimpan', 'Periksa data dan koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && farmers.length === 0 && plots.length === 0) {
    return (
      <View style={styles.container}>
        <AppScreen scroll={false}>
          <FeedbackState title="Memuat data petani…" loading />
        </AppScreen>
      </View>
    );
  }

  if (loadError && farmers.length === 0 && plots.length === 0) {
    return (
      <View style={styles.container}>
        <AppScreen scroll={false}>
          <FeedbackState
            title="Data petani belum tersedia"
            message={loadError}
            actionLabel="Coba Lagi"
            onAction={() => void loadData()}
          />
        </AppScreen>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppScreen contentContainerStyle={styles.screenContainer}>
        {/* LIST SECTION (Header Dihapus) */}
        {farmers.length === 0 ? (
          <View style={styles.emptyState}>
            <FeedbackState 
              title="Belum ada petani" 
              message="Tambahkan data petani pertama untuk memulai." 
            />
          </View>
        ) : (
          <View style={styles.listContainer}>
            {farmers.map((farmer) => (
              <View key={farmer.id} style={styles.farmerCard}>
                {/* Avatar Inisial */}
                <View style={styles.avatar}>
                  <AppText variant="bodyStrong" color={Colors.forest}>
                    {getInitials(farmer.nama)}
                  </AppText>
                </View>

                {/* Info Petani */}
                <View style={styles.farmerInfo}>
                  <AppText variant="bodyStrong">{farmer.nama}</AppText>
                  <AppText variant="small" color={Colors.muted}>
                    {farmer.email}
                  </AppText>
                  
                  {/* Badge Lahan */}
                  <View style={styles.plotBadge}>
                    <Ionicons name="leaf-outline" size={12} color={Colors.forest} />
                    <AppText variant="small" color={Colors.forest} style={styles.plotBadgeText}>
                      {plotNamesForFarmer(plots, farmer.id)}
                    </AppText>
                  </View>
                </View>

                {/* Tombol Edit Outline */}
                <Pressable 
                  onPress={() => openEditForm(farmer)}
                  style={({ pressed }) => [
                    styles.editButton,
                    pressed && { opacity: 0.7 }
                  ]}
                >
                  <Ionicons name="create-outline" size={18} color={Colors.forest} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </AppScreen>

      {/* FAB - Tambah Petani */}
      <Pressable 
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} 
        onPress={openCreateForm}
      >
        <Feather name="plus" size={20} color={Colors.surface} />
        <AppText variant="bodyStrong" color={Colors.surface} style={styles.fabText}>
          Tambah Petani
        </AppText>
      </Pressable>

      {/* MODAL FORM (Create & Edit) */}
      <Modal
        visible={!!mode}
        transparent={true}
        animationType="fade"
        onRequestClose={closeForm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons 
                  name={mode === 'create' ? 'person-add-outline' : 'create-outline'} 
                  size={20} 
                  color={Colors.forest} 
                />
              </View>
              <AppText variant="subtitle" style={styles.modalTitle}>
                {mode === 'create' ? 'Tambah Petani Baru' : 'Edit Data Petani'}
              </AppText>
              <Pressable onPress={closeForm} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.muted} />
              </Pressable>
            </View>

            {/* Modal Body / Form */}
            <ScrollView 
              style={styles.modalScroll} 
              contentContainerStyle={styles.formSpace}
              showsVerticalScrollIndicator={false}
            >
              <FormField
                label="Nama Lengkap"
                inputProps={{
                  value: form.nama,
                  onChangeText: (value) => setField('nama', value),
                  placeholder: 'Contoh: Budi Santoso',
                }}
              />
              <FormField
                label="Alamat Email"
                inputProps={{
                  value: form.email,
                  onChangeText: (value) => setField('email', value),
                  autoCapitalize: 'none',
                  keyboardType: 'email-address',
                  placeholder: 'budi@smartfarm.com',
                }}
              />
              {mode === 'create' ? (
                <FormField
                  label="Password Default"
                  inputProps={{
                    value: form.password,
                    onChangeText: (value) => setField('password', value),
                    secureTextEntry: true,
                    placeholder: 'Minimal 8 karakter',
                  }}
                />
              ) : null}

              <View style={styles.assignmentSection}>
                <AppText variant="smallStrong" style={styles.fieldLabel}>
                  Penempatan Lahan
                </AppText>
                <View style={styles.chips}>
                  {plots.length === 0 ? (
                    <AppText variant="small" color={Colors.muted}>
                      Belum ada lahan yang tersedia.
                    </AppText>
                  ) : (
                    plots.map((plot) => {
                      const selected = form.plotIds.includes(plot.id);
                      return (
                        <Pressable
                          key={plot.id}
                          onPress={() => togglePlot(plot.id)}
                          style={[styles.chip, selected && styles.chipSelected]}
                        >
                          <AppText
                            variant="smallStrong"
                            color={selected ? Colors.surface : Colors.ink}
                          >
                            {plot.namaLahan}
                          </AppText>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.formActions}>
              <View style={styles.formActionButton}>
                <AppButton
                  label="Batal"
                  variant="secondary"
                  disabled={saving}
                  onPress={closeForm}
                />
              </View>
              <View style={styles.formActionButton}>
                <AppButton
                  label={mode === 'create' ? 'Simpan Data' : 'Perbarui'}
                  loading={saving}
                  onPress={handleSave}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function FarmerManagementRoute() {
  return (
    <RoleGuard requiredRole="internal">
      <FarmerManagementScreen />
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
  },
  screenContainer: {
    paddingBottom: Spacing.seven * 2, 
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  emptyState: {
    marginTop: Spacing.six,
  },
  
  /* List Styles */
  listContainer: {
    gap: Spacing.three,
  },
  farmerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: `${Colors.forest}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  farmerInfo: {
    flex: 1,
    gap: 2,
  },
  plotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: `${Colors.forest}10`,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginTop: Spacing.one,
    gap: 4,
  },
  plotBadgeText: {
    flexShrink: 1,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.canvas,
    marginLeft: Spacing.two,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    maxHeight: '90%', // Agar tidak melebihi layar jika form panjang
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.button,
    backgroundColor: `${Colors.forest}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  modalTitle: {
    flex: 1,
  },
  closeButton: {
    padding: Spacing.one,
  },
  modalScroll: {
    padding: Spacing.four,
  },
  
  /* Form Styles (Inside Modal) */
  formSpace: {
    gap: Spacing.four,
    paddingBottom: Spacing.six, 
  },
  fieldLabel: {
    marginBottom: Spacing.one,
    color: Colors.ink,
  },
  assignmentSection: {
    marginTop: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    backgroundColor: Colors.canvas,
  },
  chipSelected: {
    backgroundColor: Colors.forest,
    borderColor: Colors.forest,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  formActionButton: {
    flex: 1,
  },

  /* FAB Styles */
  fab: {
    position: 'absolute',
    bottom: Spacing.six,
    right: Spacing.five,
    height: 56,
    paddingHorizontal: Spacing.five,
    borderRadius: 28,
    backgroundColor: Colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    marginLeft: Spacing.two,
  },
  fabPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  }
});