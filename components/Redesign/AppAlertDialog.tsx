import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, Shadow } from './theme';
import { useTheme } from './ThemeContext';

export type AppAlertTone = 'success' | 'info' | 'warning';

type AppAlertDialogProps = {
  visible: boolean;
  tone?: AppAlertTone;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  confirmDisabled?: boolean;
  dismissDisabled?: boolean;
  onClose: () => void;
};

const TONE_ICON: Record<AppAlertTone, React.ComponentProps<typeof FontAwesome>['name']> = {
  success: 'check-circle',
  info: 'info-circle',
  warning: 'warning',
};

export function AppAlertDialog({
  visible,
  tone = 'info',
  title,
  message,
  confirmLabel = 'Tutup',
  cancelLabel,
  onConfirm,
  confirmDisabled = false,
  dismissDisabled = false,
  onClose,
}: AppAlertDialogProps) {
  const { colors, mode } = useTheme();
  const handleDismiss = dismissDisabled ? () => undefined : onClose;

  const toneColor =
    tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.accent;
  const toneBackground =
    tone === 'success'
      ? colors.successDim
      : tone === 'warning'
        ? colors.warningDim
        : colors.accentDim;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Pressable
        style={[
          styles.backdrop,
          {
            backgroundColor:
              mode === 'dark' ? 'rgba(2, 6, 23, 0.74)' : 'rgba(14, 26, 48, 0.24)',
          },
        ]}
        onPress={handleDismiss}
      >
        <Pressable
          style={[
            styles.dialog,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.borderSubtle,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.iconWrap, { backgroundColor: toneBackground }]}>
            <FontAwesome name={TONE_ICON[tone]} size={22} color={toneColor} />
          </View>

          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          </View>

          <View style={styles.buttonRow}>
            {cancelLabel ? (
              <Pressable
                style={[
                  styles.button,
                  styles.secondaryButton,
                  { backgroundColor: colors.bgCardHover, borderColor: colors.borderSubtle },
                ]}
                onPress={onClose}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                  {cancelLabel}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: colors.accent },
                confirmDisabled && styles.buttonDisabled,
              ]}
              onPress={onConfirm ?? onClose}
              disabled={confirmDisabled}
            >
              <Text style={[styles.buttonText, { color: colors.textInverse }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 16,
    ...Shadow.card,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  copy: {
    gap: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  button: {
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
  },
  primaryButton: {
    flex: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
