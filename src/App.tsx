import 'react-native-gesture-handler';
// Registers the background location task at module scope (required by Expo).
import '@/services/location/background-location.task';

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DarkTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { colors } from '@/theme/theme';
import { navigationRef, navigateToRoute } from '@/navigation/ref';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuth } from '@/store/auth.store';
import { useOrders } from '@/store/order.store';
import { useTracking } from '@/store/tracking.store';
import { useNotifications } from '@/store/notifications.store';
import type { AppNotification } from '@/types/api';
import { secureStorage } from '@/services/storage/secure-storage';
import { socketService } from '@/services/socket/socket.service';
import { pushNotifications } from '@/services/notifications/push-notifications.service';
import { presenceService } from '@/services/location/presence.service';
import { useOffers } from '@/store/offers.store';
import { OfferSheet } from '@/features/offers/OfferSheet';

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primaryBright,
  },
};

function AppRoot() {
  const status = useAuth((s) => s.status);
  const driver = useAuth((s) => s.driver);
  const isTracking = useTracking((s) => s.isTracking);
  const bootstrap = useAuth((s) => s.bootstrap);
  const hydrateOrders = useOrders((s) => s.hydrateFromCache);
  const loadAssignments = useOrders((s) => s.loadAssignments);
  const selectOrder = useOrders((s) => s.selectOrder);
  const prependNotification = useNotifications((s) => s.prepend);
  const loadNotifications = useNotifications((s) => s.load);

  // One-time setup.
  useEffect(() => {
    pushNotifications.configure();
    // Si el SO mato la app durante un servicio, el task de background sigue
    // encolando puntos: hay que volver a enganchar la sesion a la UI.
    void hydrateOrders().then(() => {
      const active = useOrders.getState().activeOrder;
      if (active) {
        void useTracking.getState().resume(active.id);
      }
    });
    void bootstrap();

    const unsubscribe = pushNotifications.addListeners(
      (route) => navigateToRoute(route),
      () => {
        void loadNotifications();
      },
    );
    void pushNotifications.getInitialRoute().then((route) => {
      if (route) {
        setTimeout(() => navigateToRoute(route), 800);
      }
    });
    return unsubscribe;
  }, [bootstrap, hydrateOrders, loadNotifications]);

  // Live channel while authenticated.
  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    let active = true;
    void (async () => {
      const token = await secureStorage.getAccessToken();
      if (!token || !active) {
        return;
      }
      socketService.connect(token);
      // Dispatch offers and TMS assignments reach the driver in real time.
      const refreshOffers = () => void useOffers.getState().refresh();
      socketService.on('offer.updated', refreshOffers);
      socketService.on('connect', refreshOffers);
      socketService.on('assignment.created', () => {
        void loadAssignments();
      });
      socketService.on('notification.created', (payload) => {
        prependNotification(payload as AppNotification);
      });
      socketService.on('order.status.changed', (payload) => {
        void loadAssignments();
        const activeOrder = useOrders.getState().activeOrder;
        const changedOrderId =
          payload && typeof payload === 'object' && 'orderId' in payload
            ? String(payload.orderId)
            : null;
        if (activeOrder && changedOrderId === activeOrder.id) {
          void selectOrder(activeOrder.id);
        }
      });
    })();
    void loadNotifications();

    return () => {
      active = false;
      socketService.disconnect();
      useOffers.getState().clear();
    };
  }, [status, prependNotification, loadAssignments, loadNotifications, selectOrder]);

  // Available and not on a trip: report presence so dispatch can find us.
  const available =
    status === 'authenticated' && driver?.availabilityStatus === 'AVAILABLE';
  useEffect(() => {
    if (available && !isTracking) {
      void presenceService.start();
      return () => {
        void presenceService.stop();
      };
    }
    if (status === 'authenticated' && !available) {
      void presenceService.stop({ leave: true });
    }
    return undefined;
  }, [available, isTracking, status]);

  return (
    <>
      <RootNavigator />
      {status === 'authenticated' && driver ? <OfferSheet /> : null}
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
