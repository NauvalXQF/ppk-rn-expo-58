import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatWaktuPresensi } from '@/utils/date';
import { formatRupiah } from '@/services/fines/fineCalculationService';
import { DEFAULT_LATE_FINE_AMOUNT, type LateStatus } from '@/types/fine';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';

interface PresensiSuccessProps {
  waktuPresensi: string;
  catatan?: string;
  showButton?: boolean;
  lateStatus?: LateStatus;
  lateMinutes?: number;
  fineAmount?: number;
}

export function PresensiSuccess({
  waktuPresensi,
  catatan,
  showButton = true,
  lateStatus,
  lateMinutes,
  fineAmount,
}: PresensiSuccessProps) {
  const formattedTime = formatWaktuPresensi(waktuPresensi);
  const isLate = lateStatus === 'late';
  const titleText =
    lateStatus === 'late'
      ? 'Presensi Berhasil (Terlambat)'
      : lateStatus === 'on_time'
        ? 'Presensi Berhasil (Tepat Waktu)'
        : 'Presensi Berhasil';

  const resolvedFineAmount = fineAmount ?? DEFAULT_LATE_FINE_AMOUNT;
  const descriptionText = isLate
    ? `Terlambat ${lateMinutes ?? 1} menit melewati batas toleransi · 1 tagihan denda ${formatRupiah(resolvedFineAmount)} diterbitkan.`
    : 'Kehadiranmu sudah tersimpan tepat waktu di sistem.';

  return (
    <View style={styles.container}>
      <AppCard style={[styles.card, isLate && styles.cardLate]}>
        <View style={styles.badgeRow}>
          <View style={[styles.iconCircle, isLate && styles.iconCircleLate]}>
            <Text style={styles.checkIcon}>{isLate ? '!' : '✓'}</Text>
          </View>
          <Text style={[styles.title, isLate && styles.titleLate]}>
            {titleText}
          </Text>
        </View>

        <Text style={styles.timeText}>Tercatat pukul {formattedTime} WIB</Text>
        <Text style={styles.description}>{descriptionText}</Text>

        {catatan ? (
          <View style={styles.catatanBox}>
            <Text style={styles.catatanLabel}>Catatan:</Text>
            <Text style={styles.catatanText}>{catatan}</Text>
          </View>
        ) : null}
      </AppCard>

      {showButton ? (
        <AppButton
          label="Sudah Presensi"
          onPress={() => {}}
          disabled
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.successSoft,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  cardLate: {
    backgroundColor: Colors.warningSoft,
    borderColor: Colors.border,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleLate: {
    backgroundColor: Colors.warning,
  },
  checkIcon: {
    color: Colors.textOnDark,
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
  },
  title: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.semibold,
    color: Colors.success,
  },
  titleLate: {
    color: Colors.warning,
  },
  timeText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  description: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    lineHeight: 19,
  },
  catatanBox: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 2,
  },
  catatanLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  catatanText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.text,
  },
});
