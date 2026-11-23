import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import { useNotifications } from '@/hooks/useNotifications';
import type {
  NotificationAuditRecord,
  NotificationEventType,
} from '@/types/notification';

const TYPE_META: Record<
  NotificationEventType,
  { label: string; bg: string; color: string }
> = {
  session_opened: {
    label: 'Sesi Dibuka',
    bg: Colors.successSoft,
    color: Colors.success,
  },
  schedule_changed: {
    label: 'Jadwal Berubah',
    bg: Colors.warningSoft,
    color: Colors.warning,
  },
  leave_decided: {
    label: 'Keputusan Izin',
    bg: Colors.primarySoft,
    color: Colors.primary,
  },
};

function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} · ${hh}:${mm}`;
}

/**
 * Tombol lonceng notifikasi dengan badge jumlah belum dibaca (unread)
 * serta modal daftar notifikasi interaktif yang mendukung deep linking.
 */
export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
    navigateFromNotification,
  } = useNotifications();
  const [visible, setVisible] = useState(false);

  const handleSelectItem = (item: NotificationAuditRecord) => {
    markAsRead(item.id);
    setVisible(false);
    navigateFromNotification(item.data);
  };

  return (
    <>
      <View style={styles.bellWrap}>
        <IconButton
          accessibilityLabel={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`}
          onPress={() => setVisible(true)}
        >
          <AppIcon name="bell" size={19} color={Colors.text} />
        </IconButton>
        {unreadCount > 0 ? (
          <View pointerEvents="none" style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVisible(false)}
          />
          <View style={styles.sheet}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <View style={styles.titleCol}>
                  <Text style={styles.sheetTitle}>Notifikasi</Text>
                  <Text style={styles.sheetSubtitle}>
                    {unreadCount > 0
                      ? `${unreadCount} belum dibaca`
                      : 'Semua sudah dibaca'}
                  </Text>
                </View>

                <View style={styles.headerActions}>
                  {unreadCount > 0 ? (
                    <Pressable
                      onPress={markAllAsRead}
                      style={({ pressed }) => [
                        styles.markPill,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.markPillText}>Tandai dibaca</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tutup notifikasi"
                    onPress={() => setVisible(false)}
                    style={({ pressed }) => [
                      styles.closeCircle,
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppIcon name="x" size={18} color={Colors.text} />
                  </Pressable>
                </View>
              </View>

              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {notifications.length === 0 ? (
                  <EmptyState
                    title="Belum ada notifikasi"
                    description="Pemberitahuan saat sesi dibuka, jadwal berubah, atau keputusan izin akan muncul di sini."
                  />
                ) : (
                  notifications.map((item) => {
                    const meta =
                      TYPE_META[item.type] ?? TYPE_META.session_opened;
                    const unread = !item.read;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => handleSelectItem(item)}
                        style={({ pressed }) => [
                          styles.notifItem,
                          unread && styles.notifItemUnread,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.notifTopRow}>
                          <View
                            style={[
                              styles.typeChip,
                              { backgroundColor: meta.bg },
                            ]}
                          >
                            <Text
                              style={[styles.typeChipText, { color: meta.color }]}
                            >
                              {meta.label}
                            </Text>
                          </View>
                          <View style={styles.metaRight}>
                            <Text style={styles.timeText}>
                              {formatNotificationTime(item.createdAt)}
                            </Text>
                            {unread ? <View style={styles.unreadDot} /> : null}
                          </View>
                        </View>
                        <Text style={styles.notifTitle}>{item.title}</Text>
                        <Text style={styles.notifBody}>{item.body}</Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FontFamily.semibold,
    color: Colors.textOnDark,
  },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.md + 4,
    paddingTop: 12,
    paddingBottom: Spacing.md,
    ...Shadow.floating,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.handle,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.regular,
    color: Colors.text,
  },
  sheetSubtitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  markPill: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  markPillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  listScroll: {
    maxHeight: 460,
  },
  listContent: {
    gap: 10,
    paddingBottom: Spacing.md,
  },
  notifItem: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    gap: 6,
  },
  notifItemUnread: {
    backgroundColor: Colors.unreadSurface,
    borderColor: Colors.unreadBorder,
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  typeChipText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentBlue,
  },
  notifTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  notifBody: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    lineHeight: 17,
  },
});
