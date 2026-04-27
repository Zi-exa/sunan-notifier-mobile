import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AvailableAppUpdate, PostUpdateNotice } from '@/lib/updates';

type AppUpdateStore = {
  availableUpdate: AvailableAppUpdate | null;
  deferredAvailableUpdate: AvailableAppUpdate | null;
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

function areAvailableUpdatesEqual(
  left: AvailableAppUpdate | null,
  right: AvailableAppUpdate | null
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right || left.kind !== right.kind) {
    return false;
  }

  if (left.kind === 'apk' && right.kind === 'apk') {
    return (
      left.manifest.version === right.manifest.version &&
      left.manifest.apkUrl === right.manifest.apkUrl &&
      (left.manifest.title ?? null) === (right.manifest.title ?? null) &&
      (left.manifest.notes ?? null) === (right.manifest.notes ?? null) &&
      Boolean(left.manifest.mandatory) === Boolean(right.manifest.mandatory)
    );
  }

  if (left.kind === 'eas' && right.kind === 'eas') {
    return (left.notes ?? null) === (right.notes ?? null);
  }

  return false;
}

export const useAppUpdateStore = create<AppUpdateStore>()(
  persist(
    (set) => ({
      availableUpdate: null,
      deferredAvailableUpdate: null,
      dialogVisible: false,
      pendingPostUpdateNotice: null,
      activePostUpdateNotice: null,
      setAvailableUpdate: (update) =>
        set((state) => {
          const nextDialogVisible = Boolean(update);
          if (
            areAvailableUpdatesEqual(state.availableUpdate, update) &&
            state.dialogVisible === nextDialogVisible
          ) {
            return state;
          }

          return {
            availableUpdate: update,
            deferredAvailableUpdate: update,
            dialogVisible: nextDialogVisible,
          };
        }),
      showDialog: () =>
        set((state) => {
          const restoredUpdate = state.availableUpdate ?? state.deferredAvailableUpdate;
          const nextDialogVisible = Boolean(restoredUpdate);
          if (
            state.dialogVisible === nextDialogVisible &&
            areAvailableUpdatesEqual(state.availableUpdate, restoredUpdate)
          ) {
            return state;
          }

          return {
            availableUpdate: restoredUpdate,
            dialogVisible: nextDialogVisible,
          };
        }),
      hideDialog: () =>
        set((state) => {
          if (!state.dialogVisible) {
            return state;
          }

          return { dialogVisible: false };
        }),
      clearAvailableUpdate: () =>
        set((state) => {
          if (!state.availableUpdate && !state.dialogVisible) {
            if (!state.deferredAvailableUpdate) {
              return state;
            }
          }

          return {
            availableUpdate: null,
            deferredAvailableUpdate: null,
            dialogVisible: false,
          };
        }),
      queuePostUpdateNotice: (notice) =>
        set({
          pendingPostUpdateNotice: notice,
          activePostUpdateNotice: null,
        }),
      clearPendingPostUpdateNotice: () => set({ pendingPostUpdateNotice: null }),
      activatePendingPostUpdateNotice: () =>
        set((state) => ({
          availableUpdate: null,
          deferredAvailableUpdate: null,
          dialogVisible: false,
          activePostUpdateNotice: state.pendingPostUpdateNotice,
          pendingPostUpdateNotice: null,
        })),
      dismissPostUpdateNotice: () => set({ activePostUpdateNotice: null }),
    }),
    {
      name: 'sunan.app-update',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        deferredAvailableUpdate: state.deferredAvailableUpdate,
        pendingPostUpdateNotice: state.pendingPostUpdateNotice,
      }),
    }
  )
);
