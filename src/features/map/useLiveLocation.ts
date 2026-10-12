import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from '@/types/api';

export interface LiveFix extends LatLng {
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  at: number;
}

/**
 * GPS fino solo para dibujar (1 s / 3 m) mientras la pantalla de ruta esta
 * visible. El envio al servidor sigue siendo cosa de location.service y del
 * task de background; esto no manda nada.
 *
 * El rumbo sale del GPS cuando el vehiculo se mueve y de la brujula cuando
 * esta parado (el GPS no da rumbo a baja velocidad).
 */
export function useLiveLocation(enabled: boolean): LiveFix | null {
  const [fix, setFix] = useState<LiveFix | null>(null);
  const compass = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let posSub: Location.LocationSubscription | null = null;
    let headSub: Location.LocationSubscription | null = null;

    void (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted || cancelled) return;

      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last && !cancelled) {
        setFix({
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          heading: null,
          speed: null,
          accuracy: last.coords.accuracy ?? null,
          at: last.timestamp,
        });
      }

      headSub = await Location.watchHeadingAsync((h) => {
        compass.current = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      }).catch(() => null);

      posSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 },
        (loc) => {
          const moving = (loc.coords.speed ?? 0) > 1.5;
          const gpsHeading = loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : null;
          setFix({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: moving && gpsHeading != null ? gpsHeading : compass.current,
            speed: loc.coords.speed ?? null,
            accuracy: loc.coords.accuracy ?? null,
            at: loc.timestamp,
          });
        },
      ).catch(() => null);

      if (cancelled) {
        posSub?.remove();
        headSub?.remove();
      }
    })();

    return () => {
      cancelled = true;
      posSub?.remove();
      headSub?.remove();
    };
  }, [enabled]);

  return fix;
}
