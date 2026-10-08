import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PollingInterval } from '@/lib/config';
import { ThemeMode } from '@/components/Redesign/theme';
import type { RemoteUserSettings } from '@/lib/supabase/repositories';
import { DEFAULT_QUIET_HOURS, normalizeQuietHours, type QuietHours } from '@/lib/utils/quietHours';

export type NotificationSettings = {
  notifyNewTask: boolean;
  notifyDeadlineH1: boolean;
  notifyDeadlineToday: boolean;
  notifyTaskOpen: boolean;
  notifyAttendance: boolean;
};

type SettingsState = {
  hydrated: boolean;
  notifications: NotificationSettings;
  pollingInterval: PollingInterval;
  monitoredCourseIds: number[];
  quietHours: QuietHours;
  themeMode: ThemeMode;
  setHydrated: (value: boolean) => void;
  setNotification: (key: keyof NotificationSettings, value: boolean) => void;
  setPollingInterval: (value: PollingInterval) => void;
  toggleCourse: (courseId: number) => void;
  setMonitoredCourseIds: (courseIds: number[]) => void;
  setQuietHours: (quietHours: QuietHours) => void;
  setThemeMode: (mode: ThemeMode) => void;
  applyRemoteSettings: (settings: RemoteUserSettings) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hydrated: false,
      notifications: {
        notifyNewTask: true,
        notifyDeadlineH1: true,
        notifyDeadlineToday: true,
        notifyTaskOpen: true,
        notifyAttendance: true,
      },
      pollingInterval: 15,
      monitoredCourseIds: [],
      quietHours: DEFAULT_QUIET_HOURS,
      themeMode: 'system' as ThemeMode,
      setHydrated: (value) => set({ hydrated: value }),
      setNotification: (key, value) =>
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: value,
          },
        })),
      setPollingInterval: (value) => set({ pollingInterval: value }),
      toggleCourse: (courseId) =>
        set((state) => {
          const exists = state.monitoredCourseIds.includes(courseId);

          if (exists) {
            return {
              monitoredCourseIds: state.monitoredCourseIds.filter((item) => item !== courseId),
            };
          }

          return {
            monitoredCourseIds: [...state.monitoredCourseIds, courseId],
          };
        }),
      setMonitoredCourseIds: (courseIds) => set({ monitoredCourseIds: courseIds }),
      setQuietHours: (quietHours) => set({ quietHours }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      applyRemoteSettings: (settings) =>
        set((state) => ({
          notifications: {
            notifyNewTask: settings.notifyNewTask,
            notifyDeadlineH1: settings.notifyDeadlineH1,
            notifyDeadlineToday: settings.notifyDeadlineToday,
            notifyTaskOpen:
              typeof settings.notifyTaskOpen === 'boolean'
                ? settings.notifyTaskOpen
                : state.notifications.notifyTaskOpen,
            notifyAttendance: settings.notifyAttendance,
          },
          pollingInterval: settings.pollIntervalMinutes,
          monitoredCourseIds: settings.monitoredCourseIds,
          quietHours: normalizeQuietHours(settings.quietHours),
        })),
    }),
    {
      name: 'sunan.settings',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      partialize: (state) => ({
        notifications: state.notifications,
        pollingInterval: state.pollingInterval,
        monitoredCourseIds: state.monitoredCourseIds,
        quietHours: state.quietHours,
        themeMode: state.themeMode,
      }),
    }
  )
);
