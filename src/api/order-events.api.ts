import { http, unwrap } from './client';
import type { ApiResponse, OrderEvent, OrderEventType } from '@/types/api';

export interface CreateOrderEventInput {
  orderId: string;
  eventType: OrderEventType;
  description?: string;
  latitude?: number;
  longitude?: number;
}

export const orderEventsApi = {
  async create(input: CreateOrderEventInput): Promise<OrderEvent> {
    const res = await http.post<ApiResponse<OrderEvent>>('/order-events', input);
    return unwrap(res.data);
  },

  async listForOrder(orderId: string): Promise<OrderEvent[]> {
    const res = await http.get<ApiResponse<OrderEvent[]>>(
      `/order-events/orders/${orderId}`,
    );
    return unwrap(res.data);
  },
};
