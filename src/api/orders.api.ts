import { http, unwrap } from './client';
import type {
  ApiResponse,
  Assignment,
  ComputedRoute,
  OrderStatus,
  TransportOrder,
} from '@/types/api';

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
};
