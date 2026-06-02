import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { LogBox, Platform } from 'react-native';
import { AssignmentItem, NotificationKind } from '@/types/moodle';

const EXPO_GO_PUSH_ANDROID_WARNING =
  'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go with the release of SDK 53. Use a development build instead of Expo Go. Read more at https://docs.expo.dev/develop/development-builds/introduction/.';
const EXPO_GO_LIMITED_SUPPORT_WARNING =
  '`expo-notifications` functionality is not fully supported in Expo Go:';

if (__DEV__) {
  LogBox.ignoreLogs([EXPO_GO_PUSH_ANDROID_WARNING, EXPO_GO_LIMITED_SUPPORT_WARNING]);
}

type NotificationsModule = typeof import('expo-notifications');

let cachedNotificationsModule: NotificationsModule | null = null;
let notificationHandlerConfigured = false;
let localNotificationsReadyPromise: Promise<boolean> | null = null;

export type PushRegistrationResult =
  | {
      status: 'registered';
      token: string;
      tokenKind: 'expo' | 'native';
    }
  | {
      status: 'unavailable' | 'denied' | 'error';
      reason: string;
    };

function getNotificationsModule(): NotificationsModule {
  if (cachedNotificationsModule) {
    return cachedNotificationsModule;
  }

  cachedNotificationsModule = require('expo-notifications') as NotificationsModule;
  return cachedNotificationsModule;
}

function ensureNotificationHandlerConfigured(): NotificationsModule {
  const Notifications = getNotificationsModule();

  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    notificationHandlerConfigured = true;
  }

  return Notifications;
}

export type NotificationNavigationPayload = {
  taskId?: number;
  attendanceEventId?: number;
  kind?: NotificationKind;
};

function parseNumericField(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function parseNotificationData(data: unknown): NotificationNavigationPayload {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const payload = data as Record<string, unknown>;
  const kind = typeof payload.kind === 'string' ? (payload.kind as NotificationKind) : undefined;

  return {
    taskId: parseNumericField(payload.taskId),
    attendanceEventId: parseNumericField(payload.attendanceEventId ?? payload.eventId),
    kind,
  };
}

function getExpoProjectId(): string | undefined {
  const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof easProjectId === 'string' && easProjectId.length > 0) {
    return easProjectId;
  }

  const legacyProjectId = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId;

  if (typeof legacyProjectId === 'string' && legacyProjectId.length > 0) {
    return legacyProjectId;
  }

  return process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;
}

function isExpoGoRuntime(): boolean {
  const executionEnvironment = (Constants as unknown as { executionEnvironment?: string })
    .executionEnvironment;

  return Constants.appOwnership === 'expo' || executionEnvironment === 'storeClient';
}

function normalizePushTokenData(data: unknown): string | null {
  if (typeof data !== 'string') {
    return null;
  }

  const token = data.trim();
  return token.length > 0 ? token : null;
}

async function getNativeDevicePushTokenAsync(
  Notifications: NotificationsModule
): Promise<PushRegistrationResult> {
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    const normalizedToken = normalizePushTokenData(token.data);

    if (!normalizedToken) {
      return {
        status: 'unavailable',
        reason: 'Token native perangkat belum tersedia.',
      };
    }

    return {
      status: 'registered',
      token: normalizedToken,
      tokenKind: 'native',
    };
  } catch (error) {
    return {
      status: 'error',
      reason: error instanceof Error ? error.message : 'Gagal mengambil token native perangkat.',
    };
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const result = await registerForPushNotificationsDetailedAsync();
  return result.status === 'registered' ? result.token : null;
}

