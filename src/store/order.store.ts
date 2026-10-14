import { create } from 'zustand';
import { driversApi } from '@/api/drivers.api';
import { ordersApi } from '@/api/orders.api';
import type { Assignment, AssignmentStatus, OrderStatus } from '@/types/api';
import { socketService } from '@/services/socket/socket.service';
import { friendlyError } from '@/utils/errors';

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

// El servidor emite order.status.changed a order:{id}: sin estar en la room de
// cada orden asignada, una cancelacion desde el TMS no llega.
let watchedOrderIds = new Set<string>();

function watchAssignedOrders(assignments: Assignment[], pinnedOrderId: string | null): void {
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
    if (!next.has(orderId) && orderId !== pinnedOrderId) {
      socketService.leaveOrder(orderId);
    }
  });
  next.forEach((orderId) => socketService.joinOrder(orderId));
  watchedOrderIds = next;
}

export function isWatchedOrder(orderId: string): boolean {
  return watchedOrderIds.has(orderId);
}

/**
 * Lista de asignaciones del conductor. Ya NO guarda «la orden activa»: ver
 * el detalle de una orden no cambia el servicio en curso (eso es useTrip).
 */
interface OrderState {
  assignments: Assignment[];
  loaded: boolean;
  /** Recarga visible (pull-to-refresh). Las recargas por socket no la tocan. */
  refreshing: boolean;
  error: string | null;
  /** Orden del servicio activo: nunca se sale de su room. */
  pinnedOrderId: string | null;

  loadAssignments: (opts?: { visible?: boolean }) => Promise<void>;
  accept: (orderId: string) => Promise<void>;
  setPinnedOrder: (orderId: string | null) => void;
  reset: () => void;
}

export const useOrders = create<OrderState>((set, get) => ({
  assignments: [],
  loaded: false,
  refreshing: false,
  error: null,
  pinnedOrderId: null,

  async loadAssignments(opts) {
    if (opts?.visible) set({ refreshing: true });
    try {
      const assignments = await driversApi.myAssignments();
      set({ assignments, loaded: true, error: null });
      watchAssignedOrders(assignments, get().pinnedOrderId);
    } catch (error) {
      set({ error: friendlyError(error, 'No pudimos cargar tus órdenes.') });
    } finally {
      if (opts?.visible) set({ refreshing: false });
    }
  },

  async accept(orderId) {
    await ordersApi.accept(orderId);
    await get().loadAssignments();
  },

  setPinnedOrder(orderId) {
    set({ pinnedOrderId: orderId });
    if (orderId) socketService.joinOrder(orderId);
  },

  reset() {
    watchedOrderIds.forEach((id) => socketService.leaveOrder(id));
    watchedOrderIds = new Set();
    set({ assignments: [], loaded: false, refreshing: false, error: null, pinnedOrderId: null });
  },
}));
