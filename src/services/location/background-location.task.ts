import * as TaskManager from 'expo-task-manager';
import type * as Location from 'expo-location';
import { trackingApi } from '@/api/tracking.api';
import type { TrackingSession } from '@/types/api';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { buildLocationPayload } from './location-utils';
import { locationSync } from './location-sync.service';

export const BACKGROUND_LOCATION_TASK = 'transport-driver.background-location';

/**
 * MUST be defined at module scope and loaded at app start. Fires with batched
 * fixes while the app is backgrounded. Each fix is sent immediately; on failure
 * it is queued for later batch sync (offline-first). The active session id is
 * read from persistent storage because this runs in a separate JS context.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async (body) => {
  const { data, error } = body as {
    data?: { locations?: Location.LocationObject[] };
    error?: unknown;
  };
  if (error || !data?.locations?.length) {
    return;
  }

  const session = await appStorage.get<TrackingSession>(
    STORAGE_KEYS.activeSession,
  );
  if (!session) {
    return;
  }

  for (const loc of data.locations) {
    const payload = buildLocationPayload(loc);
    try {
      await trackingApi.sendLocation(session.id, payload);
    } catch {
      await locationSync.enqueue(session.id, payload);
    }
  }
});
