import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/store/app-context';
import type { Pengguna, Peran } from '@/types/models';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { RadioOption } from '@/components/ui/RadioOption';
import { SectionHeader } from '@/components/ui/SectionHeader';

export default function IndexRoute() {
  const router = useRouter();
  const { state, dispatch } = useApp();

  const [peran, setPeran] = useState<Peran>('praktikan');
  const [selectedUser, setSelectedUser] = useState<Pengguna | null>(null);

  const handleSelectPeran = (baru: Peran) => {
    if (baru !== peran) {
      setPeran(baru);
      setSelectedUser(null);
    }
  };

  const handleMasuk = () => {
    if (!selectedUser) return;
    dispatch({ type: 'PILIH_PENGGUNA', pengguna: selectedUser });
    router.replace('/jadwal');
  };

  const filteredPengguna = state.pengguna.filter((u) => u.peran === peran);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Presensi Praktikum</Text>
        <Text style={styles.subtitle}>
          Pilih peran dan identitas untuk melanjutkan ke aplikasi
        </Text>
      </View>

      <AppCard style={styles.card}>
        <SectionHeader title="Pilih Peran" />
        <View style={styles.peranRow}>
          <View style={styles.peranOption}>
            <AppButton
              label="Praktikan"
              variant={peran === 'praktikan' ? 'primary' : 'secondary'}
              onPress={() => handleSelectPeran('praktikan')}
            />
          </View>
          <View style={styles.peranOption}>
            <AppButton
              label="Asisten"
              variant={peran === 'asisten' ? 'primary' : 'secondary'}
              onPress={() => handleSelectPeran('asisten')}
            />
          </View>
        </View>

        <SectionHeader title="Pilih Identitas" />
        <View style={styles.identitasList}>
          {filteredPengguna.map((u) => {
            let subtitle = '';
            if (u.peran === 'praktikan') {
              const kelas = state.kelas.find((k) => k.id === u.kelasId);
              subtitle = `${u.nim} · ${kelas?.nama ?? u.kelasId}`;
            } else {
              subtitle = `NIP: ${u.nip}`;
            }

            return (
              <RadioOption
                key={u.id}
                selected={selectedUser?.id === u.id}
                title={u.nama}
                subtitle={subtitle}
                onPress={() => setSelectedUser(u)}
              />
            );
          })}
        </View>

        {!selectedUser ? (
          <Text style={styles.helperText}>
            Pilih salah satu identitas terlebih dahulu untuk masuk.
          </Text>
        ) : null}

        <AppButton
          label="Masuk ke Aplikasi"
          onPress={handleMasuk}
          disabled={!selectedUser}
        />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  card: {
    gap: Spacing.md,
  },
  peranRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  peranOption: {
    flex: 1,
  },
  identitasList: {
    gap: Spacing.sm,
  },
  helperText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
