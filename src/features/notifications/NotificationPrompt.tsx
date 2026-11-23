import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/useNotifications';

/**
 * Banner aktivasi & status izin push notification (SRS-07 & SRS-08).
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
      <AppCard style={styles.card}>
        <View style={styles.activeHeader}>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Aktif</Text>
          </View>
          <Text style={styles.activeTitle}>Push Notification Praktikum</Text>
        </View>
        <Text style={styles.activeDesc}>
          {tokenShort
            ? `Perangkat terdaftar untuk info sesi dibuka, perubahan jadwal, dan keputusan izin (${tokenShort}).`
            : statusMessage ||
              'Izin notifikasi aktif. Aplikasi siap menerima pemberitahuan kegiatan praktikum.'}
        </Text>
      </AppCard>
    );
  }

  const isPermanentlyDenied = permissionStatus === 'denied' && !canAskAgain;

  return (
    <AppCard style={styles.card}>
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
  card: {
    gap: 10,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  activeBadge: {
    backgroundColor: Colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  activeBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.success,
  },
  activeTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  activeDesc: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  actionWrap: {
    marginTop: 2,
  },
});
