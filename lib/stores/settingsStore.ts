import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PollingInterval } from '@/lib/config';
import { ThemeMode } from '@/components/Redesign/theme';
import type { RemoteUserSettings } from '@/lib/supabase/repositories';

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
  dndStart: string;
  dndEnd: string;
  monitoredCourseIds: number[];
  themeMode: ThemeMode;
  setHydrated: (value: boolean) => void;
  setNotification: (key: keyof NotificationSettings, value: boolean) => void;
  setPollingInterval: (value: PollingInterval) => void;
  setDndWindow: (start: string, end: string) => void;
  toggleCourse: (courseId: number) => void;
  setMonitoredCourseIds: (courseIds: number[]) => void;
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
      dndStart: '22:00',
      dndEnd: '07:00',
      monitoredCourseIds: [],
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
      setDndWindow: (start, end) =>
        set({
          dndStart: start,
          dndEnd: end,
        }),
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
      setThemeMode: (mode) => set({ themeMode: mode }),
      applyRemoteSettings: (settings) =>
        set({
          notifications: {
            notifyNewTask: settings.notifyNewTask,
            notifyDeadlineH1: settings.notifyDeadlineH1,
            notifyDeadlineToday: settings.notifyDeadlineToday,
            notifyTaskOpen: settings.notifyTaskOpen,
            notifyAttendance: settings.notifyAttendance,
          },
          pollingInterval: settings.pollIntervalMinutes,
          dndStart: settings.dndStart,
          dndEnd: settings.dndEnd,
          monitoredCourseIds: settings.monitoredCourseIds,
        }),
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
        dndStart: state.dndStart,
        dndEnd: state.dndEnd,
        monitoredCourseIds: state.monitoredCourseIds,
        themeMode: state.themeMode,
      }),
    }
  )
);
