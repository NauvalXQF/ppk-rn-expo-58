import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { RadioOption } from '@/components/ui/RadioOption';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { formatJam } from '@/utils/date';
import { safeFormatDate } from './formatters';
import {
  MAX_LEAVE_REASON_LENGTH,
  submitLeaveRequest,
  validateLeaveReason,
  type PermissionServiceOptions,
} from '@/services/permissionService';
import type {
  LeaveRequest,
  LeaveSessionOption,
  PermissionActor,
} from './types';

export interface PraktikanLeaveFormProps {
  actor: PermissionActor;
  sessions: LeaveSessionOption[];
  serviceOptions?: PermissionServiceOptions;
  onSubmitted?: (request: LeaveRequest) => void;
}

export function PraktikanLeaveForm({
  actor,
  sessions,
  serviceOptions,
  onSubmitted,
}: PraktikanLeaveFormProps) {
  const eligibleSessions = useMemo(() => {
    if (!actor.classIds || actor.classIds.length === 0) {
      return sessions;
    }
    return sessions.filter((s) => actor.classIds?.includes(s.classId));
  }, [actor.classIds, sessions]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    eligibleSessions[0]?.id ?? null,
  );
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'warning';
    message: string;
    description: string;
  } | null>(null);

  const selectedSession =
    eligibleSessions.find((s) => s.id === selectedSessionId) ??
    eligibleSessions[0] ??
    null;

  const handleSubmit = async () => {
    setSubmitError(null);
    setFeedback(null);

    if (!selectedSession) {
      setSubmitError('Pilih sesi praktikum terlebih dahulu.');
      return;
    }

    let validatedReason = '';
    try {
      validatedReason = validateLeaveReason(reason);
      setReasonError(undefined);
    } catch (error) {
      setReasonError(
        error instanceof Error
          ? error.message
          : 'Alasan izin tidak boleh kosong.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitLeaveRequest(
        {
          actor,
          session: selectedSession,
          reason: validatedReason,
        },
        serviceOptions,
      );

      setReason('');
      setReasonError(undefined);

      if (result.aiWarning) {
        setFeedback({
          tone: 'warning',
          message: 'Pengajuan izin tersimpan (menunggu peninjauan asisten).',
          description: `${result.aiWarning} Keputusan izin tetap ditentukan oleh asisten.`,
        });
      } else {
        const category = result.request.aiClassification.category;
        const expNote = result.request.aiClassification.experimental
          ? ' (eksperimental)'
          : '';
        setFeedback({
          tone: 'success',
          message: 'Pengajuan izin berhasil dikirim.',
          description: category
            ? `Klasifikasi pendukung AI${expNote}: ${category}. Status saat ini: Menunggu keputusan asisten.`
            : 'Status saat ini: Menunggu keputusan asisten.',
        });
      }

      onSubmitted?.(result.request);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Gagal mengirim pengajuan izin. Silakan coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (eligibleSessions.length === 0) {
    return (
      <AppCard>
        <SectionHeader title="Ajukan Izin Praktikum" />
        <EmptyState
          title="Belum ada sesi tersedia"
          description="Belum ada jadwal sesi praktikum untuk kelas Anda yang dapat dipilih."
        />
      </AppCard>
    );
  }

  return (
    <AppCard style={styles.card}>
      <SectionHeader title="Ajukan Izin Praktikum" />

      <Text style={styles.sectionLabel}>Pilih Sesi Praktikum</Text>
      <View style={styles.sessionList}>
        {eligibleSessions.map((session) => {
          const isSelected = selectedSession?.id === session.id;
          const timeRange = `${formatJam(session.startTime)}–${formatJam(session.endTime)}`;
          const subtitle = `${session.className} · ${safeFormatDate(session.date)} · ${timeRange}`;

          return (
            <RadioOption
              key={session.id}
              selected={isSelected}
              title={session.topic}
              subtitle={subtitle}
              onPress={() => setSelectedSessionId(session.id)}
            />
          );
        })}
      </View>

      <FormField
        label="Alasan Izin"
        placeholder="Tuliskan alasan ketidakhadiran Anda secara jelas..."
        value={reason}
        onChangeText={(text) => {
          setReason(text);
          if (reasonError && text.trim().length > 0) {
            setReasonError(undefined);
          }
        }}
        multiline
        maxLength={MAX_LEAVE_REASON_LENGTH}
        counter={`${reason.length}/${MAX_LEAVE_REASON_LENGTH}`}
        error={reasonError}
        editable={!submitting}
        helperText="Alasan akan dianalisis AI sebagai informasi pendukung bagi asisten."
      />

      {submitError ? <InfoBanner tone="danger" message={submitError} /> : null}

      {feedback ? (
        <InfoBanner
          tone={feedback.tone}
          message={feedback.message}
          description={feedback.description}
        />
      ) : null}

      <AppButton
        label={submitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Izin'}
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  sessionList: {
    gap: Spacing.sm,
  },
});
