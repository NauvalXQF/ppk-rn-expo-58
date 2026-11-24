import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import type { Laboratory } from '@/types/laboratory';

interface LabPickerModalProps {
  visible: boolean;
  laboratories: Laboratory[];
  selectedLabId?: string;
  onSelectLab: (lab: Laboratory) => void;
  onSelectManual: () => void;
  onClose: () => void;
}

export function LabPickerModal({
  visible,
  laboratories,
  selectedLabId,
  onSelectLab,
  onSelectManual,
  onClose,
}: LabPickerModalProps) {
  const [query, setQuery] = useState('');

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const filteredLabs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return laboratories;
    return laboratories.filter((lab) => {
      const nama = lab.nama.toLowerCase();
      const gedung = (lab.gedung ?? '').toLowerCase();
      const kode = (lab.kode ?? '').toLowerCase();
      return (
        nama.includes(keyword) ||
        gedung.includes(keyword) ||
        kode.includes(keyword)
      );
    });
  }, [laboratories, query]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={handleClose} />
        <View style={styles.sheet}>
          <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>Pilih Laboratorium</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup pemilih laboratorium"
                onPress={handleClose}
                style={styles.closeBtn}
              >
                <AppIcon name="x" size={18} color={Colors.text} />
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <AppIcon name="search" size={16} color={Colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Cari nama lab atau gedung..."
                placeholderTextColor={Colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
              />
              {query.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hapus pencarian"
                  onPress={() => setQuery('')}
                  hitSlop={8}
                >
                  <AppIcon name="x" size={15} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={filteredLabs}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <EmptyState
                  title="Laboratorium tidak ditemukan"
                  description="Coba kata kunci nama lab atau gedung lain, atau gunakan input manual di bawah."
                />
              }
              renderItem={({ item }) => {
                const isSelected = selectedLabId === item.id;
                return (
                  <Pressable
                    onPress={() => {
                      onSelectLab(item);
                      handleClose();
                    }}
                    style={[
                      styles.labRow,
                      isSelected && styles.labRowSelected,
                    ]}
                  >
                    <View style={styles.labInfo}>
                      <View style={styles.labTitleRow}>
                        <Text style={styles.labName}>{item.nama}</Text>
                        {item.kode ? (
                          <View style={styles.codeBadge}>
                            <Text style={styles.codeText}>{item.kode}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.labMeta}>
                        {item.gedung ? `${item.gedung} · ` : ''}
                        Radius Geofence {item.radiusMeters} m
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.checkWrap}>
                        <Text style={styles.checkMark}>✓</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onSelectManual();
                handleClose();
              }}
              style={styles.manualBtn}
            >
              <Text style={styles.manualBtnText}>
                Input Manual (Tanpa Tautan Lab)
              </Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    justifyContent: 'flex-end',
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: Platform.OS === 'web' ? '82%' : '85%',
    ...Shadow.floating,
  },
  sheetSafe: {
    paddingHorizontal: Spacing.md + 4,
    paddingTop: 10,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.handle,
    alignSelf: 'center',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg + 1,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.text,
    paddingVertical: 8,
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    gap: Spacing.xs + 2,
    paddingVertical: 4,
  },
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    backgroundColor: Colors.neutralSoft,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  labRowSelected: {
    backgroundColor: Colors.surface,
    borderColor: Colors.primary,
  },
  labInfo: {
    flex: 1,
    gap: 4,
  },
  labTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  labName: {
    fontSize: FontSize.sm + 1,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  codeBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  labMeta: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.textOnDark,
  },
  manualBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    marginTop: Spacing.xs,
  },
  manualBtnText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
});
