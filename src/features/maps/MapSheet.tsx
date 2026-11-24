import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/ui/AppIcon';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';

export function MapSheet({
  title,
  onClose,
  children,
  fullScreen = false,
}: PropsWithChildren<{
  title: string;
  onClose: () => void;
  fullScreen?: boolean;
}>) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {!fullScreen ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Tutup panel"
            accessibilityRole="button"
            onPress={onClose}
          />
        ) : null}
        <SafeAreaView
          edges={
            fullScreen
              ? ['top', 'bottom', 'left', 'right']
              : ['bottom', 'left', 'right']
          }
          style={fullScreen ? styles.fullScreen : styles.panel}
          accessibilityViewIsModal
        >
          {!fullScreen ? <View style={styles.handle} /> : null}
          <View style={[styles.header, fullScreen && styles.fullScreenHeader]}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {!fullScreen ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup panel"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeCircle,
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon name="x" size={18} color={Colors.text} />
              </Pressable>
            ) : null}
          </View>
          {fullScreen ? (
            children
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.backdrop,
  },
  panel: {
    maxHeight: '88%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: Colors.surface,
    paddingTop: 12,
    ...Shadow.floating,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.handle,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fullScreenHeader: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: Colors.text,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});
