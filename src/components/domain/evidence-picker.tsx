import { useState } from 'react';
import { Image, Linking, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius } from '@/constants/theme';

export type EvidenceAsset = {
  uri: string;
  mimeType: string;
};

type EvidencePickerProps = {
  asset: EvidenceAsset | null;
  disabled?: boolean;
  onChange: (asset: EvidenceAsset | null) => void;
};

function assetFromResult(
  result: ImagePicker.ImagePickerResult
): EvidenceAsset | null {
  if (result.canceled || !result.assets[0]) return null;
  return {
    uri: result.assets[0].uri,
    mimeType: result.assets[0].mimeType ?? 'image/jpeg',
  };
}

export function EvidencePicker({
  asset,
  disabled,
  onChange,
}: EvidencePickerProps) {
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  function showPermissionDenied(canAskAgain: boolean) {
    setPermissionError(
      canAskAgain
        ? 'Izin foto diperlukan untuk memilih bukti.'
        : 'Izin foto diblokir. Aktifkan izin AgroWeather di Pengaturan.'
    );
    setPermissionBlocked(!canAskAgain);
  }

  function clearPermissionError() {
    setPermissionError(null);
    setPermissionBlocked(false);
  }

  function showPickerError() {
    setPermissionError('Foto belum dapat dibuka. Coba lagi.');
    setPermissionBlocked(false);
  }

  function applyPickerResult(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;
    const nextAsset = assetFromResult(result);
    if (!nextAsset) {
      setPermissionError(
        'Foto yang dipilih belum dapat digunakan. Coba foto lain.'
      );
      setPermissionBlocked(false);
      return;
    }
    onChange(nextAsset);
  }

  async function pickImage() {
    clearPermissionError();
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showPermissionDenied(permission.canAskAgain);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      applyPickerResult(result);
    } catch {
      showPickerError();
    }
  }

  async function captureImage() {
    clearPermissionError();
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showPermissionDenied(permission.canAskAgain);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      applyPickerResult(result);
    } catch {
      showPickerError();
    }
  }

  async function openSettings() {
    try {
      await Linking.openSettings();
    } catch {
      setPermissionError(
        'Pengaturan belum dapat dibuka. Buka Pengaturan perangkat secara manual.'
      );
      setPermissionBlocked(false);
    }
  }

  return (
    <SurfaceCard>
      <AppText variant="subtitle">Foto Bukti</AppText>
      <AppText variant="small" color={Colors.muted}>
        Ambil foto terbaru atau pilih dari galeri.
      </AppText>
      {asset ? (
        <Image
          accessibilityLabel="Pratinjau foto bukti"
          source={{ uri: asset.uri }}
          style={styles.preview}
        />
      ) : null}
      {permissionError ? (
        <AppText accessibilityLiveRegion="polite" color={Colors.dangerText}>
          {permissionError}
        </AppText>
      ) : null}
      {permissionBlocked ? (
        <AppButton
          label="Buka Pengaturan"
          variant="secondary"
          onPress={openSettings}
          disabled={disabled}
        />
      ) : null}
      <AppButton
        label={asset ? 'Ganti Foto Bukti' : 'Pilih Foto Bukti'}
        onPress={pickImage}
        disabled={disabled}
      />
      <AppButton
        label="Ambil Foto"
        variant="secondary"
        onPress={captureImage}
        disabled={disabled}
      />
      {asset ? (
        <AppButton
          label="Hapus Foto"
          variant="danger"
          onPress={() => onChange(null)}
          disabled={disabled}
        />
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    height: 220,
    borderRadius: Radius.card,
  },
});
