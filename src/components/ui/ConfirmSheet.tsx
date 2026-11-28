import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { AppButton } from './AppButton';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Batal',
  tone = 'primary',
  children,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const [submitting, setSubmitting] = React.useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={submitting ? undefined : onClose} />
        <View style={styles.sheetContainer} accessibilityViewIsModal>
          <SafeAreaView edges={['bottom']} style={styles.safeArea}>
            <View style={styles.content}>
              <View style={styles.dragHandle} />
              <Text style={styles.title}>{title}</Text>
              {description ? (
                <Text style={styles.description}>{description}</Text>
              ) : null}
              {children}

              <View style={styles.actionRow}>
                <View style={styles.buttonWrapper}>
                  <AppButton
                    label={cancelLabel}
                    variant="secondary"
                    disabled={submitting}
                    onPress={onClose}
                  />
                </View>
                <View style={styles.buttonWrapper}>
                  <AppButton
                    label={confirmLabel}
                    variant={tone === 'danger' ? 'danger' : 'primary'}
                    loading={submitting}
                    disabled={submitting}
                    onPress={handleConfirm}
                  />
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.backdrop,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    ...Shadow.floating,
  },
  safeArea: {
    width: '100%',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm + 4,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.handle,
    alignSelf: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  description: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  buttonWrapper: {
    flex: 1,
  },
});
