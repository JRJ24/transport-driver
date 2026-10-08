import type * as Location from 'expo-location';
import type { TrackingLocationPayload } from '@/types/api';

/** Converts an expo-location fix into the backend tracking payload. */
export function buildLocationPayload(
  loc: Location.LocationObject,
  sessionId: string,
): TrackingLocationPayload {
  const { coords, timestamp } = loc;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyMeters: coords.accuracy ?? undefined,
    altitudeMeters: coords.altitude ?? undefined,
    speedMps: coords.speed != null && coords.speed >= 0 ? coords.speed : undefined,
    heading:
      coords.heading != null && coords.heading >= 0 ? coords.heading : undefined,
    recordedAt: new Date(timestamp).toISOString(),
    // Epoch seconds is monotonic per session and fits an int column.
    sequence: Math.floor(timestamp / 1000),
    isMocked: loc.mocked ?? false,
    // Sale del fix y no de un uuid: si llega por el watch y por el task, el
    // unique (sessionId, clientId) del servidor descarta el segundo. Max 64.
    clientId: `${sessionId.slice(0, 8)}-${timestamp}`,
  };
}
