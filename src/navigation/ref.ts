import { createNavigationContainerRef } from '@react-navigation/native';
import type { NotificationRoute } from '@/types/api';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Navigates from a validated push route once the container is ready. */
export function navigateToRoute(route: NotificationRoute): void {
  if (!navigationRef.isReady()) {
    return;
  }

  switch (route.screen) {
    case 'order-detail':
      if (route.orderId) {
        navigationRef.navigate('Main', {
          screen: 'Inicio',
          params: { screen: 'OrderDetail', params: { orderId: route.orderId } },
        } as never);
      }
      return;
    // The offer sheet is global and opens itself; just land on the home tab.
    case 'order-offer':
      navigationRef.navigate('Main', {
        screen: 'Inicio',
        params: { screen: 'Tasks' },
      } as never);
      return;
    case 'route':
      navigationRef.navigate('Main', { screen: 'Ruta' } as never);
      return;
    case 'profile':
      navigationRef.navigate('Main', { screen: 'Perfil' } as never);
      return;
    case 'notifications':
      navigationRef.navigate('Main', {
        screen: 'Inicio',
        params: { screen: 'Notifications' },
      } as never);
      return;
    case 'orders':
    default:
      navigationRef.navigate('Main', {
        screen: 'Inicio',
        params: { screen: 'Tasks' },
      } as never);
  }
}
