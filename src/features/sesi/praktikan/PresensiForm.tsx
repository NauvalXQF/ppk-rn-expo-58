import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { AppCard } from '@/components/ui/AppCard';
import { FormField } from '@/components/ui/FormField';
import { AppButton } from '@/components/ui/AppButton';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface PresensiFormProps {
  onSubmit: (catatan: string) => void;
  disabled?: boolean;
}

export function PresensiForm({ onSubmit, disabled = false }: PresensiFormProps) {
  const [catatan, setCatatan] = useState('');
  const [konfirmasiChecked, setKonfirmasiChecked] = useState(false);

  const handleSubmit = () => {
    if (!konfirmasiChecked || disabled) return;
    onSubmit(catatan);
  };

  return (
    <AppCard style={styles.card}>
      <SectionHeader title="Presensi Kehadiran" />

      <FormField
        label="Catatan (opsional)"
        placeholder="Mis. Hadir di Lab 3"
        value={catatan}
        onChangeText={setCatatan}
        maxLength={120}
        counter={`${catatan.length}/120`}
        multiline
        editable={!disabled}
      />

      <Pressable
        onPress={() => !disabled && setKonfirmasiChecked((prev) => !prev)}
        style={styles.checkboxRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: konfirmasiChecked }}
      >
        <View
          style={[
            styles.checkboxBox,
            konfirmasiChecked && styles.checkboxBoxChecked,
          ]}
        >
          {konfirmasiChecked ? (
            <Text style={styles.checkboxCheck}>✓</Text>
          ) : null}
        </View>
        <Text style={styles.checkboxLabel}>
          Saya mengonfirmasi kehadiran pada sesi ini
        </Text>
      </Pressable>

      <AppButton
        label="Konfirmasi Presensi"
        onPress={handleSubmit}
        disabled={!konfirmasiChecked || disabled}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm / 2,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxBoxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
});
