import * as Location from 'expo-location';
import { trackingApi } from '@/api/tracking.api';
import type { TrackingSession } from '@/types/api';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { BACKGROUND_LOCATION_TASK } from './background-location.task';
import { buildLocationPayload } from './location-utils';
import {
  isRetryable,
  isSessionRejected,
  locationSync,
} from './location-sync.service';

type FixListener = (location: Location.LocationObject) => void;

/**
 * Owns GPS acquisition for an active tracking session. Foreground: a live watch
 * drives the map and sends fixes. Background: expo-location delivers batched
 * fixes to the TaskManager task. Retryable failures fall back to the offline
 * queue.
 */
class LocationService {
  private watch: Location.LocationSubscription | null = null;
  private sessionId: string | null = null;

  async start(session: TrackingSession, onFix?: FixListener): Promise<void> {
    this.sessionId = session.id;
    // Persist so the background task (separate JS context) knows the session.
    await appStorage.set(STORAGE_KEYS.activeSession, session);

    // Primero el background, para que el watch lo vea activo desde el primer fix.
    await this.startBackground();

    this.watch?.remove();
    this.watch = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 15,
      },
      (loc) => {
        onFix?.(loc);
        void this.sendOrQueue(session.id, loc);
      },
    );
  }

  private async startBackground(): Promise<void> {
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      return;
    }
    const already = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    ).catch(() => false);
    if (already) {
      return;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 15,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'RUTA RD Driver — servicio activo',
        notificationBody: 'Compartiendo ubicación durante la entrega.',
        notificationColor: '#2563EB',
      },
    });
  }

  async stop(): Promise<void> {
    this.watch?.remove();
    this.watch = null;
    this.sessionId = null;

    const running = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    ).catch(() => false);
    if (running) {
      // El task se detiene solo ante un 403 y puede ganar esta carrera.
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(
        () => undefined,
      );
    }
    await appStorage.remove(STORAGE_KEYS.activeSession);
  }

  get isTracking(): boolean {
    return this.sessionId !== null;
  }

  private async sendOrQueue(
    sessionId: string,
    loc: Location.LocationObject,
  ): Promise<void> {
    // Con el task de background activo, ese ya envia este mismo fix: mandarlo
    // tambien desde aqui guardaba cada punto dos veces.
    const backgroundSends = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    ).catch(() => false);
    if (backgroundSends) {
      return;
    }

    const payload = buildLocationPayload(loc, sessionId);
    try {
      await trackingApi.sendLocation(sessionId, payload);
    } catch (error) {
      if (isRetryable(error)) {
        await locationSync.enqueue(sessionId, payload);
      } else if (isSessionRejected(error)) {
        await locationSync.rejectSession(sessionId);
      }
      // 400/404: no entrara nunca; encolarlo bloqueaba el lote de su sesion.
    }
  }
}

export const locationService = new LocationService();