export async function registerForPushNotificationsDetailedAsync(): Promise<PushRegistrationResult> {
  const ready = await ensureLocalNotificationsReadyAsync();
  if (!ready) {
    return {
      status: 'denied',
      reason: 'Izin notifikasi belum aktif.',
    };
  }

  // Expo Go no longer supports remote push registration for expo-notifications on SDK 53+.
  if (isExpoGoRuntime() || !Device.isDevice) {
    return {
      status: 'unavailable',
      reason: 'Token push hanya tersedia di APK yang terpasang pada perangkat fisik.',
    };
  }

  const Notifications = ensureNotificationHandlerConfigured();

  const projectId = getExpoProjectId();
  if (!projectId) {
    return getNativeDevicePushTokenAsync(Notifications);
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const normalizedToken = normalizePushTokenData(token.data);

    if (!normalizedToken) {
      return {
        status: 'unavailable',
        reason: 'Expo push token belum tersedia.',
      };
    }

    return {
      status: 'registered',
      token: normalizedToken,
      tokenKind: 'expo',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      message.includes('expo go') ||
      message.includes('development build') ||
      message.includes('storeclient')
    ) {
      return {
        status: 'unavailable',
        reason: 'Remote push tidak tersedia di runtime ini.',
      };
    }

    const nativeResult = await getNativeDevicePushTokenAsync(Notifications);
    if (nativeResult.status === 'registered') {
      return nativeResult;
    }

    return {
      status: 'error',
      reason:
        error instanceof Error
          ? `${error.message}; fallback native: ${nativeResult.reason}`
          : nativeResult.reason,
    };
  }
}

export async function ensureLocalNotificationsReadyAsync(): Promise<boolean> {
  if (localNotificationsReadyPromise) {
    return localNotificationsReadyPromise;
  }

  localNotificationsReadyPromise = (async () => {
    const Notifications = ensureNotificationHandlerConfigured();

    const currentPermission = await Notifications.getPermissionsAsync();
    let finalStatus = currentPermission.status;

    if (currentPermission.status !== 'granted') {
      const requestResult = await Notifications.requestPermissionsAsync();
      finalStatus = requestResult.status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2B7FFF',
      });
    }

    return true;
  })();

  try {
    return await localNotificationsReadyPromise;
  } finally {
    localNotificationsReadyPromise = null;
  }
}

function buildScheduleDate(kind: NotificationKind, dueDateUnixSeconds: number): Date {
  const dueDate = new Date(dueDateUnixSeconds * 1000);

  if (kind === 'deadline_h1') {
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 1);
    reminderDate.setHours(7, 0, 0, 0);
    return reminderDate;
  }

  if (kind === 'deadline_today') {
    const reminderDate = new Date(dueDate);
    reminderDate.setHours(7, 0, 0, 0);
    return reminderDate;
  }

  if (kind === 'task_closing') {
    return new Date(dueDate.getTime() - 30 * 60 * 1000);
  }

  return new Date(Date.now() + 3 * 1000);
}

function buildNotificationContent(kind: NotificationKind, taskName: string) {
  if (kind === 'deadline_h1') {
    return {
      title: 'Pengingat Deadline H-1',
      body: `${taskName} berakhir besok.`,
    };
  }

  if (kind === 'deadline_today') {
    return {
      title: 'Pengingat Deadline Hari Ini',
      body: `${taskName} berakhir hari ini.`,
    };
  }

  if (kind === 'attendance_open') {
    return {
      title: 'Absensi Dibuka',
      body: 'Absensi sudah dibuka. Segera isi sekarang.',
    };
  }

  if (kind === 'attendance_h1') {
    return {
      title: 'Absensi Besok',
      body: 'Besok ada absensi. Siapkan diri Anda.',
    };
  }

  if (kind === 'attendance_preopen') {
    return {
      title: 'Absensi 1 Jam Lagi',
      body: 'Absensi akan segera dibuka.',
    };
  }

  if (kind === 'attendance_closing') {
    return {
      title: 'Absensi Segera Ditutup',
      body: 'Absensi akan segera ditutup. Segera isi sekarang.',
    };
  }

  if (kind === 'task_open') {
    return {
      title: 'Tugas Sudah Dibuka',
      body: `${taskName} sudah bisa dikerjakan.`,
    };
  }

  if (kind === 'task_closing') {
    return {
      title: 'Tugas Segera Ditutup',
      body: `${taskName} akan segera ditutup. Segera kirim tugas Anda.`,
    };
  }

  return {
    title: 'Tugas Baru',
    body: `${taskName} baru ditambahkan.`,
  };
}

