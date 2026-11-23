import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/useNotifications';

/**
 * Banner aktivasi & status izin push notification (SRS-07 & SRS-08).
 * Mengikuti spesifikasi `docs/sprint-3/navigasi-ui.md` §6:
 * menampilkan peringatan jelas saat izin ditolak/nonaktif dengan tombol
 * "Izinkan Pemberitahuan" atau "Buka Pengaturan Aplikasi".
 */
export function NotificationPrompt() {
  const {
    permissionStatus,
    canAskAgain,
    deviceToken,
    tokenState,
    statusMessage,
    requestAndRegister,
    openSettings,
  } = useNotifications();

  const isBusy = tokenState === 'registering';

  if (permissionStatus === 'unsupported') {
    return (
      <InfoBanner
        tone="neutral"
        message="Push notification native tidak tersedia pada platform web."
        description="Gunakan aplikasi Android/iOS (Expo Development Client) untuk menerima notifikasi sistem. Riwayat notifikasi tetap dapat dipantau lewat ikon lonceng."
      />
    );
  }

  if (permissionStatus === 'granted') {
    const tokenShort = deviceToken
      ? `${deviceToken.slice(0, 26)}${deviceToken.length > 26 ? '…' : ''}`
      : null;

    return (
      <AppCard style={styles.activeCard}>
        <View style={styles.activeHeader}>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Aktif</Text>
          </View>
          <Text style={styles.activeTitle}>Push Notification Praktikum</Text>
        </View>
        <Text style={styles.activeDesc}>
          {tokenShort
            ? `Perangkat terdaftar untuk menerima notifikasi sesi dibuka, perubahan jadwal, dan keputusan izin (${tokenShort}).`
            : statusMessage ||
              'Izin notifikasi aktif. Aplikasi siap menerima pemberitahuan kegiatan praktikum.'}
        </Text>
      </AppCard>
    );
  }

  const isPermanentlyDenied = permissionStatus === 'denied' && !canAskAgain;

  return (
    <AppCard style={styles.promptCard}>
      <InfoBanner
        tone="warning"
        message="Pemberitahuan push nonaktif. Anda mungkin melewatkan info sesi dibuka."
        description={
          isPermanentlyDenied
            ? 'Izin notifikasi telah ditolak di sistem operasi. Buka pengaturan aplikasi untuk mengaktifkannya kembali.'
            : 'Aktifkan notifikasi agar langsung mendapat kabar saat asisten membuka sesi, mengubah jadwal, atau memutuskan pengajuan izin.'
        }
      />
      <View style={styles.actionWrap}>
        {isPermanentlyDenied ? (
          <AppButton
            label="Buka Pengaturan Aplikasi"
            variant="primary"
            onPress={() => {
              openSettings().catch(() => {});
            }}
          />
        ) : (
          <AppButton
            label="Izinkan Pemberitahuan"
            variant="primary"
            loading={isBusy}
            onPress={() => {
              requestAndRegister().catch(() => {});
            }}
          />
        )}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  promptCard: {
    gap: Spacing.sm,
  },
  actionWrap: {
    marginTop: Spacing.xs,
  },
  activeCard: {
    gap: Spacing.xs,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  activeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.successSoft,
  },
  activeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.success,
  },
  activeTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  activeDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
