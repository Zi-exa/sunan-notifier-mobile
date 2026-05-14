import { create } from 'zustand';

type PushTokenSyncStatus = 'idle' | 'syncing' | 'ready' | 'unavailable' | 'error';

type PushTokenSyncState = {
  status: PushTokenSyncStatus;
  message: string;
  tokenKind: 'expo' | 'native' | null;
  lastUpdatedAt: number | null;
  setSyncing: () => void;
  setReady: (tokenKind: 'expo' | 'native') => void;
  setUnavailable: (message: string) => void;
  setError: (message: string) => void;
};

export const usePushTokenSyncStore = create<PushTokenSyncState>((set) => ({
  status: 'idle',
  message: 'Belum dicek.',
  tokenKind: null,
  lastUpdatedAt: null,
  setSyncing: () =>
    set({
      status: 'syncing',
      message: 'Mendaftarkan perangkat...',
      tokenKind: null,
      lastUpdatedAt: Date.now(),
    }),
  setReady: (tokenKind) =>
    set({
      status: 'ready',
      message: 'Perangkat siap menerima notifikasi.',
      tokenKind,
      lastUpdatedAt: Date.now(),
    }),
  setUnavailable: (message) =>
    set({
      status: 'unavailable',
      message,
      tokenKind: null,
      lastUpdatedAt: Date.now(),
    }),
  setError: (message) =>
    set({
      status: 'error',
      message,
      tokenKind: null,
      lastUpdatedAt: Date.now(),
    }),
}));
