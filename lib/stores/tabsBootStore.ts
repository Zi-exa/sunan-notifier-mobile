import { create } from 'zustand';

export type TabsBootStatus = 'loading' | 'ready' | 'failed';

type TabsBootState = {
  status: TabsBootStatus;
  setStatus: (status: TabsBootStatus) => void;
  reset: () => void;
};

export const useTabsBootStore = create<TabsBootState>((set) => ({
  status: 'loading',
  setStatus: (status) => set({ status }),
  reset: () => set({ status: 'loading' }),
}));
