import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { FormField } from '@/components/ui/form-field';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Spacing } from '@/constants/theme';
import { isCoordinateInBounds } from '@/lib/location-policy';

import type { MapPickerProps } from './map-picker.types';

export function MapPicker({ value, radiusM, onConfirm }: MapPickerProps) {
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : '');
  const [longitude, setLongitude] = useState(value ? String(value.longitude) : '');
  const candidate = useMemo(() => {
    if (!latitude.trim() || !longitude.trim()) return null;
    const coords = { latitude: Number(latitude), longitude: Number(longitude) };
    return isCoordinateInBounds(coords) ? coords : null;
  }, [latitude, longitude]);

  return (
    <SurfaceCard>
      <AppText variant="subtitle">Koordinat Lahan</AppText>
      <AppText variant="small">Peta native tidak tersedia di web. Isi koordinat manual.</AppText>
      <View style={styles.fields}>
        <FormField
          label="Latitude"
          inputProps={{
            accessibilityLabel: 'Latitude',
            value: latitude,
            onChangeText: setLatitude,
            keyboardType: 'numbers-and-punctuation',
          }}
        />
        <FormField
          label="Longitude"
          inputProps={{
            accessibilityLabel: 'Longitude',
            value: longitude,
            onChangeText: setLongitude,
            keyboardType: 'numbers-and-punctuation',
          }}
        />
      </View>
      {!candidate ? (
        <AppText variant="small">Masukkan koordinat yang valid.</AppText>
      ) : (
        <AppText variant="small">Radius kehadiran: {radiusM} meter.</AppText>
      )}
      <AppButton
        label="Pilih Titik Ini"
        onPress={() => candidate && onConfirm(candidate)}
        disabled={!candidate}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ fields: { gap: Spacing.three } });
