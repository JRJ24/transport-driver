import { Platform } from 'react-native';
import type { LatLng } from '@/types/api';

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
