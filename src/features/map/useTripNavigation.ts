import { useEffect, useMemo, useRef } from 'react';
import type { LatLng, TransportOrder } from '@/types/api';
import { useTrip } from '@/store/trip.store';
import { decodePolyline } from '@/utils/polyline';
import { haversine, polylineLength, remainingPath, stopPoint } from '@/utils/geo';
import { targetStopFor, tripPhase, type TripPhase } from '@/utils/orders';
import type { LiveFix } from './useLiveLocation';

/** Fuera de la ruta a partir de aqui (dos lecturas seguidas). */
const OFF_ROUTE_M = 50;
/** Minimo entre recalculos por desvio: la API permite 60/min. */
const REROUTE_EVERY_MS = 15_000;
/** Refresco de trafico/ETA aunque vaya bien. */
const REFRESH_EVERY_MS = 45_000;
/** «Estas llegando». */
export const ARRIVAL_RADIUS_M = 150;

export interface TripNavigation {
  phase: TripPhase;
  target: LatLng | null;
  /** Lo que queda de la ruta, desde el vehiculo hasta la parada. */
  path: LatLng[];
  /** true si la ruta viene de la API; false = linea recta provisional. */
  routed: boolean;
  remainingMeters: number | null;
  etaMinutes: number | null;
  distanceToTarget: number | null;
  nearTarget: boolean;
  /** Distancia del vehiculo a la linea de la ruta. */
  offRouteMeters: number;
}

/**
 * Motor de navegacion: elige el tramo que toca, lo recorta desde la posicion
 * actual (la linea se «consume» al avanzar), calcula ETA y km restantes y pide
 * otra ruta a la API cuando el conductor se desvia.
 */
export function useTripNavigation(order: TransportOrder | null, fix: LiveFix | null): TripNavigation | null {
  const approach = useTrip((s) => s.approach);
  const route = useTrip((s) => s.route);
  const marks = useTrip((s) => s.marks);
  const refreshApproach = useTrip((s) => s.refreshApproach);

  const phase = order ? tripPhase(order, marks) : null;
  const targetStop = order && phase ? targetStopFor(order, phase) : undefined;
  const target = stopPoint(targetStop);

  // Tramo vivo de la API, si apunta a la parada correcta. Una API anterior
  // apunta siempre a la entrega: hacia la recogida se dibuja recta.
  const leg = useMemo(() => {
    if (approach?.route?.polyline && approach.targetStopId && approach.targetStopId === targetStop?.id) {
      const line = decodePolyline(approach.route.polyline);
      return { line, length: polylineLength(line), seconds: approach.route.durationSeconds };
    }
    if (route?.polyline && (phase === 'TO_DROPOFF' || phase === 'AT_DROPOFF')) {
      const line = decodePolyline(route.polyline);
      return { line, length: polylineLength(line), seconds: route.durationSeconds };
    }
    return null;
  }, [approach, route, targetStop?.id, phase]);

  const offRouteHits = useRef(0);
  const lastRefresh = useRef(0);

  // Al cambiar de fase (recogio la carga) se pide el tramo nuevo enseguida.
  useEffect(() => {
    if (!order) return;
    lastRefresh.current = Date.now();
    void refreshApproach(fix, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, phase]);

  const result = useMemo<TripNavigation | null>(() => {
    if (!order || !phase) return null;
    const distanceToTarget = fix && target ? haversine(fix, target) : null;
    let path: LatLng[] = [];
    let remainingMeters: number | null = distanceToTarget;
    let etaMinutes: number | null = null;
    let offRoute = 0;

    if (leg && leg.line.length > 1) {
      const rem = fix ? remainingPath(fix, leg.line) : null;
      if (rem) {
        path = [{ latitude: fix!.latitude, longitude: fix!.longitude }, ...rem.path];
        remainingMeters = rem.meters + rem.snap.offRouteMeters;
        offRoute = rem.snap.offRouteMeters;
      } else {
        path = leg.line;
        remainingMeters = leg.length;
      }
      etaMinutes = leg.length > 0 && remainingMeters != null ? (leg.seconds * (remainingMeters / leg.length)) / 60 : null;
    } else if (fix && target) {
      path = [fix, target];
      // Sin ruta: estimacion urbana a 25 km/h sobre 1.3x la distancia recta.
      etaMinutes = distanceToTarget != null ? (distanceToTarget * 1.3) / (25_000 / 60) : null;
      remainingMeters = distanceToTarget != null ? distanceToTarget * 1.3 : null;
    }

    return {
      phase,
      target,
      path,
      routed: Boolean(leg),
      remainingMeters,
      etaMinutes,
      distanceToTarget,
      nearTarget: distanceToTarget != null && distanceToTarget <= ARRIVAL_RADIUS_M,
      offRouteMeters: offRoute,
    };
  }, [order, phase, fix, target, leg]);

  // Desvio y refresco periodico.
  useEffect(() => {
    if (!result || !fix) return;
    offRouteHits.current = result.offRouteMeters > OFF_ROUTE_M ? offRouteHits.current + 1 : 0;
    const since = Date.now() - lastRefresh.current;
    if ((offRouteHits.current >= 2 && since > REROUTE_EVERY_MS) || (!result.routed && since > REROUTE_EVERY_MS)) {
      lastRefresh.current = Date.now();
      offRouteHits.current = 0;
      void refreshApproach(fix, true);
    } else if (since > REFRESH_EVERY_MS) {
      lastRefresh.current = Date.now();
      void refreshApproach(fix, false);
    }
  }, [fix, result, refreshApproach]);

  return result;
}
