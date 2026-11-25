import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/store/app-context';
import { getPraktikanClassIds } from '@/store/selectors';
import { useAuth } from '@/contexts/AuthContext';
import { isStaffUser } from '@/types/models';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { NotificationPrompt } from '@/features/notifications/NotificationPrompt';

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfilRoute() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const { pengguna, keluar } = useAuth();
  const user = state.currentUser;

  const [confirmGantiVisible, setConfirmGantiVisible] = useState(false);
  const [loadingKeluar, setLoadingKeluar] = useState(false);

  if (!user) {
    return null;
  }

  const isAsisten = isStaffUser(user);
  const roleDisplayLabel =
    user.peran === 'aslab'
      ? 'Asisten Laboratorium'
      : user.peran === 'asprak' || user.peran === 'asisten'
        ? 'Asisten Praktikum'
        : 'Praktikan';
  const kelasLabel =
    user.peran === 'praktikan'
      ? (() => {
          const ids = getPraktikanClassIds(user);
          if (ids.length === 0) return 'Belum terdaftar di kelas';
          return ids
            .map((id) => state.kelas.find((k) => k.id === id)?.nama ?? id)
            .join(', ');
        })()
      : null;

  const handleGantiPengguna = async () => {
    setLoadingKeluar(true);
    try {
      await keluar();
      dispatch({ type: 'KELUAR' });
      router.replace('/');
    } finally {
      setLoadingKeluar(false);
      setConfirmGantiVisible(false);
    }
  };

  return (
    <ScreenContainer variant="gradient">
      <View style={styles.hero}>
        <View style={[styles.avatar, isAsisten && styles.avatarDark]}>
          <Text style={[styles.avatarText, isAsisten && styles.avatarTextDark]}>
            {user.nama.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{user.nama}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>
            {isAsisten ? `${roleDisplayLabel} · PPK` : `Praktikan · ${kelasLabel}`}
          </Text>
        </View>
      </View>

      <AppCard style={styles.infoCard}>
        <InfoRow
          label={isAsisten ? 'NIP' : 'NIM'}
          value={isAsisten ? user.nip : user.nim}
        />
        <InfoRow label="Email" value={pengguna?.email ?? '-'} />
        {!isAsisten ? (
          <InfoRow label="Kelas Aktif" value={kelasLabel ?? '-'} />
        ) : null}
        <InfoRow
          label="Peran"
          value={roleDisplayLabel}
          last
        />
      </AppCard>

      <NotificationPrompt />

      <View style={styles.actions}>
        <AppButton
          label="Keluar dari Akun"
          variant="secondary"
          onPress={() => setConfirmGantiVisible(true)}
          loading={loadingKeluar}
        />
      </View>

      <Text style={styles.versionText}>
        Versi 1.0.0 · Praktikum Pemrograman Komputer
      </Text>

      <ConfirmSheet
        visible={confirmGantiVisible}
        title="Keluar"
        description="Anda akan keluar dari akun Firebase dan kembali ke halaman login."
        confirmLabel="Ya, Keluar"
        onConfirm={handleGantiPengguna}
        onClose={() => setConfirmGantiVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  avatarDark: {
    backgroundColor: Colors.primary,
  },
  avatarText: {
    fontSize: FontSize.display,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  avatarTextDark: {
    color: Colors.textOnDark,
  },
  userName: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  rolePill: {
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  rolePillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  infoCard: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md + 2,
    gap: 0,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    gap: Spacing.md,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  actions: {
    gap: 10,
  },
  versionText: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
