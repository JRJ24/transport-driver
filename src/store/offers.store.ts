import { create } from 'zustand';
import { offersApi, type DriverOffer } from '@/api/offers.api';

interface OffersState {
  offers: DriverOffer[];
  /** Re-reads pending offers: on socket `offer.updated`, reconnect or resume. */
  refresh: () => Promise<void>;
  clear: () => void;
}

export const useOffers = create<OffersState>((set) => ({
  offers: [],

  async refresh() {
    try {
      set({ offers: await offersApi.mine() });
    } catch {
      // Offline or signed out: keep what we have; the next event retries.
    }
  },

  clear() {
    set({ offers: [] });
  },
}));
