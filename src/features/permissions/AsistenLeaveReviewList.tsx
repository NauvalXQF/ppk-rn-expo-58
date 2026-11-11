import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  decideLeaveRequest,
  defaultPermissionRepository,
  type PermissionRepository,
  type PermissionServiceOptions,
} from '@/services/permissionService';
import { safeFormatDate, safeFormatTime } from './formatters';
import {
  AiClassificationBadge,
  LeaveDecisionBadge,
} from './LeaveStatusBadge';
import { useLeaveSubscription } from './useLeaveSubscription';
import type {
  LeaveDecisionStatus,
  LeaveRequest,
  PermissionActor,
} from './types';

type FilterOption = 'all' | LeaveDecisionStatus;

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
];

export interface AsistenLeaveReviewListProps {
  actor: PermissionActor;
  repository?: PermissionRepository;
  serviceOptions?: PermissionServiceOptions;
}

export function AsistenLeaveReviewList({
  actor,
  repository = defaultPermissionRepository,
  serviceOptions,
}: AsistenLeaveReviewListProps) {
  const { requests, loading, error: loadError } = useLeaveSubscription(
    'asisten',
    actor,
    repository,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    request: LeaveRequest;
    decision: 'approved' | 'rejected';
  } | null>(null);

  const counts = useMemo(() => {
    const summary: Record<FilterOption, number> = {
      all: requests.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const item of requests) {
      summary[item.status] += 1;
    }
    return summary;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (activeFilter === 'all') return requests;
    return requests.filter((item) => item.status === activeFilter);
  }, [activeFilter, requests]);

  const handleConfirmDecision = async () => {
    if (!pendingDecision) return;
    const { request, decision } = pendingDecision;
    setActionError(null);
    setSubmittingId(request.id);
    setPendingDecision(null);

    try {
      await decideLeaveRequest(
        {
          actor,
          requestId: request.id,
          decision,
        },
        {
          ...serviceOptions,
          repository,
        },
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan keputusan izin.',
      );
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Pemeriksaan Pengajuan Izin"
        rightText={`${counts.pending} menunggu`}
      />

      <InfoBanner
        tone="info"
        message="Klasifikasi AI hanya bersifat informasi pendukung."
        description="Keputusan menerima atau menolak pengajuan izin sepenuhnya berada pada asisten."
      />

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((option) => {
          const selected = activeFilter === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setActiveFilter(option.key)}
              style={[
                styles.filterChip,
                selected && styles.filterChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  selected && styles.filterTextSelected,
                ]}
              >
                {option.label} ({counts[option.key]})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {actionError ? <InfoBanner tone="danger" message={actionError} /> : null}

      {loading ? (
        <AppCard style={styles.loadingCard}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat daftar pengajuan izin...</Text>
        </AppCard>
      ) : loadError ? (
        <InfoBanner tone="danger" message={loadError} />
      ) : filteredRequests.length === 0 ? (
        <AppCard>
          <EmptyState
            title="Tidak ada pengajuan izin"
            description={
              activeFilter === 'all'
                ? 'Belum ada praktikan yang mengirimkan pengajuan izin.'
                : 'Tidak ada pengajuan izin dengan status yang dipilih.'
            }
          />
        </AppCard>
      ) : (
        <View style={styles.list}>
          {filteredRequests.map((item) => {
            const isSubmitting = submittingId === item.id;
            const isPending = item.status === 'pending';

            return (
              <AppCard key={item.id} style={styles.itemCard}>
                <View style={styles.headerRow}>
                  <View style={styles.identityBlock}>
                    <Text style={styles.praktikanName}>
                      {item.praktikanName}
                    </Text>
                    <Text style={styles.metaText}>
                      {item.praktikanNim ? `${item.praktikanNim} · ` : ''}
                      {item.className || item.classId}
                    </Text>
                  </View>
                  <LeaveDecisionBadge status={item.status} />
                </View>

                <Text style={styles.sessionText}>
                  {item.sessionTopic} · {safeFormatDate(item.sessionDate)}
                </Text>

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Alasan Izin</Text>
                  <Text style={styles.reasonText}>{item.reason}</Text>
                </View>

                <View style={styles.aiSection}>
                  <Text style={styles.aiSectionLabel}>
                    Informasi Pendukung AI
                  </Text>
                  <AiClassificationBadge classification={item.aiClassification} />
                  {item.aiClassification.status === 'failed' &&
                  item.aiClassification.errorMessage ? (
                    <Text style={styles.aiErrorText}>
                      {item.aiClassification.errorMessage}
                    </Text>
                  ) : null}
                </View>

                {isPending ? (
                  <View style={styles.actionRow}>
                    <View style={styles.actionButton}>
                      <AppButton
                        label="Tolak"
                        variant="danger"
                        disabled={isSubmitting}
                        loading={isSubmitting}
                        onPress={() =>
                          setPendingDecision({
                            request: item,
                            decision: 'rejected',
                          })
                        }
                      />
                    </View>
                    <View style={styles.actionButton}>
                      <AppButton
                        label="Terima"
                        variant="primary"
                        disabled={isSubmitting}
                        loading={isSubmitting}
                        onPress={() =>
                          setPendingDecision({
                            request: item,
                            decision: 'approved',
                          })
                        }
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.footerRow}>
                    <Text style={styles.footerText}>
                      Dikirim {safeFormatTime(item.createdAt)}
                    </Text>
                    {item.decidedAt ? (
                      <Text style={styles.footerText}>
                        Diputuskan {safeFormatTime(item.decidedAt)}
                        {item.decidedByName ? ` (${item.decidedByName})` : ''}
                      </Text>
                    ) : null}
                  </View>
                )}
              </AppCard>
            );
          })}
        </View>
      )}

      <ConfirmSheet
        visible={pendingDecision !== null}
        title={
          pendingDecision?.decision === 'approved'
            ? 'Setujui pengajuan izin?'
            : 'Tolak pengajuan izin?'
        }
        description={
          pendingDecision
            ? `${pendingDecision.request.praktikanName} · ${pendingDecision.request.sessionTopic}\nAlasan: ${pendingDecision.request.reason}`
            : undefined
        }
        confirmLabel={
          pendingDecision?.decision === 'approved'
            ? 'Ya, Setujui'
            : 'Ya, Tolak'
        }
        tone={
          pendingDecision?.decision === 'rejected' ? 'danger' : 'primary'
        }
        onConfirm={handleConfirmDecision}
        onClose={() => setPendingDecision(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  filterText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterTextSelected: {
    color: Colors.primary,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  list: {
    gap: Spacing.md,
  },
  itemCard: {
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  identityBlock: {
    flex: 1,
    minWidth: 160,
    gap: 2,
  },
  praktikanName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  sessionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  reasonBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: 2,
  },
  reasonLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  reasonText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  aiSection: {
    gap: Spacing.xs,
  },
  aiSectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  aiErrorText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.neutralSoft,
    paddingTop: Spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
