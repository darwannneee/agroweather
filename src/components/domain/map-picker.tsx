import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, type Region } from 'react-native-maps';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { IconBadge } from '@/components/ui/icon-badge';
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
        <View pointerEvents="none" style={styles.radiusPill}>
          <AppText variant="label" color={Colors.forest}>
            Radius {radiusM} m
          </AppText>
        </View>
        <View pointerEvents="none" style={styles.crosshair}>
          <View style={styles.crosshairBadge}>
            <AppText variant="title" color={Colors.forest}>＋</AppText>
          </View>
        </View>
      </View>
      {locationError ? (
        <View style={styles.errorRow}>
          <IconBadge icon="⚠️" label="GPS error" tone="danger" size="sm" />
          <AppText variant="small" color={Colors.dangerText} style={styles.errorCopy}>
            {locationError}
          </AppText>
        </View>
      ) : null}
      {onRequestLocation ? (
        <AppButton
          label={locating ? 'Mencari Lokasi…' : 'Gunakan Lokasi Saya'}
          variant="secondary"
          icon="🛰️"
          loading={locating}
          onPress={onRequestLocation}
        />
      ) : null}
      <AppText variant="small" color={Colors.muted}>
        Geser peta sampai tanda plus tepat di lokasi lahan.
      </AppText>
      <AppButton
        label="Pilih Titik Ini"
        icon="📍"
        onPress={() => onConfirm(candidate)}
      />
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
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  radiusPill: {
    position: 'absolute',
    left: Spacing.three,
    top: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairBadge: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderColor: Colors.forest,
    borderWidth: 2,
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorCopy: {
    flex: 1,
  },
});
