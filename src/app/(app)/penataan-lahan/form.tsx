import { Ionicons } from '@expo/vector-icons';
import { usePreventRemove } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { MapPicker } from '@/components/domain/map-picker';
import { RoleGuard } from '@/components/domain/role-guard';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLocationAction } from '@/hooks/use-location-action';
import type { FarmPlot, PlotFormErrors, PlotFormValues } from '@/lib/farm-types';
import {
  normalizePlotIdParam,
  plotFormIsDirty,
  validatePlotForm,
} from '@/lib/farm-validation';
import { hasErrors } from '@/lib/validation';
import { fetchFarmers } from '@/services/auth';
import { createPlot, fetchPlotById, updatePlot } from '@/services/plots';
import type { AppUser } from '@/services/supabase';

const EMPTY_FORM: PlotFormValues = {
  namaLahan: '',
  farmerId: null,
  farmerIds: [],
  primaryFarmerId: null,
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

function emptyForm(): PlotFormValues {
  return { ...EMPTY_FORM };
}

function emptyErrors(): PlotFormErrors {
  return { ...EMPTY_ERRORS };
}

function formFromPlot(plot: FarmPlot): PlotFormValues {
  const farmerIds = plot.farmerIds ?? (plot.farmerId ? [plot.farmerId] : []);
  const primaryFarmerId = plot.primaryFarmerId ?? plot.farmerId ?? farmerIds[0] ?? null;

  return {
    namaLahan: plot.namaLahan,
    farmerId: primaryFarmerId,
    farmerIds,
    primaryFarmerId,
    luasHektar: plot.luasHektar === null ? '' : String(plot.luasHektar),
    jenisTanaman: plot.jenisTanaman,
    faseLahan: plot.faseLahan ?? '',
    latCenter: plot.latCenter,
    lngCenter: plot.lngCenter,
    radiusGeofenceM: plot.radiusGeofenceM,
  };
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={22} color={Colors.forest} />
      </View>
      <View style={styles.sectionCopy}>
        <AppText variant="subtitle">{title}</AppText>
        {description ? (
          <AppText variant="small" color={Colors.muted}>
            {description}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export function PlotFormContent() {
  const rawPlotId = useLocalSearchParams().plotId;
  const plotId = normalizePlotIdParam(rawPlotId);
  const router = useRouter();
  const navigation = useNavigation();
  const {
    state: locationState,
    run: runLocation,
    reset: resetLocation,
  } = useLocationAction();
  const pendingRemoveAction = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  const [farmers, setFarmers] = useState<AppUser[]>([]);
  const [initial, setInitial] = useState<PlotFormValues>(() => emptyForm());
  const [form, setForm] = useState<PlotFormValues>(() => emptyForm());
  const [errors, setErrors] = useState<PlotFormErrors>(() => emptyErrors());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [discardConfirmed, setDiscardConfirmed] = useState(false);
  const [saveComplete, setSaveComplete] = useState(false);
  const dirty = useMemo(() => plotFormIsDirty(form, initial), [form, initial]);

  useEffect(() => {
    let active = true;
    const resetForm = emptyForm();

    setLoading(true);
    setLoadError(null);
    setFarmers([]);
    setInitial(resetForm);
    setForm(resetForm);
    setErrors(emptyErrors());
    setDiscardConfirmed(false);
    setSaveComplete(false);
    pendingRemoveAction.current = null;
    resetLocation();

    async function loadForm() {
      try {
        const [nextFarmers, plot] = await Promise.all([
          fetchFarmers(),
          plotId ? fetchPlotById(plotId) : Promise.resolve(null),
        ]);
        if (!active) return;

        setFarmers(nextFarmers);
        if (plot) {
          const values = formFromPlot(plot);
          setInitial(values);
          setForm(values);
        }
      } catch {
        if (active) {
          setLoadError('Form lahan belum dapat dimuat. Periksa koneksi lalu coba lagi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadForm();
    return () => {
      active = false;
    };
  }, [loadAttempt, plotId, resetLocation]);

  usePreventRemove(dirty && !discardConfirmed && !saveComplete, ({ data }) => {
    Alert.alert('Buang perubahan?', 'Perubahan yang belum disimpan akan hilang.', [
      { text: 'Tetap di sini', style: 'cancel' },
      {
        text: 'Buang',
        style: 'destructive',
        onPress: () => {
          pendingRemoveAction.current = data.action;
          setDiscardConfirmed(true);
        },
      },
    ]);
  });

  useEffect(() => {
    if (discardConfirmed && pendingRemoveAction.current) {
      navigation.dispatch(pendingRemoveAction.current);
    }
  }, [discardConfirmed, navigation]);

  useEffect(() => {
    if (saveComplete) {
      router.dismissTo('/(app)/penataan-lahan');
    }
  }, [router, saveComplete]);

  const setField = useCallback(
    <K extends keyof PlotFormValues>(key: K, value: PlotFormValues[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const selectedFarmers = useMemo(
    () => farmers.filter((farmer) => form.farmerIds.includes(farmer.id)),
    [farmers, form.farmerIds]
  );

  function clearFarmerAssignments() {
    setForm((current) => ({
      ...current,
      farmerId: null,
      farmerIds: [],
      primaryFarmerId: null,
    }));
  }

  function toggleFarmer(farmerId: string) {
    setForm((current) => {
      const selected = current.farmerIds.includes(farmerId);
      const farmerIds = selected
        ? current.farmerIds.filter((id) => id !== farmerId)
        : [...current.farmerIds, farmerId];
      const primaryFarmerId = selected
        ? current.primaryFarmerId === farmerId
          ? farmerIds[0] ?? null
          : current.primaryFarmerId
        : current.primaryFarmerId ?? farmerId;

      return {
        ...current,
        farmerIds,
        primaryFarmerId,
        farmerId: primaryFarmerId,
      };
    });
  }

  function setPrimaryFarmer(farmerId: string) {
    setForm((current) => {
      if (!current.farmerIds.includes(farmerId)) return current;
      return {
        ...current,
        primaryFarmerId: farmerId,
        farmerId,
      };
    });
  }

  async function handleSave() {
    const primaryFarmerId = form.primaryFarmerId ?? form.farmerIds[0] ?? null;
    const payload = {
      ...form,
      farmerId: primaryFarmerId,
      primaryFarmerId,
    };
    const nextErrors = validatePlotForm(payload);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSaving(true);
    try {
      if (plotId) {
        await updatePlot(plotId, payload);
      } else {
        await createPlot(payload);
      }
      setInitial(payload);
      setSaveComplete(true);
    } catch {
      setSaving(false);
      Alert.alert('Lahan belum tersimpan', 'Periksa koneksi lalu coba lagi.');
    }
  }

  const grantedLocation =
    locationState.status === 'success' && locationState.result.status === 'granted'
      ? locationState.result.coords
      : null;

  if (loading) {
    return (
      <AppScreen scroll={false}>
        <FeedbackState title="Memuat form lahan…" loading />
      </AppScreen>
    );
  }

  if (loadError) {
    return (
      <AppScreen scroll={false}>
        <FeedbackState
          title="Form lahan belum tersedia"
          message={loadError}
          actionLabel="Coba Lagi"
          onAction={() => setLoadAttempt((attempt) => attempt + 1)}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={{ paddingTop: Spacing.four }}>
      <SurfaceCard>
        <SectionTitle
          icon="document-text-outline"
          title="Informasi Lahan"
          description="Nama, komoditas, luas, dan fase kerja."
        />
        <FormField
          label="Nama Lahan"
          error={errors.namaLahan}
          inputProps={{
            accessibilityLabel: 'Nama Lahan',
            value: form.namaLahan,
            onChangeText: (value) => setField('namaLahan', value),
            placeholder: 'Contoh: Sawah Utara',
          }}
        />
        <FormField
          label="Luas Lahan (ha)"
          error={errors.luasHektar}
          inputProps={{
            accessibilityLabel: 'Luas Lahan (ha)',
            value: form.luasHektar,
            onChangeText: (value) => setField('luasHektar', value),
            keyboardType: 'decimal-pad',
            placeholder: 'Contoh: 2.5',
          }}
        />
        <FormField
          label="Jenis Tanaman"
          error={errors.jenisTanaman}
          inputProps={{
            accessibilityLabel: 'Jenis Tanaman',
            value: form.jenisTanaman,
            onChangeText: (value) => setField('jenisTanaman', value),
            placeholder: 'Contoh: Padi',
          }}
        />
        <FormField
          label="Fase Lahan"
          error={errors.faseLahan}
          inputProps={{
            accessibilityLabel: 'Fase Lahan',
            value: form.faseLahan,
            onChangeText: (value) => setField('faseLahan', value),
            placeholder: 'Contoh: Penyiraman',
          }}
        />
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle
          icon="people-outline"
          title="Petani Penanggung Jawab"
          description="Bisa pilih lebih dari satu petani. Petani utama dipakai sebagai default assign task."
        />
        <View style={styles.chips}>
          <Pressable
            accessibilityLabel="Belum assign"
            accessibilityRole="button"
            accessibilityState={{ selected: form.farmerIds.length === 0 }}
            onPress={clearFarmerAssignments}
            style={[styles.chip, form.farmerIds.length === 0 && styles.chipSelected]}
          >
            <AppText
              variant="smallStrong"
              color={form.farmerIds.length === 0 ? Colors.surface : Colors.ink}
            >
              Belum assign
            </AppText>
          </Pressable>
          {farmers.map((farmer) => {
            const selected = form.farmerIds.includes(farmer.id);
            return (
              <Pressable
                key={farmer.id}
                accessibilityLabel={`Pilih ${farmer.nama}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggleFarmer(farmer.id)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <AppText
                  variant="smallStrong"
                  color={selected ? Colors.surface : Colors.ink}
                >
                  {farmer.nama}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </SurfaceCard>

      {selectedFarmers.length > 0 ? (
        <SurfaceCard>
          <SectionTitle
            icon="star-outline"
            title="Petani Utama"
            description="Dipakai untuk default assignee draft AI dan task manual."
          />
          <View style={styles.chips}>
            {selectedFarmers.map((farmer) => {
              const selected = form.primaryFarmerId === farmer.id;
              return (
                <Pressable
                  key={farmer.id}
                  accessibilityLabel={`Petani utama ${farmer.nama}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPrimaryFarmer(farmer.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <AppText
                    variant="smallStrong"
                    color={selected ? Colors.surface : Colors.ink}
                  >
                    {farmer.nama}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <SectionTitle
          icon="location-outline"
          title="Lokasi Lahan"
          description="Konfirmasi titik GPS dan radius geofence lahan."
        />
        <MapPicker
          value={
            form.latCenter !== null && form.lngCenter !== null
              ? { latitude: form.latCenter, longitude: form.lngCenter }
              : null
          }
          radiusM={form.radiusGeofenceM}
          requestedLocation={grantedLocation}
          locating={locationState.status === 'checking'}
          locationError={
            locationState.status === 'error' ? locationState.result.message : null
          }
          onRequestLocation={() => void runLocation()}
          onConfirm={(coords) => {
            setForm((current) => ({
              ...current,
              latCenter: coords.latitude,
              lngCenter: coords.longitude,
            }));
          }}
        />
        {errors.latCenter || errors.lngCenter ? (
          <AppText variant="small" color={Colors.dangerText}>
            {errors.latCenter ?? errors.lngCenter}
          </AppText>
        ) : null}
      </SurfaceCard>

      <AppButton
        label={plotId ? 'Simpan Perubahan' : 'Simpan Lahan'}
        loading={saving}
        onPress={handleSave}
      />
    </AppScreen>
  );
}

export default function PlotFormRoute() {
  return (
    <RoleGuard requiredRole="internal">
      <PlotFormContent />
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.one,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.button,
    backgroundColor: `${Colors.forest}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  chips: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: Spacing.two,
    marginTop: Spacing.two,
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
});