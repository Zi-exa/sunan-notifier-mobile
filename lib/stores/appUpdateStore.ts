import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AvailableAppUpdate, PostUpdateNotice } from '@/lib/updates';

type AppUpdateStore = {
  availableUpdate: AvailableAppUpdate | null;
  dialogVisible: boolean;
  pendingPostUpdateNotice: PostUpdateNotice | null;
  activePostUpdateNotice: PostUpdateNotice | null;
  setAvailableUpdate: (update: AvailableAppUpdate | null) => void;
  showDialog: () => void;
  hideDialog: () => void;
  clearAvailableUpdate: () => void;
  queuePostUpdateNotice: (notice: PostUpdateNotice) => void;
  clearPendingPostUpdateNotice: () => void;
  activatePendingPostUpdateNotice: () => void;
  dismissPostUpdateNotice: () => void;
};

export const useAppUpdateStore = create<AppUpdateStore>()(
  persist(
    (set) => ({
      availableUpdate: null,
      dialogVisible: false,
      pendingPostUpdateNotice: null,
      activePostUpdateNotice: null,
      setAvailableUpdate: (update) =>
        set({
          availableUpdate: update,
          dialogVisible: Boolean(update),
        }),
      showDialog: () =>
        set((state) => ({
          dialogVisible: Boolean(state.availableUpdate),
        })),
      hideDialog: () => set({ dialogVisible: false }),
      clearAvailableUpdate: () => set({ availableUpdate: null, dialogVisible: false }),
      queuePostUpdateNotice: (notice) =>
        set({
          pendingPostUpdateNotice: notice,
          activePostUpdateNotice: null,
        }),
      clearPendingPostUpdateNotice: () => set({ pendingPostUpdateNotice: null }),
      activatePendingPostUpdateNotice: () =>
        set((state) => ({
          activePostUpdateNotice: state.pendingPostUpdateNotice,
          pendingPostUpdateNotice: null,
        })),
      dismissPostUpdateNotice: () => set({ activePostUpdateNotice: null }),
    }),
    {
      name: 'sunan.app-update',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pendingPostUpdateNotice: state.pendingPostUpdateNotice,
      }),
    }
  )
);
