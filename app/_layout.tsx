import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/components/Redesign';
import { TabsHeaderTitle } from '@/components/app/TabsHeaderTitle';


import {
  attachNotificationNavigationListener,
  registerForPushNotificationsAsync,
} from '@/lib/notifications';
import { useAuthStore } from '@/lib/stores/authStore';
import { upsertDevicePushToken } from '@/lib/supabase/repositories';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppBootstrap() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);
  const unauthClearedRef = useRef(false);
  const previousUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (hydrated && status !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [hydrated, status]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      if (!unauthClearedRef.current) {
        queryClient.clear();
        unauthClearedRef.current = true;
      }

      previousUserIdRef.current = null;
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
    const unsubscribe = attachNotificationNavigationListener((payload) => {
      if (
        payload.kind === 'attendance_open' ||
        payload.kind === 'attendance_closing' ||
        typeof payload.attendanceEventId === 'number'
      ) {
        const filter = payload.kind === 'attendance_closing' ? 'closing_soon' : 'open';

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
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    async function syncPushToken() {
      if (status !== 'authenticated' || !user?.appUserId) {
        return;
      }

      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (!isMounted || !pushToken) {
          return;
        }
        await upsertDevicePushToken(user.appUserId, pushToken);
      } catch {
        // Push token sync should not block app boot.
      }
    }

    syncPushToken();

    return () => {
      isMounted = false;
    };
  }, [status, user?.appUserId]);

  return null;
}

export default function RootLayout() {
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

  if (!loaded) {
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

  return (
    <NavThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <AppBootstrap />
      <Stack
        screenOptions={{
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
            headerShown: true,
            headerStyle: { backgroundColor: colors.bgSurface },
            headerShadowVisible: false,
            headerTitle: () => <TabsHeaderTitle />,
          }}
        />
        <Stack.Screen name="task/[id]" options={{ title: 'Detail Tugas' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </NavThemeProvider>
  );
}
