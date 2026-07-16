import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, ThemedInput } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/services/auth-context';
import {
  hasErrors,
  validateRegisterForm,
  type RegisterFormErrors,
} from '@/lib/validation';
import type { UserRole } from '@/services/supabase';

type RoleOption = { value: UserRole; label: string; desc: string };

const ROLE_OPTIONS: RoleOption[] = [
  { value: 'farmer', label: 'Petani', desc: 'Pekerja lapangan' },
  { value: 'internal', label: 'Internal', desc: 'Admin / pemilik lahan' },
];

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [errors, setErrors] = useState<RegisterFormErrors>({
    email: null,
    password: null,
    nama: null,
    role: null,
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const newErrors = validateRegisterForm({ email, password, nama, role });
    setErrors(newErrors);
    if (hasErrors(newErrors)) return;
    if (role !== 'farmer' && role !== 'internal') return;

    setSubmitting(true);
    try {
      await signUp({ email: email.trim(), password, nama: nama.trim(), role });
      Alert.alert('Berhasil', 'Akun dibuat. Silakan masuk.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    } catch (e) {
      Alert.alert('Gagal daftar', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <ThemedText type="title">Daftar Akun</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Buat akun baru AgroWeather
          </ThemedText>
        </View>

        <View style={styles.form}>
          <FormField label="Nama Lengkap" error={errors.nama}>
            {({ hasError }) => (
              <ThemedInput
                value={nama}
                onChangeText={setNama}
                placeholder="cth: Budi Santoso"
                autoCapitalize="words"
                hasError={hasError}
              />
            )}
          </FormField>

          <FormField label="Email" error={errors.email}>
            {({ hasError }) => (
              <ThemedInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@contoh.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                hasError={hasError}
              />
            )}
          </FormField>

          <FormField label="Password" error={errors.password}>
            {({ hasError }) => (
              <ThemedInput
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 karakter, huruf + angka"
                secureTextEntry
                hasError={hasError}
              />
            )}
          </FormField>

          <FormField label="Daftar sebagai" error={errors.role}>
            {() => (
              <View style={styles.roleRow}>
                {ROLE_OPTIONS.map((opt) => {
                  const selected = role === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setRole(opt.value)}
                      style={[
                        styles.roleCard,
                        {
                          backgroundColor: selected ? '#208AEF' : theme.backgroundElement,
                          borderColor: selected ? '#208AEF' : 'transparent',
                        },
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: selected ? '#ffffff' : theme.text }}
                      >
                        {opt.label}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: selected ? '#ffffff' : theme.textSecondary }}
                      >
                        {opt.desc}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </FormField>

          <PrimaryButton label="Daftar" onPress={handleSubmit} loading={submitting} />

          <View style={styles.footer}>
            <ThemedText type="small">Sudah punya akun? </ThemedText>
            <Link href="/login" asChild>
              <ThemedText type="linkPrimary">Masuk</ThemedText>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.four },
  header: { marginTop: Spacing.four, gap: Spacing.one, alignItems: 'center' },
  form: { marginTop: Spacing.four, gap: Spacing.three },
  roleRow: { flexDirection: 'row', gap: Spacing.two },
  roleCard: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 2,
  },
  footer: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
