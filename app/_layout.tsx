import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
  Theme as NavigationTheme,
} from '@react-navigation/native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import 'react-native-reanimated';
import { AppState, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/components/Redesign';
import { AppUpdateCoordinator } from '@/components/app/AppUpdateCoordinator';


import {
  attachNotificationNavigationListener,
  cancelAllScheduledSunanNotifications,
  ensureLocalNotificationsReadyAsync,
  getLastNotificationNavigationPayloadAsync,
  registerForPushNotificationsDetailedAsync,
} from '@/lib/notifications';
import { useAuthStore } from '@/lib/stores/authStore';
import { useNotificationDedupeStore } from '@/lib/stores/notificationDedupeStore';
import { usePushTokenSyncStore } from '@/lib/stores/pushTokenSyncStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useTabsBootStore } from '@/lib/stores/tabsBootStore';
import { loadUserSettings, upsertDevicePushToken } from '@/lib/supabase/repositories';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const LOCAL_NOTIFICATION_OWNER_KEY = 'sunan.notification.owner';

function AppBootstrap() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const status = useAuthStore((state) => state.status);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);
  const resetNotificationDedupe = useNotificationDedupeStore((state) => state.reset);
  const resetTabsBootStatus = useTabsBootStore((state) => state.reset);
  const applyRemoteSettings = useSettingsStore((state) => state.applyRemoteSettings);
  const unauthClearedRef = useRef(false);
  const previousUserIdRef = useRef<number | null>(null);
  const remoteSettingsUserIdRef = useRef<string | null>(null);
  const pendingNotificationPayloadRef = useRef<Awaited<
    ReturnType<typeof getLastNotificationNavigationPayloadAsync>
  > | null>(null);
  const handledNotificationKeysRef = useRef(new Set<string>());

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    resetTabsBootStatus();
  }, [resetTabsBootStatus, status, user?.id]);

  useEffect(() => {
    if (hydrated && status !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [hydrated, status]);

  useEffect(() => {
    let cancelled = false;

    async function reconcileLocalNotificationOwner() {
      if (!hydrated || status === 'loading') {
        return;
      }

      if (status !== 'authenticated' || !user?.id) {
        await AsyncStorage.removeItem(LOCAL_NOTIFICATION_OWNER_KEY);
        return;
      }

      const nextOwner = String(user.id);
      const previousOwner = await AsyncStorage.getItem(LOCAL_NOTIFICATION_OWNER_KEY);

      if (cancelled || previousOwner === nextOwner) {
        return;
      }

      await cancelAllScheduledSunanNotifications();
      resetNotificationDedupe();
      await AsyncStorage.setItem(LOCAL_NOTIFICATION_OWNER_KEY, nextOwner);
    }

    void reconcileLocalNotificationOwner();

    return () => {
      cancelled = true;
    };
  }, [hydrated, resetNotificationDedupe, status, user?.id]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      if (!unauthClearedRef.current) {
        queryClient.clear();
        unauthClearedRef.current = true;
      }

      previousUserIdRef.current = null;
      remoteSettingsUserIdRef.current = null;
      return;
    }

    unauthClearedRef.current = false;

    if (status !== 'authenticated' || !user?.id) {
      return;
    }

    if (previousUserIdRef.current !== null && previousUserIdRef.current !== user.id) {
      queryClient.clear();
    }

    previousUserIdRef.current = user.id;
  }, [queryClient, status, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function syncRemoteSettings() {
      if (status !== 'authenticated' || !token || !user?.id || !user.nim || !user.fullname) {
        remoteSettingsUserIdRef.current = null;
        return;
      }

      if (remoteSettingsUserIdRef.current === String(user.id)) {
        return;
      }

      try {
        const response = await loadUserSettings({
          moodleToken: token,
          moodleUserId: user.id,
          nim: user.nim,
          fullname: user.fullname,
        });

        if (!cancelled && response.settings) {
          applyRemoteSettings(response.settings);
        }

        if (!cancelled && response.appUserId && response.appUserId !== user.appUserId) {
          await useAuthStore.getState().setAppUserId(response.appUserId);
        }
      } catch {
        // Remote settings sync should not block app startup.
      } finally {
        if (!cancelled) {
          remoteSettingsUserIdRef.current = String(user.id);
        }
      }
    }

    void syncRemoteSettings();

    return () => {
      cancelled = true;
    };
  }, [applyRemoteSettings, status, token, user?.appUserId, user?.fullname, user?.id, user?.nim]);

  useEffect(() => {
    const buildPayloadKey = (
      payload: NonNullable<Awaited<ReturnType<typeof getLastNotificationNavigationPayloadAsync>>>
    ) =>
      `${payload.kind ?? 'unknown'}:${payload.taskId ?? 'na'}:${payload.attendanceEventId ?? 'na'}`;

    const routeFromNotification = (
      payload: NonNullable<Awaited<ReturnType<typeof getLastNotificationNavigationPayloadAsync>>>
    ) => {
      const key = buildPayloadKey(payload);
      if (handledNotificationKeysRef.current.has(key)) {
        return;
      }

      if (status !== 'authenticated') {
        pendingNotificationPayloadRef.current = payload;
        router.replace('/login');
        return;
      }

      handledNotificationKeysRef.current.add(key);

      if (
        payload.kind === 'attendance_h1' ||
        payload.kind === 'attendance_preopen' ||
        payload.kind === 'attendance_open' ||
        payload.kind === 'attendance_closing' ||
        typeof payload.attendanceEventId === 'number'
      ) {
        const filter =
          payload.kind === 'attendance_closing'
            ? 'closing_soon'
            : payload.kind === 'attendance_open'
              ? 'open'
              : 'upcoming';

        router.push({
          pathname: '/(tabs)/attendance',
          params: {
            filter,
            ...(typeof payload.attendanceEventId === 'number'
              ? { eventId: String(payload.attendanceEventId) }
              : {}),
          },
        });
        return;
      }

      if (typeof payload.taskId === 'number') {
        router.push(`/task/${payload.taskId}`);
      }
    };

    const unsubscribe = attachNotificationNavigationListener(routeFromNotification);

    let cancelled = false;

    if (hydrated && status !== 'loading') {
      void (async () => {
        const payload = await getLastNotificationNavigationPayloadAsync();
        if (!cancelled && payload) {
          routeFromNotification(payload);
        }
      })();
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hydrated, router, status]);

  useEffect(() => {
    if (status !== 'authenticated' || !pendingNotificationPayloadRef.current) {
      return;
    }

    const payload = pendingNotificationPayloadRef.current;
    pendingNotificationPayloadRef.current = null;

    if (
      payload.kind === 'attendance_h1' ||
      payload.kind === 'attendance_preopen' ||
      payload.kind === 'attendance_open' ||
      payload.kind === 'attendance_closing' ||
      typeof payload.attendanceEventId === 'number'
    ) {
      const filter =
        payload.kind === 'attendance_closing'
          ? 'closing_soon'
          : payload.kind === 'attendance_open'
            ? 'open'
            : 'upcoming';

      router.push({
        pathname: '/(tabs)/attendance',
        params: {
          filter,
          ...(typeof payload.attendanceEventId === 'number'
            ? { eventId: String(payload.attendanceEventId) }
            : {}),
        },
      });
      return;
    }

    if (typeof payload.taskId === 'number') {
      router.push(`/task/${payload.taskId}`);
    }
  }, [router, status]);

  useEffect(() => {
    void ensureLocalNotificationsReadyAsync();
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = previousState === 'background' || previousState === 'inactive';
      previousState = nextState;

      if (!wasBackgrounded || nextState !== 'active') {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient, status, user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function syncPushToken() {
      const pushSyncStore = usePushTokenSyncStore.getState();

      if (status !== 'authenticated' || !token || !user?.id || !user.nim || !user.fullname) {
        if (status === 'authenticated') {
          pushSyncStore.setUnavailable('Data login belum lengkap untuk mendaftarkan perangkat.');
        }
        return;
      }

      try {
        pushSyncStore.setSyncing();
        const registration = await registerForPushNotificationsDetailedAsync();
        if (!isMounted) {
          return;
        }

        if (registration.status !== 'registered') {
          if (registration.status === 'error') {
            pushSyncStore.setError(registration.reason);
          } else {
            pushSyncStore.setUnavailable(registration.reason);
          }
          return;
        }

        const appUserId = await upsertDevicePushToken({
          moodleToken: token,
          moodleUserId: user.id,
          nim: user.nim,
          fullname: user.fullname,
          pushToken: registration.token,
        });

        if (isMounted) {
          pushSyncStore.setReady(registration.tokenKind);
        }

        if (isMounted && appUserId && appUserId !== user.appUserId) {
          await useAuthStore.getState().setAppUserId(appUserId);
        }
      } catch (error) {
        if (isMounted) {
          pushSyncStore.setError(
            error instanceof Error ? error.message : 'Gagal mendaftarkan perangkat.'
          );
        }
        // Push token sync should not block app boot.
      }
    }

    syncPushToken();

    return () => {
      isMounted = false;
    };
  }, [status, token, user?.appUserId, user?.fullname, user?.id, user?.nim]);

  return null;
}

export default function RootLayout() {
  const settingsHydrated = useSettingsStore((state) => state.hydrated);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const [appearanceApplied, setAppearanceApplied] = useState(false);
  const queryClientRef = useRef(
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    })
  );

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useLayoutEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    Appearance.setColorScheme(themeMode === 'system' ? null : themeMode);
    setAppearanceApplied(true);
  }, [settingsHydrated, themeMode]);

  if (!loaded || !settingsHydrated || !appearanceApplied) {
    return null;
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClientRef.current}>
          <RootLayoutNav />
        </QueryClientProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function RootLayoutNav() {
  const { mode, colors } = useTheme();
  const navigationTheme = useMemo<NavigationTheme>(() => {
    const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.accent,
        background: colors.bgBase,
        card: colors.bgSurface,
        text: colors.textPrimary,
        border: colors.borderSubtle,
        notification: colors.accentBright,
      },
    };
  }, [colors, mode]);

  return (
    <NavThemeProvider value={navigationTheme}>
      <AppBootstrap />
      <AppUpdateCoordinator />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.bgBase },
          statusBarTranslucent: true,
          headerStyle: { backgroundColor: colors.bgCard },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bgBase },
            freezeOnBlur: false,
          }}
        />
        <Stack.Screen
          name="task/[id]"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            freezeOnBlur: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade',
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </NavThemeProvider>
  );
}
