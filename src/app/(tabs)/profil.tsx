import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/store/app-context';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';

export default function ProfilRoute() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const user = state.currentUser;

  const [confirmGantiVisible, setConfirmGantiVisible] = useState(false);
  const [confirmResetVisible, setConfirmResetVisible] = useState(false);

  if (!user) {
    return null;
  }

  const kelas =
    user.peran === 'praktikan'
      ? state.kelas.find((k) => k.id === user.kelasId)
      : null;

  const handleGantiPengguna = () => {
    dispatch({ type: 'KELUAR' });
    router.replace('/');
  };

  const handleResetData = () => {
    dispatch({ type: 'RESET_DATA' });
    router.replace('/');
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Profil Pengguna</Text>
        <Text style={styles.subtitle}>Informasi akun aktif dan opsi demo</Text>
      </View>

      <AppCard style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.nama.charAt(0)}</Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.nama}</Text>
          <Text style={styles.userRole}>
            {user.peran === 'asisten'
              ? 'Asisten Praktikum'
              : `Praktikan · ${kelas?.nama ?? user.kelasId}`}
          </Text>
          <Text style={styles.userNumber}>
            {user.peran === 'asisten' ? `NIP ${user.nip}` : `NIM ${user.nim}`}
          </Text>
        </View>
      </AppCard>

      <View style={styles.actions}>
        <AppButton
          label="Ganti Pengguna"
          variant="secondary"
          onPress={() => setConfirmGantiVisible(true)}
        />
        <AppButton
          label="Reset Data Demo"
          variant="danger"
          onPress={() => setConfirmResetVisible(true)}
        />
      </View>

      <Text style={styles.versionText}>Versi 1.0.0 · Sprint 1</Text>

      <ConfirmSheet
        visible={confirmGantiVisible}
        title="Ganti Pengguna"
        description="Anda akan keluar dari sesi saat ini dan kembali ke pemilihan pengguna."
        confirmLabel="Ya, Keluar"
        onConfirm={handleGantiPengguna}
        onClose={() => setConfirmGantiVisible(false)}
      />

      <ConfirmSheet
        visible={confirmResetVisible}
        title="Reset Data Demo"
        description="Semua data presensi dan status sesi akan dikembalikan ke kondisi awal demo."
        confirmLabel="Ya, Reset Data"
        tone="danger"
        onConfirm={handleResetData}
        onClose={() => setConfirmResetVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: Spacing.xs,
  },
  screenTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  userRole: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  userNumber: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  versionText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
