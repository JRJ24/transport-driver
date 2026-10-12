import { create } from 'zustand';
import { ordersApi, type LiveOrigin } from '@/api/orders.api';
import { trackingApi } from '@/api/tracking.api';
import { driversApi } from '@/api/drivers.api';
import type {
  ComputedRoute,
  LatLng,
  OrderApproachRoute,
  OrderStatus,
  OrderStop,
  TransportOrder,
} from '@/types/api';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { socketService } from '@/services/socket/socket.service';
import { isNetworkError } from '@/utils/errors';
import {
  dropoffStop,
  pickupStop,
  targetStopFor,
  tripPhase,
  type TripMarks,
  type TripPhase,
} from '@/utils/orders';
import { useTracking, TripInProgressError } from './tracking.store';
import { isWatchedOrder, useOrders } from './order.store';
import { useAuth } from './auth.store';
import { toast } from './toast.store';

const MARKS_KEY = 'transport-driver.tripMarks';
const TERMINAL: ReadonlySet<OrderStatus> = new Set(['DELIVERED', 'CANCELLED', 'FAILED']);

interface StoredMarks extends TripMarks {
  orderId: string;
}

/**
 * EL servicio en curso: una sola orden, persistida y reconciliada con el
 * servidor al arrancar. Ver otra orden nunca la toca.
 */
interface TripState {
  order: TransportOrder | null;
  /** Recorrido completo recogida → entrega (vista general). */
  route: ComputedRoute | null;
  /** Tramo vivo desde el conductor hasta la parada que toca. */
  approach: OrderApproachRoute | null;
  marks: TripMarks;
  starting: boolean;
  completing: boolean;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  reconcile: () => Promise<void>;
  start: (orderId: string) => Promise<TransportOrder>;
  refreshOrder: () => Promise<void>;
  refreshRoute: () => Promise<void>;
  refreshApproach: (origin?: LiveOrigin | null, reroute?: boolean) => Promise<void>;
  markArrived: (where?: LatLng | null) => Promise<void>;
  confirmPickup: (where?: LatLng | null) => Promise<void>;
  complete: () => Promise<TransportOrder>;
  onRemoteStatus: (orderId: string, status: OrderStatus) => void;
  clear: () => Promise<void>;
}

// Sube con cada inicio/cierre: una respuesta tardia de otro servicio no se
// aplica (antes resucitaba la orden ya entregada).
let epoch = 0;

async function persist(order: TransportOrder | null, route: ComputedRoute | null, marks: TripMarks) {
  if (!order) return;
  await Promise.all([
    appStorage.set(STORAGE_KEYS.activeOrder, order),
    route ? appStorage.set(STORAGE_KEYS.activeRoute, route) : Promise.resolve(),
    appStorage.set<StoredMarks>(MARKS_KEY, { orderId: order.id, ...marks }),
  ]).catch(() => undefined);
}

function mergeStop(order: TransportOrder, stop?: OrderStop): TransportOrder {
  if (!stop) return order;
  return {
    ...order,
    orderStops: (order.orderStops ?? []).map((s) => (s.id === stop.id ? { ...s, ...stop } : s)),
  };
}

async function refreshDriver(): Promise<void> {
  const { driver, setDriver } = useAuth.getState();
  if (!driver) return;
  const fresh = await driversApi.me().catch(() => null);
  if (fresh) setDriver({ ...driver, ...fresh, user: fresh.user ?? driver.user });
}

