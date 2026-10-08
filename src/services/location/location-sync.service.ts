import axios from 'axios';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { trackingApi } from '@/api/tracking.api';
import type { ApiError, TrackingLocationPayload } from '@/types/api';

interface QueuedLocation {
  sessionId: string;
  payload: TrackingLocationPayload;
}

/** Cap the local queue so a long offline stretch can't exhaust storage. */
const MAX_QUEUE = 2000;

/*
 * Cada punto pesa ~320 B: 150 caben con margen en los 100 KB de body de Express
 * y en el ArrayMaxSize(500) del DTO. Mandar la cola entera daba 413/400 y la
 * cola ya no bajaba nunca.
 */
const CHUNK_SIZE = 150;

/*
 * Partir un lote con 400 cuesta hasta 2n-1 peticiones seguidas, y el throttle
 * del servidor (100/min por usuario) es el mismo del resto de la app. Alcanza
 * para la cola entera (2000 / 150); lo demas sigue en el proximo flush.
 */
const MAX_REQUESTS_PER_FLUSH = 20;

/**
 * Sin respuesta, timeout, throttle o 5xx: el mismo punto puede entrar despues.
 * 401 tambien: el punto sigue siendo valido, solo falta sesion (el task sin
 * token o un refresh sin red) y entra cuando el conductor vuelve a entrar.
 */
export function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error) || !error.response) {
    return true;
  }
  const { status } = error.response;
  return status === 401 || status === 408 || status === 429 || status >= 500;
}

/** 403 de dominio: la sesion termino, no es del conductor o ya no hay asignacion. */
export function isSessionRejected(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 403) {
    return false;
  }
  const code = (error.response.data as Partial<ApiError> | undefined)?.error?.code;
  return code === 'DOMAIN_RULE_VIOLATION' || code === 'FORBIDDEN';
}

function statusOf(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

function keyOf(item: QueuedLocation): string {
  return `${item.sessionId}|${item.payload.clientId ?? item.payload.recordedAt}`;
}

let queueLock: Promise<unknown> = Promise.resolve();
let onRejected: ((sessionId: string) => void) | null = null;

/*
 * El watch, el task de background y flush() tocan la cola a la vez. Antes
 * flush() la reescribia con su copia y borraba lo encolado mientras enviaba.
 */
function updateQueue(
  change: (queue: QueuedLocation[]) => QueuedLocation[],
): Promise<void> {
  const run = queueLock.then(async () => {
    const queue =
      (await appStorage.get<QueuedLocation[]>(STORAGE_KEYS.locationQueue)) ?? [];
    await appStorage.set(STORAGE_KEYS.locationQueue, change(queue));
  });
  queueLock = run.catch(() => undefined);
  return run;
}

/**
 * Offline-first GPS queue. Points are appended (foreground or background) and
 * flushed in batches when connectivity returns. Idempotency (clientId) +
 * server-side skipDuplicates make re-sends safe.
 */
export const locationSync = {
  async enqueue(sessionId: string, payload: TrackingLocationPayload): Promise<void> {
    await updateQueue((queue) => {
      queue.push({ sessionId, payload });
      if (queue.length > MAX_QUEUE) {
        queue.splice(0, queue.length - MAX_QUEUE);
      }
      return queue;
    });
  },

  async pending(): Promise<number> {
    const queue = await appStorage.get<QueuedLocation[]>(
      STORAGE_KEYS.locationQueue,
    );
    return queue?.length ?? 0;
  },

  /** Recibe el id de cada sesion que el servidor rechaza para siempre. */
  setRejectedHandler(handler: (sessionId: string) => void): void {
    onRejected = handler;
  },

  /** Descarta lo encolado de una sesion que el servidor ya no acepta. */
  async rejectSession(sessionId: string): Promise<void> {
    await updateQueue((queue) =>
      queue.filter((item) => item.sessionId !== sessionId),
    );
    onRejected?.(sessionId);
  },

  /** Flushes queued points per session, in chunks. Returns points synced. */
  async flush(): Promise<number> {
    const queue = await appStorage.get<QueuedLocation[]>(
      STORAGE_KEYS.locationQueue,
    );
    if (!queue || queue.length === 0) {
      return 0;
    }

    const bySession = new Map<string, QueuedLocation[]>();
    const seen = new Set<string>();
    for (const item of queue) {
      const key = keyOf(item);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const list = bySession.get(item.sessionId) ?? [];
      list.push(item);
      bySession.set(item.sessionId, list);
    }

    // Lo que no debe volver a la cola: enviado o que el servidor no aceptara.
    const done = new Set<string>();
    const droppedSessions = new Set<string>();
    const rejected: string[] = [];
    let synced = 0;
    let requests = 0;

    sessions: for (const [sessionId, items] of bySession) {
      const chunks: QueuedLocation[][] = [];
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        chunks.push(items.slice(i, i + CHUNK_SIZE));
      }

      for (let chunk = chunks.shift(); chunk; chunk = chunks.shift()) {
        if (requests++ >= MAX_REQUESTS_PER_FLUSH) {
          break sessions;
        }
        try {
          await trackingApi.sendBatch(
            sessionId,
            chunk.map((item) => item.payload),
          );
          synced += chunk.length;
          chunk.forEach((item) => done.add(keyOf(item)));
        } catch (error) {
          if (isRetryable(error)) {
            // Sin red o servidor caido: el resto espera al proximo flush, en orden.
            break sessions;
          }
          const status = statusOf(error);
          if ((status === 413 || status === 400) && chunk.length > 1) {
            // Partir hasta aislar el punto que el servidor rechaza.
            const half = Math.ceil(chunk.length / 2);
            chunks.unshift(chunk.slice(0, half), chunk.slice(half));
            continue;
          }
          if (status === 403 || status === 404) {
            // La sesion no existe, termino o no es de este conductor.
            droppedSessions.add(sessionId);
            if (isSessionRejected(error)) {
              rejected.push(sessionId);
            }
            break;
          }
          // Un punto suelto con 400 (u otro 4xx) no entrara nunca y bloqueaba su sesion.
          chunk.forEach((item) => done.add(keyOf(item)));
        }
      }
    }

    if (done.size > 0 || droppedSessions.size > 0) {
      // Se relee la cola: lo encolado durante el envio se conserva.
      await updateQueue((current) =>
        current.filter(
          (item) => !droppedSessions.has(item.sessionId) && !done.has(keyOf(item)),
        ),
      );
    }
    rejected.forEach((sessionId) => onRejected?.(sessionId));
    return synced;
  },

  async clear(): Promise<void> {
    await appStorage.remove(STORAGE_KEYS.locationQueue);
  },
};
