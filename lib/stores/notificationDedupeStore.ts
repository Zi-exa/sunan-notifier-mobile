import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type NotificationDedupeState = {
  hydrated: boolean;
  sentKeys: Record<string, number>;
  setHydrated: (value: boolean) => void;
  hasKey: (key: string) => boolean;
  markKey: (key: string, timestamp?: number) => void;
  pruneOlderThan: (cutoffTimestamp: number) => void;
};

export const useNotificationDedupeStore = create<NotificationDedupeState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      sentKeys: {},
      setHydrated: (value) => set({ hydrated: value }),
      hasKey: (key) => Boolean(get().sentKeys[key]),
      markKey: (key, timestamp = Date.now()) =>
        set((state) => ({
          sentKeys: {
            ...state.sentKeys,
            [key]: timestamp,
          },
        })),
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
      }),
    }
  )
);
