import { create } from 'zustand';
import { notificationsApi } from '@/api/notifications.api';
import type { AppNotification } from '@/types/api';

interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  prepend: (item: AppNotification) => void;
}

const countUnread = (items: AppNotification[]): number =>
  items.filter((n) => !n.readAt).length;

export const useNotifications = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,

  async load() {
    const items = await notificationsApi.listMine().catch(() => []);
    set({ items, unreadCount: countUnread(items) });
  },

  async markRead(id) {
    await notificationsApi.markRead(id).catch(() => undefined);
    const items = get().items.map((n) =>
      n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
    );
    set({ items, unreadCount: countUnread(items) });
  },

  prepend(item) {
    const items = [item, ...get().items.filter((n) => n.id !== item.id)];
    set({ items, unreadCount: countUnread(items) });
  },
}));
