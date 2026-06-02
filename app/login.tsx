import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AppAlertDialog, useTheme } from '@/components/Redesign';
import { CONFIG, SECURE_KEYS } from '@/lib/config';
import { isMaintenanceMessage } from '@/lib/moodle/errors';
import { getSecureItem, removeSecureItem, setSecureItem } from '@/lib/storage/secureStore';
import { useAuthStore } from '@/lib/stores/authStore';

type SavedCredentials = { nim: string; password: string };

function parseSavedCredentials(raw: string | null): SavedCredentials | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedCredentials;
  } catch {
    return null;
  }
}

function parseSavedCredentialsPreference(raw: string | null): boolean | null {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export default function LoginScreen() {
  const { colors, mode } = useTheme();
  const status = useAuthStore((state) => state.status);
  const hydrated = useAuthStore((state) => state.hydrated);
  const error = useAuthStore((state) => state.error);
  const logoutNotice = useAuthStore((state) => state.logoutNotice);
  const clearError = useAuthStore((state) => state.clearError);
  const clearLogoutNotice = useAuthStore((state) => state.clearLogoutNotice);
  const login = useAuthStore((state) => state.login);

  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState<boolean | null>(null);
  const [savedCredentials, setSavedCredentials] = useState<SavedCredentials | null>(null);
  const [showSavedSuggestion, setShowSavedSuggestion] = useState(false);
  const [maintenanceAlertVisible, setMaintenanceAlertVisible] = useState(false);

  useEffect(() => {
    Promise.all([
      getSecureItem(SECURE_KEYS.savedCredentials),
      getSecureItem(SECURE_KEYS.savedCredentialsPreference),
    ]).then(([savedCredentialsRaw, preferenceRaw]) => {
      const creds = parseSavedCredentials(savedCredentialsRaw);
      const preference = parseSavedCredentialsPreference(preferenceRaw);

      if (creds) {
        setSavedCredentials(creds);
      }

      if (preference !== null) {
        setRememberCredentials(preference);
        return;
      }

      if (creds) {
        setRememberCredentials(true);
      }
    });
  }, []);

  useEffect(() => {
    if (isMaintenanceMessage(error)) {
      setMaintenanceAlertVisible(true);
    }
  }, [error]);

  if (!hydrated) {
    return null;
  }

  if (status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  const isLoading = status === 'loading';
  const hasSavedCredentials = savedCredentials !== null;
  const shouldShowRememberPrompt = rememberCredentials === null;
  const canShowSavedSuggestion =
    rememberCredentials === true && hasSavedCredentials && showSavedSuggestion;
  const isDark = mode === 'dark';

  const handleChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    if (error) clearError();
  };

  const handleFillSaved = () => {
    if (savedCredentials) {
      setNim(savedCredentials.nim);
      setPassword(savedCredentials.password);
      setShowSavedSuggestion(false);
      if (error) clearError();
    }
  };

  const handleRememberCredentialsChange = async (nextValue: boolean) => {
    setRememberCredentials(nextValue);
    setShowSavedSuggestion(false);
    await setSecureItem(SECURE_KEYS.savedCredentialsPreference, String(nextValue));

    if (!nextValue && savedCredentials) {
      await removeSecureItem(SECURE_KEYS.savedCredentials);
      setSavedCredentials(null);
    }

    if (error) clearError();
  };

  const handleCredentialsFieldFocus = () => {
    if (rememberCredentials === true && hasSavedCredentials) {
      setShowSavedSuggestion(true);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: colors.bgBase }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image
              source={require('@/assets/images/sunan-notifier-mark.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.wordmarkRow}>
              <Text style={[styles.wordmarkPrimary, { color: colors.textPrimary }]}>SUNAN </Text>
              <Text style={[styles.wordmarkAccent, { color: isDark ? colors.accentBright : colors.accent }]}>
                Notifier
              </Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Login dengan akun portal UMK untuk aktifkan notifikasi tugas, deadline, dan absensi.
            </Text>
          </View>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor: isDark ? colors.bgCard : colors.bgSurface,
                borderColor: isDark ? colors.borderAccent : colors.borderSubtle,
                shadowColor: isDark ? '#000000' : '#14316D',
                shadowOpacity: isDark ? 0.22 : 0.08,
              },
            ]}
          >
            {shouldShowRememberPrompt && (
              <View
                style={[
                  styles.preferenceCard,
                  {
                    backgroundColor: isDark ? colors.bgCardHover : colors.bgCard,
                    borderColor: isDark ? colors.borderAccent : colors.borderSubtle,
                  },
                ]}
              >
                <View style={styles.preferenceHeader}>
                  <Text style={[styles.preferenceTitle, { color: colors.textPrimary }]}>
                    Simpan akun di perangkat ini?
                  </Text>
                  <Text style={[styles.preferenceHint, { color: colors.textSecondary }]}>
                    Jika dipilih, akun bisa muncul lagi sebagai sugest login di lain waktu.
                  </Text>
                </View>

                <View style={styles.preferenceChoices}>
                  <Pressable
                    style={[
                      styles.preferenceChoice,
                      {
                        backgroundColor: isDark ? colors.bgBase : colors.bgCardHover,
                        borderColor: colors.borderMuted,
                      },
                    ]}
                    onPress={() => {
                      void handleRememberCredentialsChange(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.preferenceChoiceText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Tidak
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.preferenceChoice,
                      {
                        backgroundColor: isDark ? colors.bgBase : colors.bgCardHover,
                        borderColor: colors.borderMuted,
                      },
                    ]}
                    onPress={() => {
                      void handleRememberCredentialsChange(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.preferenceChoiceText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Ya
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {canShowSavedSuggestion && (
              <Pressable
                style={[
                  styles.suggestionBanner,
                  {
                    backgroundColor: isDark ? colors.bgCardHover : colors.accentDim,
                    borderColor: colors.borderAccent,
                  },
                ]}
                onPress={handleFillSaved}
              >
                <FontAwesome
                  name="user-circle-o"
                  size={16}
                  color={colors.accent}
                  style={styles.suggestionIcon}
                />
                <View style={styles.suggestionBody}>
                  <Text style={[styles.suggestionTitle, { color: colors.textPrimary }]}>
                    Gunakan akun tersimpan
                  </Text>
                  <Text style={[styles.suggestionNim, { color: colors.accent }]}>
                    {savedCredentials.nim}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={11} color={colors.textSecondary} />
              </Pressable>
            )}

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>NIM</Text>
              <View
                style={[
                  styles.inputShell,
                  {
                    borderColor: isDark ? colors.borderAccent : colors.borderMuted,
                    backgroundColor: isDark ? colors.bgBase : colors.bgCardHover,
                  },
                ]}
              >
                <FontAwesome
                  name="user-o"
                  size={14}
                  color={colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={nim}
                  onChangeText={(v) => handleChange(setNim, v)}
                  onFocus={handleCredentialsFieldFocus}
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Masukkan NIM SUNAN"
                  placeholderTextColor={isDark ? colors.textSecondary : colors.textMuted}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  textContentType="username"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Password Portal</Text>
              <View
                style={[
                  styles.inputShell,
                  {
                    borderColor: isDark ? colors.borderAccent : colors.borderMuted,
                    backgroundColor: isDark ? colors.bgBase : colors.bgCardHover,
                  },
                ]}
              >
                <FontAwesome
                  name="lock"
                  size={14}
                  color={colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={password}
                  onChangeText={(v) => handleChange(setPassword, v)}
                  onFocus={handleCredentialsFieldFocus}
                  style={[styles.input, styles.passwordInput, { color: colors.textPrimary }]}
                  secureTextEntry={!showPassword}
                  placeholder="Masukkan password SUNAN"
                  placeholderTextColor={isDark ? colors.textSecondary : colors.textMuted}
                  textContentType="password"
                  autoCapitalize="none"
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={8}
                >
                  <FontAwesome
                    name={showPassword ? 'eye-slash' : 'eye'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {!!error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

            <Pressable
              style={[
                styles.button,
                { backgroundColor: isDark ? colors.accentBright : colors.accent },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={() => login(nim, password, { rememberCredentials: rememberCredentials === true })}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Masuk ke SUNAN</Text>
              )}
            </Pressable>

            {CONFIG.useMockData && !error && (
              <Text style={[styles.mockHint, { color: colors.textSecondary }]}>
                Mode demo aktif. Aplikasi memakai data contoh agar bisa dicoba tanpa login akun asli.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppAlertDialog
        visible={maintenanceAlertVisible}
        tone="warning"
        title="SUNAN sedang diperbarui"
        message="SUNAN belum bisa dipakai sementara waktu. Coba login lagi beberapa menit lagi."
        confirmLabel="Mengerti"
        onClose={() => setMaintenanceAlertVisible(false)}
      />

      <AppAlertDialog
        visible={!!logoutNotice}
        tone="success"
        title="Berhasil logout"
        message={logoutNotice ?? ''}
        onClose={clearLogoutNotice}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EEF3FF',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
    gap: 22,
  },
  hero: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  logo: {
    width: 126,
    height: 126,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmarkPrimary: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  wordmarkAccent: {
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  subtitle: {
    maxWidth: 290,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 4,
  },
  preferenceCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  preferenceHeader: {
    gap: 4,
  },
  preferenceTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  preferenceHint: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  preferenceChoices: {
    flexDirection: 'row',
    gap: 10,
  },
  preferenceChoice: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceChoiceText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  suggestionIcon: {
    marginRight: 9,
  },
  suggestionBody: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  suggestionNim: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '500',
  },
  passwordInput: {
    paddingRight: 8,
  },
  eyeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
  },
  button: {
    marginTop: 2,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  mockHint: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
});
