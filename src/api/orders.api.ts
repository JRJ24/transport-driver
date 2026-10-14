import axios from 'axios';
import { http, unwrap } from './client';
import { orderEventsApi } from './order-events.api';
import type {
  ApiResponse,
  Assignment,
  ComputedRoute,
  LatLng,
  OrderApproachRoute,
  OrderStatus,
  OrderStop,
  TransportOrder,
} from '@/types/api';

export interface LiveOrigin extends LatLng {
  heading?: number | null;
}

export type StopAction = 'arrive' | 'complete';

/** La API todavia no tiene el endpoint de paradas (despliegue anterior). */
function isMissingEndpoint(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405);
}

export const ordersApi = {
  async detail(orderId: string): Promise<TransportOrder> {
    const res = await http.get<ApiResponse<TransportOrder>>(`/orders/${orderId}`);
    return unwrap(res.data);
  },

  async route(orderId: string): Promise<ComputedRoute> {
    const res = await http.get<ApiResponse<ComputedRoute>>(
      `/routes/orders/${orderId}`,
    );
    return unwrap(res.data);
  },

  /**
   * Tramo desde el conductor hasta la parada que le toca.
   *
   * Con `origin` la API calcula desde el GPS en vivo en vez del ultimo punto
   * guardado; `reroute` pide recalcular aunque no se haya movido 200 m (se
   * desvio). Una API anterior ignora estos parametros.
   */
  async approach(
    orderId: string,
    origin?: LiveOrigin | null,
    reroute = false,
  ): Promise<OrderApproachRoute> {
    const params: Record<string, string> = {};
    if (origin) {
      params.latitude = origin.latitude.toFixed(6);
      params.longitude = origin.longitude.toFixed(6);
      if (origin.heading != null && origin.heading >= 0) {
        params.heading = String(Math.round(origin.heading));
      }
    }
    if (reroute) params.reroute = 'true';
    const res = await http.get<ApiResponse<OrderApproachRoute>>(
      `/routes/orders/${orderId}/approach`,
      { params },
    );
    return unwrap(res.data);
  },

  /** Driver alias: accept the order's pending assignment. */
  async accept(orderId: string): Promise<Assignment> {
    const res = await http.post<ApiResponse<Assignment>>(
      `/orders/${orderId}/accept`,
      {},
    );
    return unwrap(res.data);
  },

  async updateStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<TransportOrder> {
    const res = await http.patch<ApiResponse<TransportOrder>>(
      `/orders/${orderId}/status`,
      { status },
    );
    return unwrap(res.data);
  },

  /**
   * Marca la llegada a una parada o la completa (en la recogida: «cargué»).
   *
   * Devuelve `server: false` cuando la API desplegada aun no tiene el endpoint:
   * entonces queda constancia en la bitacora con un evento y la app recuerda
   * la fase localmente.
   */
  async stopAction(
    orderId: string,
    stop: OrderStop,
    action: StopAction,
    where?: LatLng | null,
  ): Promise<{ server: boolean; stop?: OrderStop }> {
    const body = where ? { latitude: where.latitude, longitude: where.longitude } : {};
    try {
      const res = await http.post<ApiResponse<OrderStop>>(
        `/orders/${orderId}/stops/${stop.id}/${action}`,
        body,
      );
      return { server: true, stop: unwrap(res.data) };
    } catch (error) {
      if (!isMissingEndpoint(error)) throw error;
    }

    const pickup = stop.stopType === 'PICKUP';
    await orderEventsApi.create({
      orderId,
      eventType: action === 'arrive' ? 'ARRIVED' : pickup ? 'PICKED_UP' : 'ARRIVED',
      description:
        action === 'arrive'
          ? `El conductor llegó al punto de ${pickup ? 'recogida' : 'entrega'}.`
          : 'El conductor recogió la carga.',
      latitude: where?.latitude,
      longitude: where?.longitude,
    });
    return { server: false };
  },
};
