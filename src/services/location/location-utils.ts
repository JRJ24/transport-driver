import type * as Location from 'expo-location';
import { uuid } from '@/utils/id';
import type { TrackingLocationPayload } from '@/types/api';

/** Converts an expo-location fix into the backend tracking payload. */
export function buildLocationPayload(
  loc: Location.LocationObject,
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
    clientId: uuid(),
  };
}
