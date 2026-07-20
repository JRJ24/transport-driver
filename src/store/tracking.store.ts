import { create } from 'zustand';
import { trackingApi } from '@/api/tracking.api';
import { toErrorMessage } from '@/api/client';
import type { LatLng, TrackingSession } from '@/types/api';
import { locationService } from '@/services/location/location.service';
import { locationSync } from '@/services/location/location-sync.service';
import { useConnectivity } from './connectivity.store';

interface TrackingState {
  session: TrackingSession | null;
  isTracking: boolean;
  lastFix: LatLng | null;
  lastFixAt: string | null;
  pendingCount: number;
  error: string | null;

  start: (orderId: string) => Promise<boolean>;
  stop: () => Promise<void>;
  flush: () => Promise<void>;
  refreshPending: () => Promise<void>;
}

let flushTimer: ReturnType<typeof setInterval> | null = null;

export const useTracking = create<TrackingState>((set, get) => ({
  session: null,
  isTracking: false,
  lastFix: null,
  lastFixAt: null,
  pendingCount: 0,
  error: null,

  async start(orderId) {
    set({ error: null });
    try {
      const session = await trackingApi.createSession(orderId);
      set({ session, isTracking: true });

      await locationService.start(session, (loc) => {
        set({
          lastFix: {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          },
          lastFixAt: new Date(loc.timestamp).toISOString(),
        });
      });

      flushTimer ??= setInterval(() => {
        void get().flush();
      }, 15000);
      return true;
    } catch (error) {
      set({ isTracking: false, error: toErrorMessage(error) });
      return false;
    }
  },

  async stop() {
    const session = get().session;
    await locationService.stop();
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    await get().flush();
    if (session) {
      await trackingApi.stop(session.id).catch(() => undefined);
    }
    set({ session: null, isTracking: false });
  },

  async flush() {
    try {
      const synced = await locationSync.flush();
      const pending = await locationSync.pending();
      set({ pendingCount: pending });
      if (synced > 0) {
        useConnectivity.getState().markSynced();
      }
    } catch {
      useConnectivity.getState().setOnline(false);
    }
  },

  async refreshPending() {
    set({ pendingCount: await locationSync.pending() });
  },
}));
