import axios from 'axios';
import { http, unwrap } from './client';
import type {
  ApiResponse,
  BatchResult,
  TrackingLocationPayload,
  TrackingSession,
} from '@/types/api';

export const trackingApi = {
  /**
   * Inicia (o recupera) la sesion de la orden.
   *
   * `pickupFlow` pide a la API que NO dé la carga por recogida al iniciar: la
   * ruta va primero a la recogida hasta que el conductor la confirme. Una API
   * anterior rechaza el campo con 400; entonces se reintenta sin el.
   */
  async createSession(orderId: string): Promise<TrackingSession> {
    try {
      const res = await http.post<ApiResponse<TrackingSession>>(
        '/tracking/sessions',
        { orderId, pickupFlow: true },
      );
      return unwrap(res.data);
    } catch (error) {
      const legacy =
        axios.isAxiosError(error) &&
        error.response?.status === 400 &&
        /pickupFlow/i.test(JSON.stringify(error.response.data ?? ''));
      if (!legacy) throw error;
    }
    const res = await http.post<ApiResponse<TrackingSession>>(
      '/tracking/sessions',
      { orderId },
    );
    return unwrap(res.data);
  },

  async activeSession(orderId?: string): Promise<TrackingSession | null> {
    const res = await http.get<ApiResponse<TrackingSession | null>>(
      '/tracking/sessions/active',
      { params: orderId ? { orderId } : undefined },
    );
    return unwrap(res.data);
  },

  async sendLocation(
    sessionId: string,
    payload: TrackingLocationPayload,
  ): Promise<unknown> {
    const res = await http.post<ApiResponse<unknown>>(
      `/tracking/sessions/${sessionId}/locations`,
      payload,
    );
    return unwrap(res.data);
  },

  async sendBatch(
    sessionId: string,
    locations: TrackingLocationPayload[],
  ): Promise<BatchResult> {
    const res = await http.post<ApiResponse<BatchResult>>(
      `/tracking/sessions/${sessionId}/locations/batch`,
      { locations },
    );
    return unwrap(res.data);
  },

  async stop(sessionId: string): Promise<TrackingSession> {
    const res = await http.post<ApiResponse<TrackingSession>>(
      `/tracking/sessions/${sessionId}/stop`,
      {},
    );
    return unwrap(res.data);
  },
};
