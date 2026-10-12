import { create } from 'zustand';
import { appStorage } from '@/services/storage/app-storage';

export type Point = { x: number; y: number };
export type Stroke = Point[];

export interface EvidencePhoto {
  uri: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
}

/**
 * Borrador de evidencia de UNA orden. Se guarda en disco: si el SO cierra la
 * app en la puerta del cliente, la foto y la firma siguen ahi. Tambien guarda
 * que partes ya llegaron al servidor, para que reintentar no duplique nada.
 */
export interface EvidenceDraft {
  orderId: string;
  recipientName: string;
  recipientDocument: string;
  notes: string;
  photo: EvidencePhoto | null;
  strokes: Stroke[];
  signatureSize: { width: number; height: number };
  proofId: string | null;
  photoUploaded: boolean;
  signatureSaved: boolean;
}

const KEY = 'transport-driver.evidenceDraft';

function empty(orderId: string): EvidenceDraft {
  return {
    orderId,
    recipientName: '',
    recipientDocument: '',
    notes: '',
    photo: null,
    strokes: [],
    signatureSize: { width: 320, height: 200 },
    proofId: null,
    photoUploaded: false,
    signatureSaved: false,
  };
}

interface EvidenceState {
  draft: EvidenceDraft | null;
  load: (orderId: string) => Promise<EvidenceDraft>;
  update: (patch: Partial<EvidenceDraft>) => void;
  clear: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useEvidence = create<EvidenceState>((set, get) => ({
  draft: null,

  async load(orderId) {
    const current = get().draft;
    if (current?.orderId === orderId) return current;
    const stored = await appStorage.get<EvidenceDraft>(KEY).catch(() => null);
    const draft = stored?.orderId === orderId ? { ...empty(orderId), ...stored } : empty(orderId);
    set({ draft });
    return draft;
  },

  update(patch) {
    const draft = get().draft;
    if (!draft) return;
    const next = { ...draft, ...patch };
    set({ draft: next });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void appStorage.set(KEY, next).catch(() => undefined), 300);
  },

  async clear() {
    if (saveTimer) clearTimeout(saveTimer);
    set({ draft: null });
    await appStorage.remove(KEY).catch(() => undefined);
  },
}));
