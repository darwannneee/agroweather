import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FormField } from '@/components/ui/form-field';
import { IconBadge } from '@/components/ui/icon-badge';
import { InfoRow } from '@/components/ui/info-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  hasErrors,
  validateLoginForm,
  type LoginFormErrors,
} from '@/lib/validation';
import { useAuth } from '@/services/auth-context';

const SAFE_AUTH_ERROR =
  'Tidak dapat masuk. Periksa email, password, dan koneksi lalu coba lagi.';

export function safeAuthErrorMessage(_error: unknown): string {
  return SAFE_AUTH_ERROR;
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<LoginFormErrors>({
    email: null,
    password: null,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleEmailChange(value: string) {
    setEmail(value);
    setSubmitError(null);
    if (errors.email) {
      setErrors((current) => ({ ...current, email: null }));
    }
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setSubmitError(null);
    if (errors.password) {
      setErrors((current) => ({ ...current, password: null }));
    }
  }

  async function handleSubmit() {
    if (submitting) return;

    setSubmitError(null);
    const nextErrors = validateLoginForm({ email, password });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (error) {
      setSubmitError(safeAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Field First"
        title="Masuk ke AgroWeather"
        description="Akses tugas lapangan dan operasional lahan dari satu tempat."
      />

      <SurfaceCard style={styles.brandCard}>
        <View style={styles.brandHeader}>
          <IconBadge icon="🌾" label="AgroWeather" tone="forest" size="lg" />
          <View style={styles.brandCopy}>
            <AppText variant="subtitle">Operasional lahan lebih jelas</AppText>
            <AppText variant="small" color={Colors.muted}>
              Cuaca, GPS, absen, dan task harian dibuat mudah dibaca di lapangan.
            </AppText>
          </View>
        </View>
        <View style={styles.featureGrid}>
          <InfoRow icon="🛰️" label="GPS" value="Trigger manual saat dibutuhkan" tone="sky" />
          <InfoRow icon="🤖" label="AI" value="Draft task harian dari cuaca" tone="amber" />
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.form}>
        <FormField
          label="Email"
          error={errors.email}
          inputProps={{
            accessibilityLabel: 'Email',
            value: email,
            onChangeText: handleEmailChange,
            placeholder: 'email@contoh.com',
            keyboardType: 'email-address',
            autoCapitalize: 'none',
            autoCorrect: false,
            editable: !submitting,
          }}
        />

        <View style={styles.passwordField}>
          <FormField
            label="Password"
            error={errors.password}
            inputProps={{
              accessibilityLabel: 'Password',
              value: password,
              onChangeText: handlePasswordChange,
              placeholder: 'Masukkan password',
              secureTextEntry: !passwordVisible,
              autoCapitalize: 'none',
              autoCorrect: false,
              editable: !submitting,
            }}
          />
          <Pressable
            accessibilityRole="togglebutton"
            accessibilityLabel="Tampilkan password"
            accessibilityState={{
              checked: passwordVisible,
              disabled: submitting,
            }}
            disabled={submitting}
            hitSlop={8}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={({ pressed }) => [
              styles.visibilityButton,
              pressed && styles.visibilityPressed,
            ]}
          >
            <AppText variant="smallStrong" color={Colors.forest}>
              {passwordVisible ? 'Sembunyikan' : 'Tampilkan'}
            </AppText>
          </Pressable>
        </View>

        {submitError ? (
          <View accessibilityLiveRegion="polite" aria-live="polite">
            <AppText variant="small" color={Colors.dangerText}>
              {submitError}
            </AppText>
          </View>
        ) : null}

        <AppButton
          label="Masuk"
          icon="→"
          variant="forest"
          loading={submitting}
          disabled={submitting}
          onPress={() => void handleSubmit()}
        />
      </SurfaceCard>

      <AppText variant="small" color={Colors.muted} style={styles.accountNote}>
        Akun AgroWeather dibuat dan dikelola oleh tim internal.
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
  },
  brandCard: {
    gap: Spacing.four,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  brandCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  featureGrid: {
    gap: Spacing.two,
  },
  passwordField: {
    gap: Spacing.two,
  },
  visibilityButton: {
    minHeight: 44,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.button,
  },
  visibilityPressed: {
    backgroundColor: Colors.canvas,
  },
  accountNote: {
    textAlign: 'center',
  },
});
