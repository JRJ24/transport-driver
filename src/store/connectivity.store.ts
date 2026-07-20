import { create } from 'zustand';

interface ConnectivityState {
  online: boolean;
  lastSyncAt: string | null;
  setOnline: (online: boolean) => void;
  markSynced: () => void;
}

/** Lightweight connectivity flag toggled by API success/failure. */
export const useConnectivity = create<ConnectivityState>((set) => ({
  online: true,
  lastSyncAt: null,
  setOnline: (online) => set({ online }),
  markSynced: () => set({ online: true, lastSyncAt: new Date().toISOString() }),
}));
