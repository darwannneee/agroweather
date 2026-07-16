import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, ThemedInput } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/services/auth-context';
import { hasErrors, validateLoginForm, type LoginFormErrors } from '@/lib/validation';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginFormErrors>({ email: null, password: null });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const newErrors = validateLoginForm({ email, password });
    setErrors(newErrors);
    if (hasErrors(newErrors)) return;

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (e) {
      Alert.alert('Gagal masuk', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <ThemedText type="title">AgroWeather</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Masuk untuk melanjutkan
          </ThemedText>
        </View>

        <View style={styles.form}>
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
                placeholder="••••••••"
                secureTextEntry
                hasError={hasError}
              />
            )}
          </FormField>

          <PrimaryButton label="Masuk" onPress={handleSubmit} loading={submitting} />

          <View style={styles.footer}>
            <ThemedText type="small">Belum punya akun? </ThemedText>
            <Link href="/register" asChild>
              <ThemedText type="linkPrimary">Daftar di sini</ThemedText>
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
  header: { marginTop: Spacing.five, gap: Spacing.one, alignItems: 'center' },
  form: { marginTop: Spacing.five, gap: Spacing.three },
  footer: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
