import { create } from 'zustand';
import type { AvailableAppUpdate } from '@/lib/updates';

type AppUpdateStore = {
  availableUpdate: AvailableAppUpdate | null;
  dialogVisible: boolean;
  setAvailableUpdate: (update: AvailableAppUpdate | null) => void;
  showDialog: () => void;
  hideDialog: () => void;
  clearAvailableUpdate: () => void;
};

export const useAppUpdateStore = create<AppUpdateStore>((set) => ({
  availableUpdate: null,
  dialogVisible: false,
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
}));
