import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  defaultPermissionRepository,
  retryLeaveAiClassification,
  type PermissionRepository,
  type PermissionServiceOptions,
} from '@/services/permissionService';
import { safeFormatDate, safeFormatTime } from './formatters';
import {
  AiClassificationBadge,
  LeaveDecisionBadge,
} from './LeaveStatusBadge';
import { useLeaveSubscription } from './useLeaveSubscription';
import type { LeaveRequest, PermissionActor } from './types';

export interface PraktikanLeaveHistoryProps {
  actor: PermissionActor;
  repository?: PermissionRepository;
  serviceOptions?: PermissionServiceOptions;
}

export function PraktikanLeaveHistory({
  actor,
  repository = defaultPermissionRepository,
  serviceOptions,
}: PraktikanLeaveHistoryProps) {
  const { requests, loading, error } = useLeaveSubscription(
    'praktikan',
    actor,
    repository,
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetryAi = async (item: LeaveRequest) => {
    setRetryError(null);
    setRetryingId(item.id);
    try {
      await retryLeaveAiClassification(actor, item, {
        ...serviceOptions,
        repository,
      });
    } catch (err) {
      setRetryError(
        err instanceof Error
          ? err.message
          : 'Gagal mengulang klasifikasi AI.',
      );
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Riwayat Pengajuan Izin"
        rightText={`${requests.length} pengajuan`}
      />

      {retryError ? <InfoBanner tone="danger" message={retryError} /> : null}

      {loading ? (
        <AppCard style={styles.loadingCard}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat riwayat izin...</Text>
        </AppCard>
      ) : error ? (
        <InfoBanner tone="danger" message={error} />
      ) : requests.length === 0 ? (
        <AppCard>
          <EmptyState
            title="Belum ada pengajuan izin"
            description="Pengajuan izin yang Anda kirim akan muncul beserta status keputusan asisten."
          />
        </AppCard>
      ) : (
        <View style={styles.list}>
          {requests.map((item) => {
            const canRetryAi =
              item.aiClassification.status === 'failed' &&
              item.status === 'pending' &&
              actor.uid === item.uid;
            const isRetrying = retryingId === item.id;

            return (
              <AppCard key={item.id} style={styles.itemCard}>
                <View style={styles.headerRow}>
                  <View style={styles.titleBlock}>
                    <Text style={styles.topicText}>{item.sessionTopic}</Text>
                    <Text style={styles.metaText}>
                      {item.className ? `${item.className} · ` : ''}
                      {safeFormatDate(item.sessionDate)}
                    </Text>
                  </View>
                  <LeaveDecisionBadge status={item.status} />
                </View>

                <Text style={styles.reasonText}>{item.reason}</Text>

                <View style={styles.badgeRow}>
                  <AiClassificationBadge
                    classification={item.aiClassification}
                  />
                </View>

                {item.aiClassification.status === 'failed' &&
                item.aiClassification.errorMessage ? (
                  <InfoBanner
                    tone="warning"
                    message={item.aiClassification.errorMessage}
                  />
                ) : null}

                {canRetryAi ? (
                  <AppButton
                    label={
                      isRetrying
                        ? 'Mengulang Klasifikasi AI...'
                        : 'Coba Klasifikasi AI Lagi'
                    }
                    variant="secondary"
                    loading={isRetrying}
                    disabled={retryingId !== null}
                    onPress={() => handleRetryAi(item)}
                  />
                ) : null}

                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>
                    Dikirim {safeFormatTime(item.createdAt)}
                  </Text>
                  {item.status !== 'pending' && item.decidedAt ? (
                    <Text style={styles.footerText}>
                      Diputuskan {safeFormatTime(item.decidedAt)}
                      {item.decidedByName ? ` oleh ${item.decidedByName}` : ''}
                    </Text>
                  ) : null}
                </View>

                {item.decisionNote ? (
                  <Text style={styles.noteText}>
                    Catatan asisten: {item.decisionNote}
                  </Text>
                ) : null}
              </AppCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
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
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  titleBlock: {
    flex: 1,
    minWidth: 160,
    gap: 2,
  },
  topicText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  reasonText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
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
  noteText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
});
