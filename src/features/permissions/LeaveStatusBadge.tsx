import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  AI_STATUS_LABEL,
  LEAVE_DECISION_LABEL,
  type AiClassificationResult,
  type LeaveDecisionStatus,
} from './types';

interface LeaveDecisionBadgeProps {
  status: LeaveDecisionStatus;
}

const decisionTone: Record<
  LeaveDecisionStatus,
  { backgroundColor: string; color: string }
> = {
  pending: {
    backgroundColor: Colors.warningSoft,
    color: Colors.warning,
  },
  approved: {
    backgroundColor: Colors.successSoft,
    color: Colors.success,
  },
  rejected: {
    backgroundColor: Colors.dangerSoft,
    color: Colors.danger,
  },
};

export function LeaveDecisionBadge({ status }: LeaveDecisionBadgeProps) {
  const tone = decisionTone[status] ?? decisionTone.pending;

  return (
    <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.label, { color: tone.color }]}>
        {LEAVE_DECISION_LABEL[status] ?? status}
      </Text>
    </View>
  );
}

interface AiClassificationBadgeProps {
  classification: AiClassificationResult;
}

export function AiClassificationBadge({
  classification,
}: AiClassificationBadgeProps) {
  let backgroundColor: string = Colors.neutralSoft;
  let color: string = Colors.textMuted;
  let label: string = AI_STATUS_LABEL[classification.status];

  if (classification.status === 'completed' && classification.category) {
    backgroundColor = Colors.primarySoft;
    color = Colors.primary;
    const confidencePct =
      typeof classification.confidence === 'number'
        ? classification.confidence <= 1
          ? Math.round(classification.confidence * 100)
          : Math.round(classification.confidence)
        : null;
    label =
      confidencePct !== null
        ? `AI: ${classification.category} (${confidencePct}%)`
        : `AI: ${classification.category}`;
  } else if (classification.status === 'failed') {
    backgroundColor = Colors.warningSoft;
    color = Colors.warning;
    label = 'AI: Gagal klasifikasi';
  }

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});

