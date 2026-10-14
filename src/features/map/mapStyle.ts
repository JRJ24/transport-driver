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

/** Mapa nocturno calido, a juego con el tema oscuro. */
export const darkMapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#1E1B17' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A39C92' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#14120F' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3A342D' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#332E28' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#26221D' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#5A4A2E' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#C4BDB3' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0F2430' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#24201B' }] },
];
