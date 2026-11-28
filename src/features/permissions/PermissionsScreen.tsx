import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { AppIcon } from '@/components/ui/AppIcon';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
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
  initialSessionId?: string;
  existingLeaves?: { sessionId: string; status: 'pending' | 'approved' | 'rejected' }[];
}

export function PermissionsScreen({
  actor,
  sessions = [],
  repository = defaultPermissionRepository,
  serviceOptions,
  initialSessionId,
  existingLeaves,
}: PermissionsScreenProps) {
  const router = useRouter();
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
        {!isReviewer ? (
          <View style={styles.headerTopRow}>
            <IconButton
              accessibilityLabel="Kembali"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/kehadiran' as Href);
                }
              }}
            >
              <AppIcon name="chevron-left" size={20} color={Colors.text} />
            </IconButton>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Pengajuan Izin</Text>
              <Text style={styles.subtitle}>
                Ajukan izin ketidakhadiran & pantau keputusan asisten
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Pemeriksaan Izin</Text>
            <Text style={styles.subtitle}>
              Tinjau pengajuan izin praktikan & klasifikasi AI
            </Text>
          </>
        )}
      </View>

      {actor.role === 'praktikan' ? (
        <View style={styles.content}>
          <PraktikanLeaveForm
            key={actor.uid}
            actor={actor}
            sessions={sessions}
            serviceOptions={mergedServiceOptions}
            initialSessionId={initialSessionId}
            existingLeaves={existingLeaves}
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
