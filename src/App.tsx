import 'react-native-gesture-handler';
// Registers the background location task at module scope (required by Expo).
import '@/services/location/background-location.task';

import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { colors } from '@/theme/theme';
import { navigationRef, navigateToRoute } from '@/navigation/ref';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuth } from '@/store/auth.store';
import { useOrders } from '@/store/order.store';
import { useTracking } from '@/store/tracking.store';
import { useTrip } from '@/store/trip.store';
import { useNotifications } from '@/store/notifications.store';
import { useToast } from '@/store/toast.store';
import { useEvidence } from '@/store/evidence.store';
import type { AppNotification, OrderStatus } from '@/types/api';
import { secureStorage } from '@/services/storage/secure-storage';
import { socketService } from '@/services/socket/socket.service';
import { pushNotifications } from '@/services/notifications/push-notifications.service';
import { presenceService } from '@/services/location/presence.service';
import { useOffers } from '@/store/offers.store';
import { OfferSheet } from '@/features/offers/OfferSheet';
import { ToastHost } from '@/components/ToastHost';

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

function AppRoot() {
  const status = useAuth((s) => s.status);
  const driver = useAuth((s) => s.driver);
  const isTracking = useTracking((s) => s.isTracking);
  const hasTrip = useTrip((s) => Boolean(s.order));
  const bootstrap = useAuth((s) => s.bootstrap);
  const loadAssignments = useOrders((s) => s.loadAssignments);
  const prependNotification = useNotifications((s) => s.prepend);
  const loadNotifications = useNotifications((s) => s.load);
  const wasAuthenticated = useRef(false);

  // One-time setup.
  useEffect(() => {
    pushNotifications.configure();
    // Si el SO mato la app durante un servicio, el task de background sigue
    // encolando puntos: se vuelve a enganchar la sesion a la UI.
    void useTrip.getState().hydrate();
    void bootstrap();

    const unsubscribe = pushNotifications.addListeners(
      (route) => navigateToRoute(route),
      () => {
        void loadNotifications();
      },
    );
    void pushNotifications.getInitialRoute().then((route) => {
      if (route) navigateToRoute(route);
    });
    return unsubscribe;
  }, [bootstrap, loadNotifications]);

  // Live channel while authenticated.
  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    wasAuthenticated.current = true;
    let active = true;
    // El servidor es la verdad del servicio en curso.
    void useTrip.getState().reconcile();

    void (async () => {
      const token = await secureStorage.getAccessToken();
      if (!token || !active) {
        return;
      }
      socketService.connect(token);
      const tripOrderId = useTrip.getState().order?.id;
      if (tripOrderId) {
        socketService.joinOrder(tripOrderId);
      }
      // En cada (re)conexion se resincroniza lo que pudo cambiar sin nosotros.
      socketService.on('connect', () => {
        void useOffers.getState().refresh();
        void loadAssignments();
        void useTrip.getState().refreshOrder();
      });
      socketService.on('offer.updated', () => void useOffers.getState().refresh());
      socketService.on('assignment.created', () => {
        void loadAssignments();
        useToast.getState().show({ tone: 'info', title: 'Nueva orden asignada', message: 'Revísala en Inicio.' });
      });
      socketService.on('notification.created', (payload) => {
        prependNotification(payload as AppNotification);
      });
      socketService.on('order.status.changed', (payload) => {
        void loadAssignments();
        if (payload && typeof payload === 'object' && 'orderId' in payload && 'status' in payload) {
          const { orderId, status: next } = payload as { orderId: string; status: OrderStatus };
          useTrip.getState().onRemoteStatus(String(orderId), next);
        }
      });
    })();
    void loadNotifications();

    // Al volver a la app: estado fresco.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadAssignments();
        void useTrip.getState().refreshOrder();
      }
    });

    return () => {
      active = false;
      sub.remove();
      socketService.disconnect();
      useOffers.getState().clear();
    };
  }, [status, prependNotification, loadAssignments, loadNotifications]);

  // Cerrar sesion (o un 401) no deja GPS ni datos del conductor anterior.
  useEffect(() => {
    if (status === 'unauthenticated' && wasAuthenticated.current) {
      wasAuthenticated.current = false;
      void useTracking.getState().stop();
      void useTrip.getState().clear();
      void useEvidence.getState().clear();
      useOrders.getState().reset();
    }
  }, [status]);

  // Disponible y sin viaje: reporta presencia para que el despacho lo encuentre.
  const available = status === 'authenticated' && driver?.availabilityStatus === 'AVAILABLE';
  useEffect(() => {
    if (available && !isTracking && !hasTrip) {
      void presenceService.start();
      return () => {
        void presenceService.stop();
      };
    }
    if (status === 'authenticated' && !available) {
      void presenceService.stop({ leave: true });
    }
    return undefined;
  }, [available, isTracking, hasTrip, status]);

  return (
    <>
      <RootNavigator />
      {status === 'authenticated' && driver && !hasTrip ? <OfferSheet /> : null}
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <AppRoot />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
