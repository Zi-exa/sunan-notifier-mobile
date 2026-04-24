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
  onClose,
}: AppAlertDialogProps) {
  const { colors, mode } = useTheme();

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
      onRequestClose={onClose}
    >
      <Pressable
        style={[
          styles.backdrop,
          {
            backgroundColor:
              mode === 'dark' ? 'rgba(2, 6, 23, 0.74)' : 'rgba(14, 26, 48, 0.24)',
          },
        ]}
        onPress={onClose}
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

          <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={onClose}>
            <Text style={[styles.buttonText, { color: colors.textInverse }]}>{confirmLabel}</Text>
          </Pressable>
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
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
