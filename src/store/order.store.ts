import { create } from 'zustand';
import { driversApi } from '@/api/drivers.api';
import { ordersApi } from '@/api/orders.api';
import { toErrorMessage } from '@/api/client';
import type {
  Assignment,
  ComputedRoute,
  OrderStatus,
  TransportOrder,
} from '@/types/api';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';

interface OrderState {
  assignments: Assignment[];
  activeOrder: TransportOrder | null;
  route: ComputedRoute | null;
  loadingList: boolean;
  loadingOrder: boolean;
  error: string | null;

  loadAssignments: () => Promise<void>;
  selectOrder: (orderId: string) => Promise<void>;
  refreshRoute: () => Promise<void>;
  accept: (orderId: string) => Promise<void>;
  updateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  hydrateFromCache: () => Promise<void>;
  clearActive: () => Promise<void>;
}

export const useOrders = create<OrderState>((set, get) => ({
  assignments: [],
  activeOrder: null,
  route: null,
  loadingList: false,
  loadingOrder: false,
  error: null,

  async loadAssignments() {
    set({ loadingList: true, error: null });
    try {
      const assignments = await driversApi.myAssignments();
      set({ assignments, loadingList: false });
    } catch (error) {
      set({ loadingList: false, error: toErrorMessage(error) });
    }
  },

  async selectOrder(orderId) {
    set({ loadingOrder: true, error: null });
    try {
      const order = await ordersApi.detail(orderId);
      set({ activeOrder: order });
      await appStorage.set(STORAGE_KEYS.activeOrder, order);

      const route = await ordersApi.route(orderId).catch(() => null);
      set({ route, loadingOrder: false });
      if (route) {
        await appStorage.set(STORAGE_KEYS.activeRoute, route);
      }
    } catch (error) {
      set({ loadingOrder: false, error: toErrorMessage(error) });
    }
  },

  async refreshRoute() {
    const order = get().activeOrder;
    if (!order) {
      return;
    }
    const route = await ordersApi.route(order.id).catch(() => null);
    if (route) {
      set({ route });
      await appStorage.set(STORAGE_KEYS.activeRoute, route);
    }
  },

  async accept(orderId) {
    await ordersApi.accept(orderId);
    await get().loadAssignments();
    await get().selectOrder(orderId);
  },

  async updateStatus(orderId, status) {
    const order = await ordersApi.updateStatus(orderId, status);
    set({ activeOrder: order });
    await appStorage.set(STORAGE_KEYS.activeOrder, order);
  },

  async hydrateFromCache() {
    const [order, route] = await Promise.all([
      appStorage.get<TransportOrder>(STORAGE_KEYS.activeOrder),
      appStorage.get<ComputedRoute>(STORAGE_KEYS.activeRoute),
    ]);
    if (order) {
      set({ activeOrder: order, route });
    }
  },

  async clearActive() {
    set({ activeOrder: null, route: null });
    await appStorage.remove(STORAGE_KEYS.activeOrder);
    await appStorage.remove(STORAGE_KEYS.activeRoute);
  },
}));
