import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Spacing } from '@/constants/theme';

import { PrimaryButton } from '../primary-button';
import { ThemedText } from '../themed-text';

export type EvidenceAsset = {
  uri: string;
  mimeType: string;
};

type EvidencePickerProps = {
  asset: EvidenceAsset | null;
  disabled?: boolean;
  onChange: (asset: EvidenceAsset | null) => void;
};

function assetFromResult(result: ImagePicker.ImagePickerResult): EvidenceAsset | null {
  if (result.canceled || !result.assets[0]) return null;
  return {
    uri: result.assets[0].uri,
    mimeType: result.assets[0].mimeType ?? 'image/jpeg',
  };
}

export function EvidencePicker({ asset, disabled, onChange }: EvidencePickerProps) {
  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    const nextAsset = assetFromResult(result);
    if (nextAsset) onChange(nextAsset);
  }

  async function captureImage() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    const nextAsset = assetFromResult(result);
    if (nextAsset) onChange(nextAsset);
  }

  return (
    <View style={styles.wrapper}>
      {asset ? <Image source={{ uri: asset.uri }} style={styles.preview} /> : null}
      <PrimaryButton
        label={asset ? 'Ganti Foto Bukti' : 'Pilih Foto Bukti'}
        onPress={pickImage}
        disabled={disabled}
      />
      <Pressable
        onPress={captureImage}
        disabled={disabled}
        style={[styles.secondaryButton, disabled && styles.disabled]}
      >
        <ThemedText type="smallBold" style={styles.secondaryLabel}>
          Ambil Foto
        </ThemedText>
      </Pressable>
      {asset ? (
        <Pressable onPress={() => onChange(null)} disabled={disabled} style={styles.clearButton}>
          <ThemedText type="small" themeColor="textSecondary">
            Hapus pilihan
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.two,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#208AEF',
    borderRadius: 8,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: '#208AEF',
  },
  clearButton: {
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});
