import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.bellButton,
          pressed && styles.bellButtonPressed,
        ]}
      >
        <Text style={styles.bellIcon}>🔔</Text>
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Pemberitahuan</Text>
                <Text style={styles.sheetSubtitle}>
                  {unreadCount > 0
                    ? `${unreadCount} pemberitahuan belum dibaca`
                    : 'Semua pemberitahuan sudah dibaca'}
                </Text>
              </View>
              <Pressable
                onPress={() => setVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>Tutup</Text>
              </Pressable>
            </View>

            {unreadCount > 0 ? (
              <View style={styles.markAllWrap}>
                <AppButton
                  label="Tandai Semua Dibaca"
                  variant="ghost"
                  onPress={markAllAsRead}
                />
              </View>
            ) : null}

            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
            >
              {notifications.length === 0 ? (
                <EmptyState
                  title="Belum ada notifikasi"
                  description="Pemberitahuan saat sesi dibuka, jadwal berubah, atau keputusan izin akan muncul di sini."
                />
              ) : (
                notifications.map((item) => {
                  const meta = TYPE_META[item.type] ?? TYPE_META.session_opened;
                  const unread = !item.read;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => handleSelectItem(item)}
                      style={({ pressed }) => [
                        styles.notifItem,
                        unread && styles.notifItemUnread,
                        pressed && styles.notifItemPressed,
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
                        <Text style={styles.timeText}>
                          {formatNotificationTime(item.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.notifTitle}>{item.title}</Text>
                      <Text style={styles.notifBody}>{item.body}</Text>
                      <Text style={styles.tapHint}>Ketuk untuk membuka layar terkait →</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellButtonPressed: {
    backgroundColor: Colors.neutralSoft,
  },
  bellIcon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  sheetSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  closeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutralSoft,
  },
  closeBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  markAllWrap: {
    alignSelf: 'flex-end',
  },
  listScroll: {
    flexGrow: 0,
  },
  listContent: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  notifItem: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  notifItemUnread: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  notifItemPressed: {
    opacity: 0.88,
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  typeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  notifTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  notifBody: {
    fontSize: FontSize.xs,
    color: Colors.text,
    lineHeight: 18,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 2,
  },
});
