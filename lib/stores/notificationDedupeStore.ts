import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type NotificationDedupeState = {
  hydrated: boolean;
  sentKeys: Record<string, number>;
  taskDiscoveryBaselineSeeded: boolean;
  setHydrated: (value: boolean) => void;
  hasKey: (key: string) => boolean;
  markKey: (key: string, timestamp?: number) => void;
  seedTaskDiscoveryBaseline: (keys: string[]) => void;
  pruneOlderThan: (cutoffTimestamp: number) => void;
};

export const useNotificationDedupeStore = create<NotificationDedupeState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      sentKeys: {},
      taskDiscoveryBaselineSeeded: false,
      setHydrated: (value) => set({ hydrated: value }),
      hasKey: (key) => Boolean(get().sentKeys[key]),
      markKey: (key, timestamp = Date.now()) =>
        set((state) => ({
          sentKeys: {
            ...state.sentKeys,
            [key]: timestamp,
          },
        })),
      seedTaskDiscoveryBaseline: (keys) =>
        set((state) => {
          if (state.taskDiscoveryBaselineSeeded || keys.length === 0) {
            return state;
          }

          const timestamp = Date.now();
          const seededKeys = { ...state.sentKeys };

          for (const key of keys) {
            if (!seededKeys[key]) {
              seededKeys[key] = timestamp;
            }
          }

          return {
            sentKeys: seededKeys,
            taskDiscoveryBaselineSeeded: true,
          };
        }),
      pruneOlderThan: (cutoffTimestamp) =>
        set((state) => ({
          sentKeys: Object.fromEntries(
            Object.entries(state.sentKeys).filter(([, timestamp]) => timestamp >= cutoffTimestamp)
          ),
        })),
    }),
    {
      name: 'sunan.notification.dedupe',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      partialize: (state) => ({
        sentKeys: state.sentKeys,
        taskDiscoveryBaselineSeeded: state.taskDiscoveryBaselineSeeded,
      }),
    }
  )
);
