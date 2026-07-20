import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { trackingApi } from '@/api/tracking.api';
import type { TrackingLocationPayload } from '@/types/api';

interface QueuedLocation {
  sessionId: string;
  payload: TrackingLocationPayload;
}

/** Cap the local queue so a long offline stretch can't exhaust storage. */
const MAX_QUEUE = 2000;

/**
 * Offline-first GPS queue. Points are appended (foreground or background) and
 * flushed in batches when connectivity returns. Idempotency (clientId) +
 * server-side skipDuplicates make re-sends safe.
 */
export const locationSync = {
  async enqueue(sessionId: string, payload: TrackingLocationPayload): Promise<void> {
    const queue =
      (await appStorage.get<QueuedLocation[]>(STORAGE_KEYS.locationQueue)) ?? [];
    queue.push({ sessionId, payload });
    if (queue.length > MAX_QUEUE) {
      queue.splice(0, queue.length - MAX_QUEUE);
    }
    await appStorage.set(STORAGE_KEYS.locationQueue, queue);
  },

  async pending(): Promise<number> {
    const queue = await appStorage.get<QueuedLocation[]>(
      STORAGE_KEYS.locationQueue,
    );
    return queue?.length ?? 0;
  },

  /** Flushes all queued points grouped by session. Returns points synced. */
  async flush(): Promise<number> {
    const queue = await appStorage.get<QueuedLocation[]>(
      STORAGE_KEYS.locationQueue,
    );
    if (!queue || queue.length === 0) {
      return 0;
    }

    const bySession = new Map<string, TrackingLocationPayload[]>();
    for (const item of queue) {
      const list = bySession.get(item.sessionId) ?? [];
      list.push(item.payload);
      bySession.set(item.sessionId, list);
    }

    const failed: QueuedLocation[] = [];
    let synced = 0;
    for (const [sessionId, points] of bySession) {
      try {
        await trackingApi.sendBatch(sessionId, points);
        synced += points.length;
      } catch {
        // Keep for the next attempt.
        failed.push(...points.map((payload) => ({ sessionId, payload })));
      }
    }

    await appStorage.set(STORAGE_KEYS.locationQueue, failed);
    return synced;
  },

  async clear(): Promise<void> {
    await appStorage.remove(STORAGE_KEYS.locationQueue);
  },
};
