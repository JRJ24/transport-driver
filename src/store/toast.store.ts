import { create } from 'zustand';
import { haptic } from '@/utils/feedback';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  durationMs: number;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

/**
 * Avisos no bloqueantes con vibracion acorde. Reemplazan los Alert que
 * obligaban a tocar «OK» en plena ruta.
 */
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show(toast) {
    const id = ++seq;
    const durationMs = toast.durationMs ?? (toast.tone === 'danger' ? 5000 : 3500);
    ({ success: haptic.success, info: haptic.light, warning: haptic.warning, danger: haptic.error })[
      toast.tone
    ]();
    // Maximo dos a la vez: el mas viejo cede su lugar.
    set({ toasts: [...get().toasts.slice(-1), { ...toast, id, durationMs }] });
    setTimeout(() => get().dismiss(id), durationMs);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  success: (title: string, message?: string) => useToast.getState().show({ tone: 'success', title, message }),
  info: (title: string, message?: string) => useToast.getState().show({ tone: 'info', title, message }),
  warning: (title: string, message?: string) => useToast.getState().show({ tone: 'warning', title, message }),
  error: (title: string, message?: string) => useToast.getState().show({ tone: 'danger', title, message }),
};
