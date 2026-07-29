import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, type Region } from 'react-native-maps';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

import type { MapPickerProps } from './map-picker.types';

const DEFAULT_REGION: Region = {
  latitude: -7.250445,
  longitude: 112.768845,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export function MapPicker({
  value,
  radiusM,
  onConfirm,
  requestedLocation,
  locating,
  locationError,
  onRequestLocation,
}: MapPickerProps) {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>({
    ...DEFAULT_REGION,
    latitude: value?.latitude ?? DEFAULT_REGION.latitude,
    longitude: value?.longitude ?? DEFAULT_REGION.longitude,
  });
  const candidate = useMemo(
    () => ({ latitude: region.latitude, longitude: region.longitude }),
    [region.latitude, region.longitude]
  );

  useEffect(() => {
    if (!requestedLocation) return;
    setRegion((current) => {
      const next = { ...current, ...requestedLocation };
      mapRef.current?.animateToRegion(next, 350);
      return next;
    });
  }, [requestedLocation]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.mapShell}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={setRegion}
        >
          <Circle
            center={candidate}
            radius={radiusM}
            fillColor={Colors.successBackground}
            strokeColor={Colors.forest}
            strokeWidth={2}
          />
        </MapView>
        <View pointerEvents="none" style={styles.crosshair}>
          <AppText variant="title" color={Colors.forest}>＋</AppText>
        </View>
      </View>
      {locationError ? <AppText variant="small" color={Colors.dangerText}>{locationError}</AppText> : null}
      {onRequestLocation ? (
        <AppButton
          label={locating ? 'Mencari Lokasi…' : 'Gunakan Lokasi Saya'}
          variant="secondary"
          loading={locating}
          onPress={onRequestLocation}
        />
      ) : null}
      <AppText variant="small" color={Colors.muted}>
        Geser peta sampai tanda plus tepat di lokasi lahan.
      </AppText>
      <AppButton label="Pilih Titik Ini" onPress={() => onConfirm(candidate)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.three },
  mapShell: {
    height: 280,
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderColor: Colors.border,
    borderWidth: 1,
  },
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
