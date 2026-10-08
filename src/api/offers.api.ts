import { http, unwrap } from './client';
import type { ApiResponse, Assignment, TransportOrder } from '@/types/api';

export type OfferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

/** Automatic dispatch offer: the nearest order, with a deadline to answer. */
export interface DriverOffer {
  id: string;
  orderId: string;
  driverId: string;
  vehicleId: string;
  rank: number;
  etaSeconds: number | null;
  status: OfferStatus;
  mode: 'AUTO' | 'MANUAL';
  expiresAt: string | null;
  createdAt: string;
  order?: TransportOrder;
}

/** Position of an available driver, so dispatch can find them by H3 cell. */
export interface PresencePing {
  latitude: number;
  longitude: number;
  accuracyM: number;
  heading?: number;
  speed?: number;
  vehicleId?: string;
  isMocked?: boolean;
  observedAt: string;
}

/** Respuesta a un ping de presencia; `reason` dice por que no se guardo. */
export type PresenceResult =
  | { accepted: true; h3Cell: string; expiresAt: string }
  | { accepted: false; reason: string };

export const offersApi = {
  async mine(): Promise<DriverOffer[]> {
    const res = await http.get<ApiResponse<DriverOffer[]>>('/offers/me');
    return unwrap(res.data);
  },

  async accept(offerId: string): Promise<Assignment> {
    const res = await http.post<ApiResponse<Assignment>>(
      `/offers/${offerId}/accept`,
      {},
    );
    return unwrap(res.data);
  },

  async reject(offerId: string, reason?: string): Promise<DriverOffer> {
    const res = await http.post<ApiResponse<DriverOffer>>(
      `/offers/${offerId}/reject`,
      reason ? { reason } : {},
    );
    return unwrap(res.data);
  },

  /** REST fallback of the `driver:presence` socket event. */
  async ping(input: PresencePing): Promise<PresenceResult> {
    const res = await http.post<ApiResponse<PresenceResult>>(
      '/drivers/me/presence',
      input,
    );
    return unwrap(res.data);
  },

  async leave(): Promise<void> {
    await http.delete('/drivers/me/presence');
  },
};
