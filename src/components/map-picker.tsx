import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';

import { Spacing } from '@/constants/theme';

import { ThemedInput } from './form-field';
import { ThemedText } from './themed-text';

type MapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
};

const DEFAULT_REGION: Region = {
  latitude: -7.250445,
  longitude: 112.768845,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

function parseCoordinate(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function MapPicker({ latitude, longitude, radiusM, onChange }: MapPickerProps) {
  const selected = useMemo(
    () => (latitude !== null && longitude !== null ? { latitude, longitude } : null),
    [latitude, longitude]
  );
  const region = useMemo<Region>(
    () => ({
      ...DEFAULT_REGION,
      latitude: selected?.latitude ?? DEFAULT_REGION.latitude,
      longitude: selected?.longitude ?? DEFAULT_REGION.longitude,
    }),
    [selected]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fallback}>
        <ThemedText type="smallBold">Koordinat Lahan</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Map native tidak tersedia di web. Isi koordinat manual untuk preview web.
        </ThemedText>
        <ThemedInput
          value={latitude === null ? '' : String(latitude)}
          keyboardType="decimal-pad"
          placeholder="Latitude"
          onChangeText={(value) => {
            const nextLatitude = parseCoordinate(value);
            onChange({ latitude: nextLatitude ?? 0, longitude: longitude ?? 0 });
          }}
        />
        <ThemedInput
          value={longitude === null ? '' : String(longitude)}
          keyboardType="decimal-pad"
          placeholder="Longitude"
          onChangeText={(value) => {
            const nextLongitude = parseCoordinate(value);
            onChange({ latitude: latitude ?? 0, longitude: nextLongitude ?? 0 });
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <MapView
        style={styles.map}
        initialRegion={region}
        onPress={(event) => onChange(event.nativeEvent.coordinate)}
      >
        {selected ? (
          <>
            <Marker coordinate={selected} />
            <Circle
              center={selected}
              radius={radiusM}
              fillColor="rgba(32, 138, 239, 0.14)"
              strokeColor="#208AEF"
              strokeWidth={2}
            />
          </>
        ) : null}
      </MapView>
      <Pressable style={styles.currentPin} onPress={() => onChange(region)}>
        <ThemedText type="smallBold" style={{ color: '#fff' }}>
          Pakai titik tengah
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  currentPin: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  fallback: {
    gap: Spacing.two,
  },
});
