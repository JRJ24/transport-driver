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
import { useNotifications } from '@/store/notifications.store';
import type { AppNotification } from '@/types/api';
import { secureStorage } from '@/services/storage/secure-storage';
import { socketService } from '@/services/socket/socket.service';
import { pushNotifications } from '@/services/notifications/push-notifications.service';

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
  const bootstrap = useAuth((s) => s.bootstrap);
  const hydrateOrders = useOrders((s) => s.hydrateFromCache);
  const loadAssignments = useOrders((s) => s.loadAssignments);
  const selectOrder = useOrders((s) => s.selectOrder);
  const prependNotification = useNotifications((s) => s.prepend);
  const loadNotifications = useNotifications((s) => s.load);

  // One-time setup.
  useEffect(() => {
    pushNotifications.configure();
    void hydrateOrders();
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
    };
  }, [status, prependNotification, loadAssignments, loadNotifications, selectOrder]);

  return <RootNavigator />;
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
