import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

export function MapSheet({ title, onClose, children, fullScreen = false }: PropsWithChildren<{
  title: string;
  onClose: () => void;
  fullScreen?: boolean;
}>) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!fullScreen ? <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Tutup panel"
          accessibilityRole="button"
          onPress={onClose}
        /> : null}
        <SafeAreaView edges={fullScreen ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}
          style={fullScreen ? styles.fullScreen : styles.panel} accessibilityViewIsModal>
          <View style={[styles.header, fullScreen && styles.fullScreenHeader]}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {!fullScreen ? <AppButton label="Tutup" onPress={onClose} variant="ghost" /> : null}
          </View>
          {fullScreen ? children : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 24, 40, 0.40)' },
  panel: {
    maxHeight: '88%', width: '100%', maxWidth: 640, alignSelf: 'center',
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, backgroundColor: Colors.surface,
  },
  fullScreen: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    paddingLeft: Spacing.lg, paddingRight: Spacing.sm, paddingTop: Spacing.sm,
    borderBottomColor: Colors.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fullScreenHeader: { paddingBottom: Spacing.sm },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  content: { padding: Spacing.lg, gap: Spacing.md },
});
