import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/store/app-context';
import type { Asisten, Pengguna, Peran, Praktikan } from '@/types/models';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { AppButton } from '@/components/ui/AppButton';

export default function IndexScreen() {
  const { state, dispatch } = useApp();
  const [selectedPeran, setSelectedPeran] = useState<Peran>('asisten');
  const [selectedUser, setSelectedUser] = useState<Pengguna | null>(null);

  const filteredUsers = state.pengguna.filter(
    (u) => u.peran === selectedPeran,
  );

  const handlePeranChange = (peran: Peran) => {
    setSelectedPeran(peran);
    setSelectedUser(null);
  };

  const handleMasuk = () => {
    if (!selectedUser) return;
    dispatch({ type: 'PILIH_PENGGUNA', pengguna: selectedUser });
    router.replace('/jadwal');
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Presensi Praktikum</Text>
        <Text style={styles.subtitle}>
          Pilih peran dan identitas dummy sebelum masuk
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Peran</Text>
        <View style={styles.roleToggle}>
          <Pressable
            accessibilityRole="button"
            onPress={() => handlePeranChange('asisten')}
            style={[
              styles.roleButton,
              selectedPeran === 'asisten' && styles.roleButtonActive,
            ]}
          >
            <Text
              style={[
                styles.roleText,
                selectedPeran === 'asisten' && styles.roleTextActive,
              ]}
            >
              Asisten
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => handlePeranChange('praktikan')}
            style={[
              styles.roleButton,
              selectedPeran === 'praktikan' && styles.roleButtonActive,
            ]}
          >
            <Text
              style={[
                styles.roleText,
                selectedPeran === 'praktikan' && styles.roleTextActive,
              ]}
            >
              Praktikan
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Pilih Identitas</Text>
        <View style={styles.userList}>
          {filteredUsers.map((user) => {
            const isSelected = selectedUser?.id === user.id;
            let infoLine = '';
            if (user.peran === 'praktikan') {
              const p = user as Praktikan;
              const kelas = state.kelas.find((k) => k.id === p.kelasId);
              infoLine = `${p.nim} · ${kelas?.nama || ''}`;
            } else {
              const a = user as Asisten;
              infoLine = `NIP ${a.nip}`;
            }

            return (
              <Pressable
                key={user.id}
                accessibilityRole="button"
                onPress={() => setSelectedUser(user)}
                style={[
                  styles.userOption,
                  isSelected && styles.userOptionSelected,
                ]}
              >
                <View style={styles.radioOuter}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.nama}</Text>
                  <Text style={styles.userSubtext}>{infoLine}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {!selectedUser && (
          <Text style={styles.helperText}>
            Pilih identitas terlebih dahulu.
          </Text>
        )}
      </View>

      <View style={styles.actionContainer}>
        <AppButton
          label="Masuk"
          variant="primary"
          disabled={!selectedUser}
          onPress={handleMasuk}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  section: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
  },
  roleButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  roleButtonActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  roleTextActive: {
    color: Colors.primary,
  },
  userList: {
    gap: Spacing.sm,
  },
  userOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  userOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  userSubtext: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  helperText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  actionContainer: {
    marginTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
});
