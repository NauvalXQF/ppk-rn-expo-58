import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Spacing } from '@/constants/theme';
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
      <ScreenContainer>
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

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>
          {actor.role === 'asisten' ? 'Pemeriksaan Izin' : 'Pengajuan Izin'}
        </Text>
        <Text style={styles.subtitle}>
          {actor.role === 'asisten'
            ? 'Tinjau pengajuan izin praktikan beserta informasi klasifikasi AI'
            : 'Ajukan izin ketidakhadiran dan pantau keputusan asisten'}
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
          <PraktikanLeaveHistory actor={actor} repository={repository} />
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
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  content: {
    gap: Spacing.lg,
  },
});

