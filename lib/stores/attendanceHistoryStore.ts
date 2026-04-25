import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { AttendanceItem } from '@/types/moodle';
import { resolveAttendanceItemStatus, sortAttendanceSessions } from '@/lib/utils/attendance';

type AttendanceHistoryState = {
  historyByUser: Record<string, AttendanceItem[]>;
  mergeSessionsForUser: (userId: number, sessions: AttendanceItem[]) => AttendanceItem[];
  clearHistoryForUser: (userId: number) => void;
};

const HISTORY_RETENTION_SECONDS = 45 * 24 * 60 * 60;

function buildHistoryKey(item: AttendanceItem): string {
  if (item.eventId) {
    return `event:${item.eventId}`;
  }

  if (item.quickLink) {
    return `url:${item.quickLink}`;
  }

  return `course:${item.courseId ?? 0}:${item.title}`;
}

function normalizeHistoryItem(item: AttendanceItem, nowUnixSeconds = Math.floor(Date.now() / 1000)): AttendanceItem {
  const normalizedStatus = resolveAttendanceItemStatus(item, nowUnixSeconds);

  return {
    ...item,
    status: normalizedStatus,
  };
}

function isRecentEnough(item: AttendanceItem, nowUnixSeconds = Math.floor(Date.now() / 1000)): boolean {
  const referenceTime = item.closesAt ?? item.startsAt;

  if (!referenceTime) {
    return item.status !== 'closed';
  }

  return referenceTime >= nowUnixSeconds - HISTORY_RETENTION_SECONDS;
}

export const useAttendanceHistoryStore = create<AttendanceHistoryState>()(
  persist(
    (set, get) => ({
      historyByUser: {},
      mergeSessionsForUser: (userId, sessions) => {
        const historyKey = String(userId);
        const nowUnixSeconds = Math.floor(Date.now() / 1000);
        const existingSessions = get().historyByUser[historyKey] ?? [];
        const merged = new Map<string, AttendanceItem>();

        [...existingSessions, ...sessions].forEach((item) => {
          const normalizedItem = normalizeHistoryItem(item, nowUnixSeconds);
          if (!isRecentEnough(normalizedItem, nowUnixSeconds)) {
            return;
          }

          merged.set(buildHistoryKey(normalizedItem), normalizedItem);
        });

        const nextSessions = sortAttendanceSessions([...merged.values()]);

        set((state) => ({
          historyByUser: {
            ...state.historyByUser,
            [historyKey]: nextSessions,
          },
        }));

        return nextSessions;
      },
      clearHistoryForUser: (userId) => {
        const historyKey = String(userId);
        set((state) => {
          const nextHistory = { ...state.historyByUser };
          delete nextHistory[historyKey];
          return { historyByUser: nextHistory };
        });
      },
    }),
    {
      name: 'sunan.attendance-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        historyByUser: state.historyByUser,
      }),
    }
  )
);
