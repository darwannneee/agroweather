import { Feather, Ionicons } from '@expo/vector-icons'; // <-- Import Icon Profesional
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { FormField } from '@/components/ui/form-field';
import { Colors, Spacing } from '@/constants/theme';
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
  const insets = useSafeAreaInsets();
  
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
    <View style={styles.screen}>
      <KeyboardAvoidingView 
        style={styles.flex} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Area dengan Logo dan Kata-kata AgroWeather */}
          <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top + 40, 60) }]}>
            <View style={styles.logoRow}>
              <Ionicons name="leaf" size={42} color={Colors.surface} style={styles.logoIcon} />
              <AppText variant="display" style={styles.headerTitle}>AgroWeather</AppText>
            </View>
            
            <AppText variant="subtitle" style={styles.headerSubtitle}>
              Operasional lahan lebih jelas
            </AppText>
            <AppText variant="body" style={styles.headerDescription}>
              Cuaca, GPS, absen, dan task harian dibuat mudah diakses langsung dari lapangan.
            </AppText>
          </View>

          {/* Form Area */}
          <View style={styles.formContainer}>
            <View style={styles.formFields}>
              <FormField
                label="Email"
                error={errors.email}
                leftIcon={<Feather name="mail" size={20} color={Colors.muted} />} // Icon Email Asli
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

              <FormField
                label="Password"
                error={errors.password}
                leftIcon={<Feather name="lock" size={20} color={Colors.muted} />} // Icon Kunci Asli
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
                rightElement={
                  <Pressable
                    disabled={submitting}
                    hitSlop={12}
                    onPress={() => setPasswordVisible((v) => !v)}
                  >
                    {/* Icon Mata Asli */}
                    <Feather 
                      name={passwordVisible ? "eye-off" : "eye"} 
                      size={20} 
                      color={Colors.forest} 
                    />
                  </Pressable>
                }
              />
            </View>

            {submitError ? (
              <View accessibilityLiveRegion="polite" aria-live="polite" style={styles.errorContainer}>
                <AppText variant="small" color={Colors.dangerText}>
                  {submitError}
                </AppText>
              </View>
            ) : null}

            {/* Tombol Login */}
            <View style={styles.loginButtonWrapper}>
              <AppButton
                label="Login"
                variant="forest"
                loading={submitting}
                disabled={submitting}
                onPress={() => void handleSubmit()}
              />
            </View>
            
            {/* Informasi Footer Khusus Internal */}
            <AppText variant="small" color={Colors.muted} style={styles.internalNote}>
              Aplikasi ini dikhususkan untuk pegawai internal. Hubungi admin untuk mendapatkan akses.
            </AppText>
            
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.leaf, // Hijau ciri khas aplikasi
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerContainer: {
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.six * 1.5, 
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  logoIcon: {
    marginRight: Spacing.two,
  },
  headerTitle: {
    color: Colors.surface,
  },
  headerSubtitle: {
    color: Colors.surface,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  headerDescription: {
    color: Colors.surface,
    opacity: 0.85,
    lineHeight: 22,
  },
  formContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.six + Spacing.two, // Padding atas lebih lebar agar lega
    paddingBottom: Spacing.six,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  formFields: {
    gap: Spacing.five, // Jarak antar input agak dijauhkan agar tidak terlalu padat
    marginBottom: Spacing.five,
  },
  errorContainer: {
    marginBottom: Spacing.four,
    alignItems: 'center',
  },
  loginButtonWrapper: {
    marginTop: Spacing.one,
  },
  internalNote: {
    textAlign: 'center',
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
    lineHeight: 20,
  }
});