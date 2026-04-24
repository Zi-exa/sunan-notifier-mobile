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

type TaskNotificationData = {
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

function parseNotificationData(data: unknown): TaskNotificationData {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const payload = data as Record<string, unknown>;
  const kind = typeof payload.kind === 'string' ? (payload.kind as NotificationKind) : undefined;

  return {
    taskId: parseNumericField(payload.taskId),
    attendanceEventId: parseNumericField(payload.attendanceEventId),
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

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Expo Go no longer supports remote push registration for expo-notifications on SDK 53+.
  if (isExpoGoRuntime()) {
    return null;
  }

  const Notifications = ensureNotificationHandlerConfigured();

  if (!Device.isDevice) {
    return null;
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermission.status;

  if (currentPermission.status !== 'granted') {
    const requestResult = await Notifications.requestPermissionsAsync();
    finalStatus = requestResult.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2B7FFF',
    });
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      message.includes('expo go') ||
      message.includes('development build') ||
      message.includes('storeclient')
    ) {
      return null;
    }

    throw error;
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

  return new Date(Date.now() + 3 * 1000);
}

function buildNotificationContent(kind: NotificationKind, taskName: string) {
  if (kind === 'deadline_h1') {
    return {
      title: 'Pengingat Deadline H-1',
      body: `${taskName} akan deadline besok.`,
    };
  }

  if (kind === 'deadline_today') {
    return {
      title: 'Pengingat Deadline Hari Ini',
      body: `${taskName} deadline hari ini jam 07.00.`,
    };
  }

  if (kind === 'attendance_open') {
    return {
      title: 'Absensi Dibuka',
      body: 'Absensi perkuliahan sudah dibuka. Jangan lupa isi sekarang.',
    };
  }

  if (kind === 'attendance_closing') {
    return {
      title: 'Absensi Akan Ditutup',
      body: 'Absensi segera ditutup. Segera isi sebelum terlambat.',
    };
  }

  if (kind === 'task_open') {
    return {
      title: 'Tugas/Quiz Sudah Dibuka',
      body: `${taskName} sudah bisa dikerjakan. Segera kerjakan!`,
    };
  }

  if (kind === 'task_closing') {
    return {
      title: 'Tugas/Quiz Segera Ditutup',
      body: `${taskName} akan segera ditutup. Segera submit sebelum terlambat!`,
    };
  }

  return {
    title: 'Tugas Baru SUNAN',
    body: `${taskName} baru dipost dosen.`,
  };
}

export async function scheduleTaskLocalNotification(
  task: AssignmentItem,
  kind: NotificationKind
): Promise<string | null> {
  const Notifications = ensureNotificationHandlerConfigured();
  const triggerDate = buildScheduleDate(kind, task.dueDate);

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
      } satisfies TaskNotificationData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export function attachNotificationNavigationListener(
  onNotificationOpen: (payload: TaskNotificationData) => void
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
  kind: Extract<NotificationKind, 'attendance_open' | 'attendance_closing'>;
  eventId: number;
}): Promise<void> {
  const Notifications = ensureNotificationHandlerConfigured();

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: {
          kind: params.kind,
          attendanceEventId: params.eventId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
  } catch {
    // Local notification failure should never block app behavior.
  }
}

export async function sendImmediateTaskNotification(params: {
  title: string;
  body: string;
  kind: Extract<NotificationKind, 'task_open' | 'task_closing'>;
  taskId: number;
}): Promise<void> {
  const Notifications = ensureNotificationHandlerConfigured();

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: {
          taskId: params.taskId,
          kind: params.kind,
        } satisfies TaskNotificationData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
  } catch {
    // Local notification failure should never block app behavior.
  }
}
