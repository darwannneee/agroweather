import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';

import { MapPicker } from '@/components/domain/map-picker';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { ScreenHeader } from '@/components/ui/screen-header';
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

export default function PlotFormScreen() {
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

  async function handleSave() {
    const nextErrors = validatePlotForm(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSaving(true);
    try {
      if (plotId) {
        await updatePlot(plotId, form);
      } else {
        await createPlot(form);
      }
      setInitial(form);
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
    <AppScreen>
      <ScreenHeader
        eyebrow="Penataan Lahan"
        title={plotId ? 'Edit Lahan' : 'Tambah Lahan'}
        description="Lengkapi data dan konfirmasi titik lahan."
      />

      <SurfaceCard>
        <AppText variant="subtitle">Informasi Lahan</AppText>
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
        <AppText variant="subtitle">Petani Penanggung Jawab</AppText>
        <View style={styles.chips}>
          <Pressable
            accessibilityLabel="Belum assign"
            accessibilityRole="button"
            accessibilityState={{ selected: form.farmerId === null }}
            onPress={() => setField('farmerId', null)}
            style={[styles.chip, form.farmerId === null && styles.chipSelected]}
          >
            <AppText
              variant="smallStrong"
              color={form.farmerId === null ? Colors.surface : Colors.ink}
            >
              Belum assign
            </AppText>
          </Pressable>
          {farmers.map((farmer) => {
            const selected = form.farmerId === farmer.id;
            return (
              <Pressable
                key={farmer.id}
                accessibilityLabel={`Pilih ${farmer.nama}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setField('farmerId', farmer.id)}
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

      <SurfaceCard>
        <AppText variant="subtitle">Lokasi Lahan</AppText>
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

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
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
