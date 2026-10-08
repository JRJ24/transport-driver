import { create } from 'zustand';
import { driversApi } from '@/api/drivers.api';
import { ordersApi } from '@/api/orders.api';
import { toErrorMessage } from '@/api/client';
import type {
  Assignment,
  AssignmentStatus,
  ComputedRoute,
  OrderApproachRoute,
  OrderStatus,
  TransportOrder,
} from '@/types/api';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { socketService } from '@/services/socket/socket.service';

const CLOSED_ASSIGNMENTS: ReadonlySet<AssignmentStatus> = new Set([
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
]);
const CLOSED_ORDERS: ReadonlySet<OrderStatus> = new Set([
  'DELIVERED',
  'CANCELLED',
  'FAILED',
]);

// El servidor emite order.status.changed solo a order:{id}, no a driver:{id}:
// sin estar en la room de cada orden asignada, una cancelacion desde el TMS
// de una orden que no esta abierta no llega.
let watchedOrderIds = new Set<string>();

function watchAssignedOrders(
  assignments: Assignment[],
  activeOrderId: string | undefined,
): void {
  const next = new Set(
    assignments
      .filter(
        (a) =>
          !CLOSED_ASSIGNMENTS.has(a.assignmentStatus) &&
          !(a.order && CLOSED_ORDERS.has(a.order.status)),
      )
      .map((a) => a.orderId),
  );
  watchedOrderIds.forEach((orderId) => {
    if (!next.has(orderId) && orderId !== activeOrderId) {
      socketService.leaveOrder(orderId);
    }
  });
  next.forEach((orderId) => socketService.joinOrder(orderId));
  watchedOrderIds = next;
}

interface OrderState {
  assignments: Assignment[];
  activeOrder: TransportOrder | null;
  route: ComputedRoute | null;
  /** Tramo del conductor a la parada. No se persiste: caduca al moverse. */
  approach: OrderApproachRoute | null;
  loadingList: boolean;
  loadingOrder: boolean;
  error: string | null;

  loadAssignments: () => Promise<void>;
  selectOrder: (orderId: string) => Promise<void>;
  refreshRoute: () => Promise<void>;
  refreshApproach: () => Promise<void>;
  accept: (orderId: string) => Promise<void>;
  updateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  hydrateFromCache: () => Promise<void>;
  clearActive: () => Promise<void>;
}

export const useOrders = create<OrderState>((set, get) => ({
  assignments: [],
  activeOrder: null,
  route: null,
  approach: null,
  loadingList: false,
  loadingOrder: false,
  error: null,

  async loadAssignments() {
    set({ loadingList: true, error: null });
    try {
      const assignments = await driversApi.myAssignments();
      set({ assignments, loadingList: false });
      watchAssignedOrders(assignments, get().activeOrder?.id);
    } catch (error) {
      set({ loadingList: false, error: toErrorMessage(error) });
    }
  },

  async selectOrder(orderId) {
    set({ loadingOrder: true, error: null });
    try {
      const order = await ordersApi.detail(orderId);
      const previousOrderId = get().activeOrder?.id;
      if (
        previousOrderId &&
        previousOrderId !== orderId &&
        !watchedOrderIds.has(previousOrderId)
      ) {
        socketService.leaveOrder(previousOrderId);
      }
      set({ activeOrder: order });
      socketService.joinOrder(orderId);
      await appStorage.set(STORAGE_KEYS.activeOrder, order);

      const route = await ordersApi.route(orderId).catch(() => null);
      set({ route, loadingOrder: false });
      if (route) {
        await appStorage.set(STORAGE_KEYS.activeRoute, route);
      }

      await get().refreshApproach();
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

  /**
   * Tramo hasta la parada que toca.
   *
   * No se cachea en disco como la ruta: depende de donde este el conductor, y
   * un valor viejo dibujaria la linea saliendo de un sitio donde ya no esta.
   * El backend solo llama a Google cuando el conductor se alejo mas de 200 m.
   */
  async refreshApproach() {
    const order = get().activeOrder;
    if (!order) {
      return;
    }
    set({ approach: await ordersApi.approach(order.id).catch(() => null) });
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
      // Sin esto, tras reabrir la app no llega una cancelacion de la orden
      // activa hasta entrar al detalle. El Set lo guarda hasta que conecte.
      socketService.joinOrder(order.id);
    }
  },

  async clearActive() {
    const orderId = get().activeOrder?.id;
    if (orderId && !watchedOrderIds.has(orderId)) {
      socketService.leaveOrder(orderId);
    }
    set({ activeOrder: null, route: null, approach: null });
    await appStorage.remove(STORAGE_KEYS.activeOrder);
    await appStorage.remove(STORAGE_KEYS.activeRoute);
  },
}));
