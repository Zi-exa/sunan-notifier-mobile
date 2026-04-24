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
import { getSecureItem } from '@/lib/storage/secureStore';
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
  const [savedCredentials, setSavedCredentials] = useState<SavedCredentials | null>(null);

  // Load saved credentials on mount
  useEffect(() => {
    getSecureItem(SECURE_KEYS.savedCredentials).then((raw) => {
      const creds = parseSavedCredentials(raw);
      if (creds) {
        setSavedCredentials(creds);
        setNim(creds.nim);
        setPassword(creds.password);
      }
    });
  }, []);

  if (!hydrated) {
    return null;
  }

  if (status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  const isLoading = status === 'loading';
  const hasSavedCredentials = savedCredentials !== null;
  const isDark = mode === 'dark';

  const handleChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    if (error) clearError();
  };

  const handleFillSaved = () => {
    if (savedCredentials) {
      setNim(savedCredentials.nim);
      setPassword(savedCredentials.password);
      if (error) clearError();
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
            {hasSavedCredentials && (
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
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Contoh: 202351207"
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
              onPress={() => login(nim, password)}
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
                Mode demo aktif. Data tugas menggunakan mock agar bisa diuji tanpa kredensial production.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
