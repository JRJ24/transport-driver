import { http, unwrap } from './client';
import type {
  ApiResponse,
  BatchResult,
  TrackingLocationPayload,
  TrackingSession,
} from '@/types/api';

export const trackingApi = {
  async createSession(orderId: string): Promise<TrackingSession> {
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
