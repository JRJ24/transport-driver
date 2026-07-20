import * as Location from 'expo-location';
import { trackingApi } from '@/api/tracking.api';
import type { TrackingSession } from '@/types/api';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { BACKGROUND_LOCATION_TASK } from './background-location.task';
import { buildLocationPayload } from './location-utils';
import { locationSync } from './location-sync.service';

type FixListener = (location: Location.LocationObject) => void;

/**
 * Owns GPS acquisition for an active tracking session. Foreground: a live watch
 * drives the map and sends fixes. Background: expo-location delivers batched
 * fixes to the TaskManager task. All sends fall back to the offline queue.
 */
class LocationService {
  private watch: Location.LocationSubscription | null = null;
  private sessionId: string | null = null;

  async start(session: TrackingSession, onFix?: FixListener): Promise<void> {
    this.sessionId = session.id;
    // Persist so the background task (separate JS context) knows the session.
    await appStorage.set(STORAGE_KEYS.activeSession, session);

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

    await this.startBackground();
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
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
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
    const payload = buildLocationPayload(loc);
    try {
      await trackingApi.sendLocation(sessionId, payload);
    } catch {
      await locationSync.enqueue(sessionId, payload);
    }
  }
}

export const locationService = new LocationService();
