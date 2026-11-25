import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  defaultPermissionRepository,
  type PermissionRepository,
  type PermissionServiceOptions,
} from '@/services/permissionService';
import { AsistenLeaveReviewList } from './AsistenLeaveReviewList';
import { PraktikanLeaveForm } from './PraktikanLeaveForm';
import { PraktikanLeaveHistory } from './PraktikanLeaveHistory';
import type { LeaveSessionOption, PermissionActor } from './types';

export interface PermissionsScreenProps {
  actor: PermissionActor | null;
  sessions?: LeaveSessionOption[];
  repository?: PermissionRepository;
  serviceOptions?: PermissionServiceOptions;
}

export function PermissionsScreen({
  actor,
  sessions = [],
  repository = defaultPermissionRepository,
  serviceOptions,
}: PermissionsScreenProps) {
  if (!actor) {
    return (
      <ScreenContainer variant="gradient">
        <EmptyState
          title="Sesi login belum tersedia"
          description="Masuk terlebih dahulu untuk mengakses pengajuan dan pemeriksaan izin praktikum."
        />
      </ScreenContainer>
    );
  }

  const mergedServiceOptions: PermissionServiceOptions = {
    ...serviceOptions,
    repository,
  };

  const isReviewer = actor.role !== 'praktikan';

  return (
    <ScreenContainer variant="gradient">
      <View style={styles.header}>
        <Text style={styles.title}>
          {isReviewer ? 'Pemeriksaan Izin' : 'Pengajuan Izin'}
        </Text>
        <Text style={styles.subtitle}>
          {isReviewer
            ? 'Tinjau pengajuan izin praktikan & klasifikasi AI'
            : 'Ajukan izin ketidakhadiran & pantau keputusan asisten'}
        </Text>
      </View>

      {actor.role === 'praktikan' ? (
        <View style={styles.content}>
          <PraktikanLeaveForm
            key={actor.uid}
            actor={actor}
            sessions={sessions}
            serviceOptions={mergedServiceOptions}
          />
          <PraktikanLeaveHistory
            actor={actor}
            repository={repository}
            serviceOptions={mergedServiceOptions}
          />
        </View>
      ) : (
        <AsistenLeaveReviewList
          actor={actor}
          repository={repository}
          serviceOptions={mergedServiceOptions}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  content: {
    gap: Spacing.md,
  },
});