export async function scheduleTaskLocalNotification(
  task: AssignmentItem,
  kind: NotificationKind,
  options?: {
    triggerDate?: Date;
  }
): Promise<string | null> {
  const ready = await ensureLocalNotificationsReadyAsync();
  if (!ready) {
    return null;
  }

  const Notifications = ensureNotificationHandlerConfigured();
  const triggerDate = options?.triggerDate ?? buildScheduleDate(kind, task.dueDate);

  if (triggerDate.getTime() <= Date.now()) {
    return null;
  }

  const content = buildNotificationContent(kind, task.name);
  return Notifications.scheduleNotificationAsync({
    content: {
      ...content,
      data: {
        taskId: task.id,
        kind,
      } satisfies NotificationNavigationPayload,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export function attachNotificationNavigationListener(
  onNotificationOpen: (payload: NotificationNavigationPayload) => void
): () => void {
  const Notifications = ensureNotificationHandlerConfigured();
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const payload = parseNotificationData(response.notification.request.content.data);

    if (
      payload.taskId === undefined &&
      payload.attendanceEventId === undefined &&
      payload.kind === undefined
    ) {
      return;
    }

    onNotificationOpen(payload);
  });

  return () => {
    responseSubscription.remove();
  };
}

export async function getLastNotificationNavigationPayloadAsync(): Promise<NotificationNavigationPayload | null> {
  const Notifications = ensureNotificationHandlerConfigured();
  const response = await Notifications.getLastNotificationResponseAsync();

  if (!response) {
    return null;
  }

  const payload = parseNotificationData(response.notification.request.content.data);

  if (
    payload.taskId === undefined &&
    payload.attendanceEventId === undefined &&
    payload.kind === undefined
  ) {
    return null;
  }

  if (typeof Notifications.clearLastNotificationResponseAsync === 'function') {
    await Notifications.clearLastNotificationResponseAsync();
  }

  return payload;
}

export async function setAppBadgeCount(count: number): Promise<void> {
  if (count < 0) {
    return;
  }

  const Notifications = ensureNotificationHandlerConfigured();

  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Not all devices or permissions support badge updates.
  }
}

export async function sendImmediateAttendanceNotification(params: {
  title: string;
  body: string;
  kind: Extract<
    NotificationKind,
    'attendance_h1' | 'attendance_preopen' | 'attendance_open' | 'attendance_closing'
  >;
  eventId: number;
}): Promise<boolean> {
  try {
    const ready = await ensureLocalNotificationsReadyAsync();
    if (!ready) {
      return false;
    }

    const Notifications = ensureNotificationHandlerConfigured();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: {
          kind: params.kind,
          attendanceEventId: params.eventId,
        } satisfies NotificationNavigationPayload,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
    return true;
  } catch {
    // Local notification failure should never block app behavior.
    return false;
  }
}

export async function scheduleAttendanceLocalNotification(params: {
  title: string;
  body: string;
  kind: Extract<
    NotificationKind,
    'attendance_h1' | 'attendance_preopen' | 'attendance_open' | 'attendance_closing'
  >;
  eventId: number;
  triggerDate: Date;
}): Promise<string | null> {
  try {
    const ready = await ensureLocalNotificationsReadyAsync();
    if (!ready || params.triggerDate.getTime() <= Date.now()) {
      return null;
    }

    const Notifications = ensureNotificationHandlerConfigured();
    return Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: {
          kind: params.kind,
          attendanceEventId: params.eventId,
        } satisfies NotificationNavigationPayload,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: params.triggerDate,
      },
    });
  } catch {
    // Local notification failure should never block app behavior.
    return null;
  }
}

export async function sendImmediateTaskNotification(params: {
  title: string;
  body: string;
  kind: Extract<NotificationKind, 'task_open' | 'task_closing'>;
  taskId: number;
}): Promise<boolean> {
  try {
    const ready = await ensureLocalNotificationsReadyAsync();
    if (!ready) {
      return false;
    }

    const Notifications = ensureNotificationHandlerConfigured();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: {
          taskId: params.taskId,
          kind: params.kind,
        } satisfies NotificationNavigationPayload,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
    return true;
  } catch {
    // Local notification failure should never block app behavior.
    return false;
  }
}
