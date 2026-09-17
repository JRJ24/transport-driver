import { Platform } from 'react-native';
import type { LatLng, OrderStop, TransportOrder } from '@/types/api';

/**
 * A donde tiene que ir el conductor ahora mismo.
 *
 * El boton de navegacion mandaba siempre al destino final, asi que al empezar
 * un viaje enviaba a entregar antes de recoger.
 *
 * `completedAt` existe en el modelo pero hoy no lo escribe nadie, de modo que
 * la senal fiable es el estado de la orden: hasta que arranca el viaje toca la
 * recogida, y despues la entrega.
 */
export function nextStopForDriver(order?: TransportOrder | null): OrderStop | null {
  const stops = [...(order?.orderStops ?? [])].sort((a, b) => a.sequence - b.sequence);

  if (stops.length === 0) {
    return null;
  }

  const pending = stops.filter((stop) => !stop.completedAt);
  const pool = pending.length > 0 ? pending : stops;
  const alreadyPickedUp = order?.status === 'IN_PROGRESS' || order?.status === 'DELIVERED';

  if (alreadyPickedUp) {
    return pool.find((stop) => stop.stopType === 'DROPOFF') ?? pool[pool.length - 1] ?? null;
  }

  return pool.find((stop) => stop.stopType === 'PICKUP') ?? pool[0] ?? null;
}

/**
 * Enlace de navegacion por plataforma.
 *
 * En Android `google.navigation:` arranca la guia por voz sin pasar por la
 * vista previa. En iOS se usa Apple Maps: abrir Google Maps requeriria declarar
 * el esquema `comgooglemaps` en `LSApplicationQueriesSchemes`, y el enlace
 * universal ya abre la app de Google Maps cuando esta instalada.
 */
export function googleMapsNavigationUrl({ latitude, longitude }: LatLng) {
  const destination = `${latitude},${longitude}`;

  return Platform.select({
    android: `google.navigation:q=${destination}&mode=d`,
    ios: `maps://?daddr=${destination}&dirflg=d`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving&dir_action=navigate`,
  }) as string;
}

/** Enlace universal de Waze: abre la app si esta instalada, si no la web. */
export function wazeNavigationUrl({ latitude, longitude }: LatLng) {
  return `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
}
