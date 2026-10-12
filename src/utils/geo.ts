import type { LatLng, OrderStop } from '@/types/api';

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumbo inicial de a hacia b, en grados 0-360. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function stopPoint(stop?: OrderStop | null): LatLng | null {
  if (!stop || stop.latitude === null || stop.longitude === null) return null;
  const latitude = Number(stop.latitude);
  const longitude = Number(stop.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0)
    ? { latitude, longitude }
    : null;
}

export interface Snap {
  /** Punto de la ruta mas cercano al conductor. */
  point: LatLng;
  /** Indice del segmento [i, i+1] donde cae. */
  index: number;
  /** Distancia del conductor a la ruta, en metros. */
  offRouteMeters: number;
}

/**
 * Proyecta la posicion sobre la polilinea. Usa una proyeccion plana local,
 * suficiente para tramos urbanos de unos cientos de metros.
 */
export function snapToPolyline(fix: LatLng, line: LatLng[]): Snap | null {
  if (line.length < 2) return null;
  const k = Math.cos(toRad(fix.latitude));
  let best: Snap | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const ax = a.longitude * k;
    const ay = a.latitude;
    const bx = b.longitude * k;
    const by = b.latitude;
    const px = fix.longitude * k;
    const py = fix.latitude;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const point = { latitude: ay + t * dy, longitude: (ax + t * dx) / k };
    const d = haversine(fix, point);
    if (!best || d < best.offRouteMeters) {
      best = { point, index: i, offRouteMeters: d };
    }
  }
  return best;
}

export function polylineLength(line: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) total += haversine(line[i], line[i + 1]);
  return total;
}

/**
 * Lo que queda por recorrer: desde la posicion proyectada hasta el final. Asi
 * la linea sale del vehiculo y se va "consumiendo" mientras avanza, como en
 * Uber.
 */
export function remainingPath(fix: LatLng, line: LatLng[]): { path: LatLng[]; meters: number; snap: Snap } | null {
  const snap = snapToPolyline(fix, line);
  if (!snap) return null;
  const path = [snap.point, ...line.slice(snap.index + 1)];
  return { path, meters: polylineLength(path), snap };
}
