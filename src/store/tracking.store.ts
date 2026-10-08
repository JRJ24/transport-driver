import { create } from 'zustand';
import { trackingApi } from '@/api/tracking.api';
import { toErrorMessage } from '@/api/client';
import type { LatLng, TrackingSession } from '@/types/api';
import { locationService } from '@/services/location/location.service';
import { locationSync } from '@/services/location/location-sync.service';
import { useConnectivity } from './connectivity.store';
import { useOrders } from './order.store';

interface TrackingState {
  session: TrackingSession | null;
  isTracking: boolean;
  lastFix: LatLng | null;
  lastFixAt: string | null;
  pendingCount: number;
  error: string | null;

  start: (orderId: string) => Promise<boolean>;
  resume: (orderId: string) => Promise<void>;
  stop: () => Promise<void>;
  flush: () => Promise<void>;
  refreshPending: () => Promise<void>;
}

let flushTimer: ReturnType<typeof setInterval> | null = null;

type SetState = (partial: Partial<TrackingState>) => void;
type GetState = () => TrackingState;

/** Engancha el GPS a una sesion, venga de `start()` o de `resume()`. */
async function attach(
  session: TrackingSession,
  set: SetState,
  get: GetState,
): Promise<void> {
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
}

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
      // Crear la sesion pasa la orden a IN_PROGRESS sin emitir
      // order.status.changed: sin recargarla, «Como llegar» seguia en la recogida.
      const refreshed = useOrders.getState().selectOrder(orderId);
      await attach(session, set, get);
      await refreshed;
      return true;
    } catch (error) {
      set({ isTracking: false, error: toErrorMessage(error) });
      return false;
    }
  },

  /**
   * Recupera la sesion de tracking tras un reinicio de la app.
   *
   * El task de background sobrevive a que el SO mate la app y sigue encolando
   * puntos, pero la sesion solo vivia en memoria: la UI decia «GPS en pausa» y
   * «Completar entrega» ya no llamaba a `stop()`, asi que la sesion se quedaba
   * ACTIVE para siempre en la base de datos.
   */
  async resume(orderId) {
    try {
      const session = await trackingApi.activeSession(orderId);
      if (!session) {
        return;
      }

      await attach(session, set, get);
    } catch {
      // Sin red al arrancar: el task de background sigue encolando igual.
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

/*
 * El servidor ya no acepta puntos de la sesion (403: un operador la termino o
 * el conductor ya no esta asignado). Se apaga el GPS y se cierra la sesion: con
 * FORBIDDEN seguiria ACTIVE y nadie mas la terminaria.
 */
locationSync.setRejectedHandler((sessionId) => {
  const { session } = useTracking.getState();
  if (session?.id !== sessionId) {
    return;
  }
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  useTracking.setState({ session: null, isTracking: false });
  void locationService.stop().catch(() => undefined);
  void trackingApi.stop(sessionId).catch(() => undefined);
  void useTracking.getState().refreshPending().catch(() => undefined);
});
