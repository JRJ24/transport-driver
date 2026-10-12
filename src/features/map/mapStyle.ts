import type { MapStyleElement } from 'react-native-maps';

/** Mapa claro y limpio: sin negocios ni transporte publico que distraigan. */
export const lightMapStyle: MapStyleElement[] = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -60 }, { lightness: 20 }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F4F1EC' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE3F2' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FBE7C2' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6B6460' }] },
];
