function parseBooleanEnv(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().replace(/^['\"]|['\"]$/g, '').toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return fallback;
}

const rawUseMockData = process.env.EXPO_PUBLIC_USE_MOCK_DATA;

export const CONFIG = {
  appName: 'SUNAN Notifier',
  moodleBaseUrl: (process.env.EXPO_PUBLIC_MOODLE_BASE_URL ?? 'https://sunan.umk.ac.id').replace(/\/$/, ''),
  moodleService: process.env.EXPO_PUBLIC_MOODLE_SERVICE ?? 'moodle_mobile_app',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  updateManifestUrl: process.env.EXPO_PUBLIC_UPDATE_MANIFEST_URL ?? '',
  useMockData: parseBooleanEnv(rawUseMockData, false),
  useMockDataRaw: rawUseMockData ?? '',
  expoProjectId: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ?? '',
};

export const POLLING_INTERVAL_OPTIONS = [15, 30, 60] as const;

export type PollingInterval = (typeof POLLING_INTERVAL_OPTIONS)[number];

export const SECURE_KEYS = {
  authSession: 'sunan.auth.session',
  savedCredentials: 'sunan.saved.credentials',
  savedCredentialsPreference: 'sunan.saved.credentials.preference',
} as const;
