import { useEffect, useRef, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { IconBadge } from '@/components/ui/icon-badge';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';

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
  const mounted = useRef(true);
  const operationActive = useRef(false);
  const operationVersion = useRef(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operationVersion.current += 1;
      operationActive.current = false;
    };
  }, []);

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

  function beginOperation(clearError: boolean): number | null {
    if (disabled || !mounted.current || operationActive.current) return null;
    operationActive.current = true;
    const version = ++operationVersion.current;
    if (clearError) clearPermissionError();
    setBusy(true);
    return version;
  }

  function operationIsCurrent(version: number): boolean {
    return mounted.current && operationVersion.current === version;
  }

  function finishOperation(version: number) {
    if (operationVersion.current !== version) return;
    operationActive.current = false;
    if (mounted.current) setBusy(false);
  }

  async function runPicker(
    requestPermission: () => Promise<{
      granted: boolean;
      canAskAgain: boolean;
    }>,
    launch: () => Promise<ImagePicker.ImagePickerResult>
  ) {
    const version = beginOperation(true);
    if (version === null) return;

    try {
      const permission = await requestPermission();
      if (!operationIsCurrent(version)) return;
      if (!permission.granted) {
        showPermissionDenied(permission.canAskAgain);
        return;
      }

      const result = await launch();
      if (!operationIsCurrent(version)) return;
      applyPickerResult(result);
    } catch {
      if (operationIsCurrent(version)) showPickerError();
    } finally {
      finishOperation(version);
    }
  }

  async function pickImage() {
    await runPicker(
      () => ImagePicker.requestMediaLibraryPermissionsAsync(),
      () =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        })
    );
  }

  async function captureImage() {
    await runPicker(
      () => ImagePicker.requestCameraPermissionsAsync(),
      () =>
        ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        })
    );
  }

  async function openSettings() {
    const version = beginOperation(false);
    if (version === null) return;
    try {
      await Linking.openSettings();
    } catch {
      if (operationIsCurrent(version)) {
        setPermissionError(
          'Pengaturan belum dapat dibuka. Buka Pengaturan perangkat secara manual.'
        );
        setPermissionBlocked(false);
      }
    } finally {
      finishOperation(version);
    }
  }

  function deleteAsset() {
    if (disabled || operationActive.current) return;
    onChange(null);
  }

  const actionsDisabled = Boolean(disabled || busy);

  return (
    <SurfaceCard>
      <View style={styles.cardHeader}>
        <IconBadge icon="📸" label="Foto Bukti" tone="sky" />
        <View style={styles.copy}>
          <AppText variant="subtitle">Foto Bukti</AppText>
          <AppText variant="small" color={Colors.muted}>
            Ambil foto terbaru atau pilih dari galeri.
          </AppText>
        </View>
      </View>
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
          icon="⚙️"
          onPress={openSettings}
          disabled={actionsDisabled}
        />
      ) : null}
      <AppButton
        label={asset ? 'Ganti Foto Bukti' : 'Pilih Foto Bukti'}
        icon="🖼️"
        onPress={pickImage}
        disabled={actionsDisabled}
      />
      <AppButton
        label="Ambil Foto"
        variant="secondary"
        icon="📷"
        onPress={captureImage}
        disabled={actionsDisabled}
      />
      {asset ? (
        <AppButton
          label="Hapus Foto"
          variant="danger"
          icon="🗑️"
          onPress={deleteAsset}
          disabled={actionsDisabled}
        />
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: Radius.card,
    borderColor: Colors.border,
    borderWidth: 1,
  },
});
