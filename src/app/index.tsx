import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import {
  Colors,
  FontFamily,
  FontSize,
  Gradients,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import { isFirebaseConfigured } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { pesanErrorAuth } from '@/services/authService';

type Mode = 'masuk' | 'daftar';

export default function IndexRoute() {
  const { status, masuk, daftar } = useAuth();

  const [mode, setMode] = useState<Mode>('masuk');
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotNotice, setForgotNotice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'memuat') {
    return (
      <LinearGradient colors={Gradients.screen} style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Memeriksa sesi login...</Text>
      </LinearGradient>
    );
  }

  // Sesi masih aktif: halaman login dilewati.
  if (status === 'masuk') {
    return <Redirect href="/jadwal" />;
  }

  const gantiMode = (berikutnya: Mode) => {
    if (berikutnya === mode) return;
    setMode(berikutnya);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (mode === 'daftar' && nama.trim().length < 2) {
      setError('Nama minimal 2 karakter.');
      return;
    }
    if (!email.includes('@')) {
      setError('Format email tidak valid.');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'daftar') {
        await daftar({ nama, email, password });
      } else {
        await masuk({ email, password });
      }
    } catch (err) {
      setError(pesanErrorAuth(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={Gradients.screen}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.flex}
    >
      {/* Dekorasi latar lembut sesuai Screen/Login di FigCraft */}
      <View pointerEvents="none" style={styles.decoTopRight}>
        <View style={[styles.decoPetal, { transform: [{ rotate: '0deg' }] }]} />
        <View style={[styles.decoPetal, { transform: [{ rotate: '60deg' }] }]} />
        <View style={[styles.decoPetal, { transform: [{ rotate: '120deg' }] }]} />
      </View>

      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.container}>
              <View style={styles.header}>
                <View style={styles.logo}>
                  <Text style={styles.logoText}>PPK</Text>
                </View>
                <Text style={styles.title}>Presensi Praktikum</Text>
                <Text style={styles.subtitle}>
                  Masuk untuk mengelola jadwal, presensi GPS, dan rekap
                  kehadiran praktikum.
                </Text>
              </View>

              {!isFirebaseConfigured ? (
                <InfoBanner
                  message="Firebase belum dikonfigurasi"
                  description="Salin .env.example menjadi .env lalu jalankan ulang aplikasi."
                  tone="warning"
                />
              ) : null}

              <AppCard style={styles.card}>
                <View style={styles.segmentWrap}>
                  <Pressable
                    onPress={() => gantiMode('masuk')}
                    style={[
                      styles.segmentItem,
                      mode === 'masuk' && styles.segmentActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        mode === 'masuk' && styles.segmentTextActive,
                      ]}
                    >
                      Masuk
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => gantiMode('daftar')}
                    style={[
                      styles.segmentItem,
                      mode === 'daftar' && styles.segmentActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        mode === 'daftar' && styles.segmentTextActive,
                      ]}
                    >
                      Daftar
                    </Text>
                  </Pressable>
                </View>

                {mode === 'daftar' ? (
                  <FormField
                    label="Nama Lengkap"
                    value={nama}
                    onChangeText={setNama}
                    placeholder="Contoh: Budi Santoso"
                    autoCapitalize="words"
                  />
                ) : null}

                <FormField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="nama@kampus.ac.id"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <FormField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimal 6 karakter"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  rightAccessory={
                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? 'Sembunyikan password' : 'Tampilkan password'
                      }
                      style={styles.togglePassBtn}
                    >
                      <Text style={styles.togglePassText}>
                        {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                      </Text>
                    </Pressable>
                  }
                />

                {mode === 'masuk' ? (
                  <View style={styles.forgotRow}>
                    <Pressable
                      onPress={() => setForgotNotice((prev) => !prev)}
                      hitSlop={8}
                    >
                      <Text style={styles.forgotText}>Lupa password?</Text>
                    </Pressable>
                  </View>
                ) : null}

                {forgotNotice && mode === 'masuk' ? (
                  <InfoBanner
                    tone="info"
                    message="Hubungi asisten atau pengampu praktikum untuk reset akun Anda."
                  />
                ) : null}

                {error ? <InfoBanner message={error} tone="danger" /> : null}

                <AppButton
                  label={mode === 'daftar' ? 'Buat Akun Praktikan' : 'Masuk'}
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={!isFirebaseConfigured}
                />
              </AppCard>

              <Text style={styles.helper}>
                Registrasi mandiri membuat akun praktikan. Akun asisten
                disiapkan pengampu.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md + 4,
    paddingVertical: Spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: Spacing.md + 4,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  togglePassBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  togglePassText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -6,
  },
  forgotText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: '#2563EB',
  },
  decoTopRight: {
    position: 'absolute',
    top: 72,
    right: -28,
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.35,
  },
  decoPetal: {
    position: 'absolute',
    width: 48,
    height: 130,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg - 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginBottom: Spacing.xs,
    ...Shadow.card,
  },
  logoText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semibold,
    color: Colors.textOnDark,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.textMuted,
    maxWidth: 320,
  },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: Colors.glassStrong,
    borderRadius: Radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: Colors.textOnDark,
  },
  helper: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    lineHeight: 17,
    textAlign: 'center',
    color: Colors.textMuted,
  },
});
