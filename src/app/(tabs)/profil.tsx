import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useApp } from '@/store/app-context';
import type { Asisten, Praktikan } from '@/types/models';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppButton } from '@/components/ui/AppButton';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';

export default function ProfilRoute() {
  const { state, dispatch } = useApp();
  const [gantiUserSheet, setGantiUserSheet] = useState(false);
  const [resetSheet, setResetSheet] = useState(false);

  if (!state.currentUser) {
    return <Redirect href="/" />;
  }

  const user = state.currentUser;
  const isPraktikan = user.peran === 'praktikan';
  const roleLabel = isPraktikan ? 'Praktikan' : 'Asisten';
  const idNumber = isPraktikan
    ? `NIM ${(user as Praktikan).nim}`
    : `NIP ${(user as Asisten).nip}`;

  const kelasName = isPraktikan
    ? state.kelas.find((k) => k.id === (user as Praktikan).kelasId)?.nama
    : null;

  return (
    <ScreenContainer scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Profil Pengguna</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.nama.charAt(0)}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{user.nama}</Text>
          <Text style={styles.subtext}>
            {roleLabel} {kelasName ? `· ${kelasName}` : ''}
          </Text>
          <Text style={styles.idNumber}>{idNumber}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton
          label="Ganti Pengguna"
          variant="secondary"
          onPress={() => setGantiUserSheet(true)}
        />

        <AppButton
          label="Reset Data Demo"
          variant="ghost"
          onPress={() => setResetSheet(true)}
        />
      </View>

      <Text style={styles.versionText}>Aplikasi Presensi Praktikum v1.0.0</Text>

      <ConfirmSheet
        visible={gantiUserSheet}
        title="Ganti Pengguna?"
        description="Kamu akan kembali ke layar pemilihan peran. Data presensi tetap tersimpan."
        confirmLabel="Ya, Ganti"
        cancelLabel="Batal"
        tone="primary"
        onConfirm={() => {
          setGantiUserSheet(false);
          dispatch({ type: 'KELUAR' });
          router.replace('/');
        }}
        onClose={() => setGantiUserSheet(false)}
      />

      <ConfirmSheet
        visible={resetSheet}
        title="Reset Data Demo?"
        description="Semua data sesi dan presensi akan dikembalikan ke kondisi awal."
        confirmLabel="Ya, Reset Data"
        cancelLabel="Batal"
        tone="danger"
        onConfirm={() => {
          setResetSheet(false);
          dispatch({ type: 'RESET_DATA' });
          router.replace('/');
        }}
        onClose={() => setResetSheet(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  subtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  idNumber: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  actions: {
    gap: Spacing.sm,
  },
  versionText: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xl,
  },
});

