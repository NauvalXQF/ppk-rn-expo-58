import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import type { BulkRowItem, BulkType } from '@/services/aslab/bulkCsvService';

export interface BulkPreviewScrollListProps<T extends Record<string, string>> {
  type: BulkType;
  rows: BulkRowItem<T>[];
  fieldLabels: Record<keyof T, string>;
  onToggleStatus: (rowId: string, status: 'accepted' | 'denied') => void;
  onChangeField: (rowId: string, fieldKey: keyof T, value: string) => void;
  onSave: () => void;
  saving?: boolean;
  saveError?: string | null;
  saveSuccess?: string | null;
}

export function BulkPreviewScrollList<T extends Record<string, string>>({
  type,
  rows,
  fieldLabels,
  onToggleStatus,
  onChangeField,
  onSave,
  saving = false,
  saveError,
  saveSuccess,
}: BulkPreviewScrollListProps<T>) {
  const acceptedCount = rows.filter((r) => r.status === 'accepted').length;
  const deniedCount = rows.filter((r) => r.status === 'denied').length;
  const invalidAcceptedCount = rows.filter((r) => r.status === 'accepted' && !r.isValid).length;

  const canSave = acceptedCount > 0 && invalidAcceptedCount === 0 && !saving;

  return (
    <View style={styles.container}>
      {/* Pill Summary Header */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryText}>
            <Text style={styles.summaryAccepted}>{acceptedCount} diterima</Text>
            {' · '}
            <Text style={styles.summaryDenied}>{deniedCount} ditolak</Text>
            {invalidAcceptedCount > 0 ? (
              <>
                {' · '}
                <Text style={styles.summaryWarning}>{invalidAcceptedCount} perlu dilengkapi</Text>
              </>
            ) : null}
          </Text>
        </View>
      </View>

      {saveError ? (
        <View style={styles.bannerMargin}>
          <InfoBanner tone="danger" message={saveError} />
        </View>
      ) : null}

      {saveSuccess ? (
        <View style={styles.bannerMargin}>
          <InfoBanner tone="success" message={saveSuccess} />
        </View>
      ) : null}

      {/* Main ScrollView containing row cards */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {rows.map((row) => {
          const isAccepted = row.status === 'accepted';
          const hasErrors = Object.keys(row.errors).length > 0;

          return (
            <AppCard
              key={row.id}
              variant="solid"
              style={[
                styles.rowCard,
                !isAccepted && styles.rowCardDenied,
                isAccepted && hasErrors && styles.rowCardWarning,
              ]}
            >
              {/* Row Header with index and Accept/Deny toggle */}
              <View style={styles.rowHeader}>
                <View style={styles.rowHeaderLeft}>
                  <View style={[styles.indexBadge, !isAccepted && styles.indexBadgeDenied]}>
                    <Text style={styles.indexBadgeText}>#{row.index}</Text>
                  </View>
                  <Text style={styles.rowTitle}>
                    {type === 'laboratorium'
                      ? (row.data.nama || `Laboratorium ${row.index}`)
                      : (row.data.nama || `Baris ${row.index}`)}
                  </Text>
                </View>

                {/* Accept / Deny Toggle Chips */}
                <View style={styles.toggleGroup}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.toggleChip,
                      isAccepted ? styles.toggleChipAcceptActive : styles.toggleChipInactive,
                    ]}
                    onPress={() => onToggleStatus(row.id, 'accepted')}
                    accessibilityRole="button"
                    accessibilityLabel={`Terima baris ${row.index}`}
                  >
                    <AppIcon
                      name="check"
                      size={14}
                      color={isAccepted ? Colors.success : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.toggleText,
                        isAccepted ? styles.toggleTextAcceptActive : styles.toggleTextInactive,
                      ]}
                    >
                      Accept
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.toggleChip,
                      !isAccepted ? styles.toggleChipDenyActive : styles.toggleChipInactive,
                    ]}
                    onPress={() => onToggleStatus(row.id, 'denied')}
                    accessibilityRole="button"
                    accessibilityLabel={`Tolak baris ${row.index}`}
                  >
                    <AppIcon
                      name="x"
                      size={14}
                      color={!isAccepted ? Colors.danger : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.toggleText,
                        !isAccepted ? styles.toggleTextDenyActive : styles.toggleTextInactive,
                      ]}
                    >
                      Deny
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Status Warning if Accepted but has Missing/Invalid Fields */}
              {isAccepted && hasErrors ? (
                <View style={styles.rowWarningBanner}>
                  <AppIcon name="alert-circle" size={14} color={Colors.warning} />
                  <Text style={styles.rowWarningText}>
                    Lengkapi kolom bertanda merah sebelum menyimpan.
                  </Text>
                </View>
              ) : null}

              {/* Editable Fields */}
              <View style={[styles.fieldsContainer, !isAccepted && styles.fieldsDisabled]}>
                {(Object.keys(fieldLabels) as (keyof T)[]).map((key) => {
                  const errorMsg = row.errors[key];
                  const label = fieldLabels[key];
                  const value = row.data[key] ?? '';

                  return (
                    <View key={String(key)} style={styles.fieldWrapper}>
                      <FormField
                        label={label}
                        accessibilityLabel={label}
                        value={value}
                        editable={isAccepted && !saving}
                        onChangeText={(text) => onChangeField(row.id, key, text)}
                        error={isAccepted ? errorMsg : undefined}
                      />
                    </View>
                  );
                })}
              </View>
            </AppCard>
          );
        })}
      </ScrollView>

      {/* Floating Bottom CTA */}
      <View style={styles.footerContainer}>
        <AppButton
          label={`Simpan ${acceptedCount} Data yang Diterima`}
          variant="primary"
          disabled={!canSave}
          loading={saving}
          onPress={onSave}
          style={styles.floatingButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.listBackground,
  },
  summaryContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    alignItems: 'center',
  },
  summaryPill: {
    backgroundColor: Colors.glassStrong,
    borderColor: Colors.glassBorder,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.xs + 2,
  },
  summaryText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  summaryAccepted: {
    color: Colors.success,
    fontFamily: FontFamily.semibold,
  },
  summaryDenied: {
    color: Colors.danger,
    fontFamily: FontFamily.semibold,
  },
  summaryWarning: {
    color: Colors.warning,
    fontFamily: FontFamily.semibold,
  },
  bannerMargin: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 110,
    gap: Spacing.sm + 2,
  },
  rowCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  rowCardDenied: {
    opacity: 0.6,
    backgroundColor: Colors.neutralSoft,
  },
  rowCardWarning: {
    borderColor: Colors.warningSoft,
    borderWidth: 1.5,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    flex: 1,
  },
  indexBadge: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  indexBadgeDenied: {
    backgroundColor: Colors.neutralSoft,
  },
  indexBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  rowTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
    flexShrink: 1,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    minHeight: 32,
  },
  toggleChipInactive: {
    backgroundColor: Colors.neutralSoft,
  },
  toggleChipAcceptActive: {
    backgroundColor: Colors.successSoft,
  },
  toggleChipDenyActive: {
    backgroundColor: Colors.dangerSoft,
  },
  toggleText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
  },
  toggleTextInactive: {
    color: Colors.textMuted,
  },
  toggleTextAcceptActive: {
    color: Colors.success,
    fontFamily: FontFamily.semibold,
  },
  toggleTextDenyActive: {
    color: Colors.danger,
    fontFamily: FontFamily.semibold,
  },
  rowWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  rowWarningText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.warning,
    flex: 1,
  },
  fieldsContainer: {
    gap: Spacing.xs,
    marginTop: 4,
  },
  fieldsDisabled: {
    opacity: 0.5,
  },
  fieldWrapper: {
    marginBottom: 2,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.glassStrong,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    ...Shadow.floating,
  },
  floatingButton: {
    minHeight: 48,
    borderRadius: Radius.pill,
  },
});
