import { createNavigationContainerRef } from '@react-navigation/native';
import type { NotificationRoute } from '@/types/api';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Un push tocado con la app cerrada llega antes de que exista «Main»: se
// guarda y se aplica cuando las pestañas montan (antes, un setTimeout de
// 800 ms que a veces se perdia).
let pending: NotificationRoute | null = null;
let mainReady = false;

export function setMainReady(ready: boolean): void {
  mainReady = ready;
  if (ready && pending) {
    const route = pending;
    pending = null;
    navigateToRoute(route);
  }
}

/** Navigates from a validated push route once the container is ready. */
export function navigateToRoute(route: NotificationRoute): void {
  if (!navigationRef.isReady() || !mainReady) {
    pending = route;
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

export function goToRouteTab(): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', { screen: 'Ruta' } as never);
  }
}

export function goToTab(tab: 'Inicio' | 'Ruta' | 'Perfil'): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', { screen: tab } as never);
  }
}

export function goToNotifications(): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', { screen: 'Inicio', params: { screen: 'Notifications' } } as never);
  }
}

export function openEvidence(orderId: string): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Evidence', { orderId });
  }
}
