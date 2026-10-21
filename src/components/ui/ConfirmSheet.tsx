import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { AppButton } from './AppButton';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string; // default "Batal"
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Batal',
  tone = 'primary',
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>{title}</Text>
            {description ? (
              <Text style={styles.description}>{description}</Text>
            ) : null}

            <View style={styles.buttonRow}>
              <View style={styles.buttonWrapper}>
                <AppButton
                  label={cancelLabel}
                  variant="secondary"
                  onPress={onClose}
                />
              </View>
              <View style={styles.buttonWrapper}>
                <AppButton
                  label={confirmLabel}
                  variant={tone === 'danger' ? 'danger' : 'primary'}
                  onPress={() => {
                    onConfirm();
                  }}
                />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  buttonWrapper: {
    flex: 1,
  },
});

