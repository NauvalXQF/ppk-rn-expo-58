import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'memuat') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Memeriksa sesi login...</Text>
      </View>
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>PPK</Text>
          </View>
          <Text style={styles.title}>Presensi Praktikum</Text>
          <Text style={styles.subtitle}>
            Masuk untuk mengelola jadwal, presensi, dan rekap kehadiran praktikum.
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
          <View style={styles.modeRow}>
            <View style={styles.modeItem}>
              <AppButton
                label="Masuk"
                variant={mode === 'masuk' ? 'primary' : 'secondary'}
                onPress={() => gantiMode('masuk')}
              />
            </View>
            <View style={styles.modeItem}>
              <AppButton
                label="Daftar"
                variant={mode === 'daftar' ? 'primary' : 'secondary'}
                onPress={() => gantiMode('daftar')}
              />
            </View>
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
            placeholder="nama@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Minimal 6 karakter"
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <InfoBanner message={error} tone="danger" /> : null}

          <AppButton
            label={mode === 'daftar' ? 'Buat Akun Praktikan' : 'Masuk'}
            onPress={handleSubmit}
            loading={loading}
            disabled={!isFirebaseConfigured}
          />
        </AppCard>

        <Text style={styles.helper}>
          Registrasi mandiri membuat akun praktikan. Akun asisten diberikan oleh pengampu
          melalui mekanisme provisioning.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginBottom: Spacing.xs,
  },
  logoText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.surface,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.textMuted,
  },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modeItem: {
    flex: 1,
  },
  helper: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
    color: Colors.textMuted,
  },
});
