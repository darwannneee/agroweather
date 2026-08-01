import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { RoleGuard } from '@/components/domain/role-guard';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { IconBadge } from '@/components/ui/icon-badge';
import { InfoRow } from '@/components/ui/info-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
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
    plot.farmerIds?.includes(farmerId)
    || plot.farmerId === farmerId
  );
}

function plotNamesForFarmer(plots: FarmPlot[], farmerId: string): string {
  const names = plots
    .filter((plot) => assignedToFarmer(plot, farmerId))
    .map((plot) => plot.namaLahan);
  return names.length > 0 ? names.join(', ') : 'Belum ditempatkan';
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
      <AppScreen scroll={false}>
        <FeedbackState title="Memuat data petani…" loading />
      </AppScreen>
    );
  }

  if (loadError && farmers.length === 0 && plots.length === 0) {
    return (
      <AppScreen scroll={false}>
        <FeedbackState
          title="Data petani belum tersedia"
          message={loadError}
          actionLabel="Coba Lagi"
          onAction={() => void loadData()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Internal"
        title="Manajemen Petani"
        description="Tambah petani auto-confirm, edit profil, dan tempatkan mereka ke satu atau beberapa lahan."
        action={
          <AppButton
            label="Tambah Petani"
            icon="+"
            onPress={openCreateForm}
          />
        }
      />

      {mode ? (
        <SurfaceCard>
          <View style={styles.sectionHeader}>
            <IconBadge
              icon={mode === 'create' ? '➕' : '✏️'}
              label={mode === 'create' ? 'Tambah Petani' : 'Edit Petani'}
              tone="forest"
            />
            <View style={styles.sectionCopy}>
              <AppText variant="subtitle">
                {mode === 'create' ? 'Tambah Petani' : 'Edit Petani'}
              </AppText>
              <AppText variant="small" color={Colors.muted}>
                Petani baru langsung aktif karena dibuat lewat RPC internal.
              </AppText>
            </View>
            <AppButton
              label="Batal"
              variant="secondary"
              disabled={saving}
              onPress={closeForm}
            />
          </View>

          <FormField
            label="Nama Petani"
            inputProps={{
              accessibilityLabel: 'Nama Petani',
              value: form.nama,
              onChangeText: (value) => setField('nama', value),
              placeholder: 'Contoh: Budi',
            }}
          />
          <FormField
            label="Email Petani"
            inputProps={{
              accessibilityLabel: 'Email Petani',
              value: form.email,
              onChangeText: (value) => setField('email', value),
              autoCapitalize: 'none',
              keyboardType: 'email-address',
              placeholder: 'budi@example.com',
            }}
          />
          {mode === 'create' ? (
            <FormField
              label="Password Awal"
              inputProps={{
                accessibilityLabel: 'Password Awal',
                value: form.password,
                onChangeText: (value) => setField('password', value),
                secureTextEntry: true,
                placeholder: 'Minimal 8 karakter',
              }}
            />
          ) : null}

          <View style={styles.assignmentSection}>
            <View style={styles.sectionHeader}>
              <IconBadge icon="🗺️" label="Assign Lahan" tone="sky" />
              <View style={styles.sectionCopy}>
                <AppText variant="smallStrong">Assign Lahan</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Pilih satu atau beberapa lahan untuk petani ini.
                </AppText>
              </View>
            </View>
            <View style={styles.chips}>
              {plots.length === 0 ? (
                <AppText variant="small" color={Colors.muted}>
                  Belum ada lahan yang bisa dipilih.
                </AppText>
              ) : (
                plots.map((plot) => {
                  const selected = form.plotIds.includes(plot.id);
                  return (
                    <Pressable
                      key={plot.id}
                      accessibilityLabel={`Assign ${plot.namaLahan}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
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

          <AppButton
            label="Simpan Petani"
            loading={saving}
            onPress={handleSave}
          />
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <View style={styles.sectionHeader}>
          <IconBadge icon="👨‍🌾" label="Daftar Petani" tone="forest" />
          <View style={styles.sectionCopy}>
            <AppText variant="subtitle">Daftar Petani</AppText>
            <AppText variant="small" color={Colors.muted}>
              Profil, email, dan lahan aktif yang dipegang.
            </AppText>
          </View>
        </View>
        {farmers.length === 0 ? (
          <AppText variant="small" color={Colors.muted}>
            Belum ada petani.
          </AppText>
        ) : (
          farmers.map((farmer) => (
            <View key={farmer.id} style={styles.farmerRow}>
              <View style={styles.sectionCopy}>
                <AppText variant="bodyStrong">{farmer.nama}</AppText>
                <AppText variant="small" color={Colors.muted}>
                  {farmer.email}
                </AppText>
                <InfoRow
                  icon="🗺️"
                  label="Lahan"
                  value={`Lahan: ${plotNamesForFarmer(plots, farmer.id)}`}
                  tone="sky"
                />
              </View>
              <AppButton
                label={`Edit ${farmer.nama}`}
                icon="✏️"
                variant="secondary"
                onPress={() => openEditForm(farmer)}
              />
            </View>
          ))
        )}
      </SurfaceCard>
    </AppScreen>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  assignmentSection: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 44,
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
  farmerRow: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.three,
  },
});