export const useTrip = create<TripState>((set, get) => ({
  order: null,
  route: null,
  approach: null,
  marks: {},
  starting: false,
  completing: false,
  hydrated: false,

  async hydrate() {
    const [order, route, marks] = await Promise.all([
      appStorage.get<TransportOrder>(STORAGE_KEYS.activeOrder),
      appStorage.get<ComputedRoute>(STORAGE_KEYS.activeRoute),
      appStorage.get<StoredMarks>(MARKS_KEY),
    ]);
    if (order && !TERMINAL.has(order.status)) {
      set({
        order,
        route,
        marks: marks?.orderId === order.id ? marks : {},
      });
      useOrders.getState().setPinnedOrder(order.id);
      void useTracking.getState().resume(order.id);
    }
    set({ hydrated: true });
  },

  /**
   * El servidor manda: sesion activa del conductor o, si no, una orden suya
   * EN CURSO. Sin red se mantiene lo que habia en cache.
   */
  async reconcile() {
    const myEpoch = epoch;
    try {
      const session = await trackingApi.activeSession();
      let orderId = session?.orderId ?? get().order?.id ?? null;
      if (!orderId) {
        await useOrders.getState().loadAssignments();
        orderId =
          useOrders
            .getState()
            .assignments.find(
              (a) => a.assignmentStatus === 'ACCEPTED' && a.order?.status === 'IN_PROGRESS',
            )?.orderId ?? null;
      }
      if (!orderId) {
        if (get().order) await get().clear();
        return;
      }
      const order = await ordersApi.detail(orderId);
      if (myEpoch !== epoch) return;
      if (!order || TERMINAL.has(order.status)) {
        await useTracking.getState().stop();
        // La API aun no cierra la sesion al entregar: se cierra aqui.
        if (session && session.orderId === orderId) {
          await trackingApi.stop(session.id).catch(() => undefined);
        }
        await get().clear();
        return;
      }
      const sameOrder = get().order?.id === order.id;
      set({ order, marks: sameOrder ? get().marks : {} });
      useOrders.getState().setPinnedOrder(order.id);
      await persist(order, get().route, get().marks);
      if (order.status === 'IN_PROGRESS') {
        const resumed = await useTracking.getState().resume(order.id);
        if (!resumed) {
          // La sesion se cerro (403, reinstalacion…): se abre otra para la misma orden.
          await useTracking.getState().start(order.id).catch(() => undefined);
        }
      }
      void get().refreshRoute();
      void get().refreshApproach(useTracking.getState().lastFix);
    } catch (error) {
      // Sin red se conserva la cache. Un 403/404 al leer la orden: ya no es
      // del conductor, asi que se suelta.
      if (!isNetworkError(error) && isGone(error) && myEpoch === epoch) {
        await useTracking.getState().stop();
        await get().clear();
      }
    }
  },

  async start(orderId) {
    const current = get().order;
    if (current && current.id !== orderId) {
      throw new TripInProgressError(current.id);
    }
    set({ starting: true });
    try {
      await useTracking.getState().start(orderId);
      epoch++;
      const order = await ordersApi.detail(orderId);
      const marks = current?.id === orderId ? get().marks : {};
      set({ order, marks, approach: null });
      useOrders.getState().setPinnedOrder(orderId);
      await persist(order, get().route, marks);
      void get().refreshRoute();
      void get().refreshApproach(useTracking.getState().lastFix);
      void useOrders.getState().loadAssignments();
      void refreshDriver();
      return order;
    } finally {
      set({ starting: false });
    }
  },

  async refreshOrder() {
    const current = get().order;
    if (!current) return;
    const myEpoch = epoch;
    const order = await ordersApi.detail(current.id).catch(() => null);
    if (!order || myEpoch !== epoch || get().order?.id !== order.id) return;
    if (TERMINAL.has(order.status)) {
      get().onRemoteStatus(order.id, order.status);
      return;
    }
    set({ order });
    await persist(order, get().route, get().marks);
  },

  async refreshRoute() {
    const order = get().order;
    if (!order) return;
    const myEpoch = epoch;
    const route = await ordersApi.route(order.id).catch(() => null);
    if (route && myEpoch === epoch && get().order?.id === order.id) {
      set({ route });
      await appStorage.set(STORAGE_KEYS.activeRoute, route).catch(() => undefined);
    }
  },

  async refreshApproach(origin, reroute = false) {
    const order = get().order;
    if (!order) return;
    const myEpoch = epoch;
    const approach = await ordersApi.approach(order.id, origin, reroute).catch(() => null);
    if (approach && myEpoch === epoch && get().order?.id === order.id) {
      set({ approach });
    }
  },

  async markArrived(where) {
    const order = get().order;
    if (!order) return;
    const phase = tripPhase(order, get().marks);
    const stop = targetStopFor(order, phase);
    if (!stop) return;
    const res = await ordersApi.stopAction(order.id, stop, 'arrive', where);
    const now = new Date().toISOString();
    const marks: TripMarks =
      stop.stopType === 'PICKUP'
        ? { ...get().marks, arrivedPickupAt: now }
        : { ...get().marks, arrivedDropoffAt: now };
    const next = mergeStop(order, res.stop);
    set({ order: next, marks });
    await persist(next, get().route, marks);
  },

  async confirmPickup(where) {
    const order = get().order;
    const pickup = pickupStop(order);
    if (!order || !pickup) return;
    const res = await ordersApi.stopAction(order.id, pickup, 'complete', where);
    const now = new Date().toISOString();
    const marks: TripMarks = {
      ...get().marks,
      arrivedPickupAt: get().marks.arrivedPickupAt ?? now,
      pickedUpAt: now,
    };
    const next = mergeStop(order, res.stop);
    set({ order: next, marks, approach: null });
    await persist(next, get().route, marks);
    void get().refreshApproach(where ?? useTracking.getState().lastFix, true);
  },

  async complete() {
    const order = get().order;
    if (!order) throw new Error('No hay un servicio en curso.');
    set({ completing: true });
    try {
      // Antes de DELIVERED: despues la asignacion queda COMPLETED y el servidor
      // rechaza los puntos que seguian en cola.
      await useTracking.getState().flush();
      const delivered = await ordersApi.updateStatus(order.id, 'DELIVERED');
      epoch++;
      await useTracking.getState().stop();
      await get().clear();
      void useOrders.getState().loadAssignments();
      void refreshDriver();
      return { ...order, ...delivered };
    } finally {
      set({ completing: false });
    }
  },

  onRemoteStatus(orderId, status) {
    const order = get().order;
    if (!order || order.id !== orderId || get().completing) return;
    if (status === 'CANCELLED' || status === 'FAILED') {
      epoch++;
      void useTracking.getState().stop();
      void get().clear();
      toast.warning(
        status === 'CANCELLED' ? 'Servicio cancelado' : 'Servicio marcado como fallido',
        `La orden ${order.orderCode} fue ${status === 'CANCELLED' ? 'cancelada' : 'cerrada'} por operaciones.`,
      );
      void refreshDriver();
      return;
    }
    if (status === 'DELIVERED') {
      epoch++;
      void useTracking.getState().stop();
      void get().clear();
      return;
    }
    void get().refreshOrder();
  },

  async clear() {
    const orderId = get().order?.id;
    epoch++;
    set({ order: null, route: null, approach: null, marks: {} });
    useOrders.getState().setPinnedOrder(null);
    if (orderId && !isWatchedOrder(orderId)) {
      socketService.leaveOrder(orderId);
    }
    await Promise.all([
      appStorage.remove(STORAGE_KEYS.activeOrder),
      appStorage.remove(STORAGE_KEYS.activeRoute),
      appStorage.remove(MARKS_KEY),
    ]).catch(() => undefined);
  },
}));

function isGone(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 403 || status === 404;
}

export function useTripPhase(): TripPhase | null {
  return useTrip((s) => (s.order ? tripPhase(s.order, s.marks) : null));
}

export { pickupStop, dropoffStop };
