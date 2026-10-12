import { create } from 'zustand';
import { trackingApi } from '@/api/tracking.api';
import { toErrorMessage } from '@/api/client';
import type { LatLng, TrackingSession } from '@/types/api';
import { locationService } from '@/services/location/location.service';
import { locationSync } from '@/services/location/location-sync.service';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { useConnectivity } from './connectivity.store';

interface TrackingState {
  session: TrackingSession | null;
  isTracking: boolean;
  lastFix: LatLng | null;
  lastFixAt: string | null;
  pendingCount: number;
  error: string | null;

  /** Lanza el error de la API (409 si ya hay otro servicio en curso). */
  start: (orderId: string) => Promise<TrackingSession>;
  resume: (orderId: string) => Promise<boolean>;
  stop: () => Promise<void>;
  flush: () => Promise<void>;
  refreshPending: () => Promise<void>;
}

/** Ya hay un servicio con GPS activo para otra orden. */
export class TripInProgressError extends Error {
  constructor(readonly orderId: string) {
    super('Ya tienes un servicio en curso. Termínalo antes de iniciar otro.');
    this.name = 'TripInProgressError';
  }
}

let flushTimer: ReturnType<typeof setInterval> | null = null;
let starting: Promise<TrackingSession> | null = null;

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

  start(orderId) {
    const current = get().session;
    if (current && current.orderId !== orderId) {
      return Promise.reject(new TripInProgressError(current.orderId));
    }
    if (current && current.orderId === orderId && get().isTracking) {
      return Promise.resolve(current);
    }
    // Doble toque: la segunda llamada espera a la primera.
    starting ??= (async () => {
      set({ error: null });
      try {
        const session = await trackingApi.createSession(orderId);
        await attach(session, set, get);
        return session;
      } catch (error) {
        set({ error: toErrorMessage(error) });
        throw error;
      }
    })().finally(() => {
      starting = null;
    });
    return starting;
  },

  /**
   * Recupera la sesion tras un reinicio de la app.
   *
   * Sin red se usa la sesion guardada para el task de background: antes la UI
   * quedaba en «GPS en pausa» y al completar no se cerraba la sesion.
   */
  async resume(orderId) {
    if (get().session?.orderId === orderId && get().isTracking) {
      return true;
    }
    let session: TrackingSession | null = null;
    try {
      session = await trackingApi.activeSession(orderId);
    } catch {
      const cached = await appStorage.get<TrackingSession>(STORAGE_KEYS.activeSession);
      session = cached?.orderId === orderId ? cached : null;
    }
    if (!session) {
      return false;
    }
    try {
      await attach(session, set, get);
      return true;
    } catch {
      return false;
    }
  },

  async stop() {
    const session = get().session ?? (await appStorage.get<TrackingSession>(STORAGE_KEYS.activeSession));
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
