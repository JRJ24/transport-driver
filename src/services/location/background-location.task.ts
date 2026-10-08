import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { trackingApi } from '@/api/tracking.api';
import type { TrackingSession } from '@/types/api';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { buildLocationPayload } from './location-utils';
import {
  isRetryable,
  isSessionRejected,
  locationSync,
} from './location-sync.service';

export const BACKGROUND_LOCATION_TASK = 'transport-driver.background-location';

/**
 * MUST be defined at module scope and loaded at app start. Fires with batched
 * fixes while the app is backgrounded. Each fix is sent immediately; on a
 * retryable failure it is queued for later batch sync (offline-first). The
 * active session id is read from persistent storage because this runs in a
 * separate JS context.
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
    const payload = buildLocationPayload(loc, session.id);
    try {
      await trackingApi.sendLocation(session.id, payload);
    } catch (sendError) {
      if (isRetryable(sendError)) {
        await locationSync.enqueue(session.id, payload);
      } else if (isSessionRejected(sendError)) {
        await stopRejectedSession(session.id);
        return;
      }
      // 400/404: no entrara nunca; encolarlo bloqueaba el lote de su sesion.
    }
  }
});

/**
 * La sesion termino o ya no hay asignacion. El task sigue vivo con la app
 * cerrada, asi que se apaga solo: si no, enviaria cada 5 s un 403 tras otro.
 */
async function stopRejectedSession(sessionId: string): Promise<void> {
  const current = await appStorage.get<TrackingSession>(
    STORAGE_KEYS.activeSession,
  );
  // Si entretanto empezo otra sesion, el task ya es de ella.
  if (current?.id === sessionId) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(
      () => undefined,
    );
    await appStorage.remove(STORAGE_KEYS.activeSession);
  }
  await locationSync.rejectSession(sessionId);
}
