import type { NotificationRoute } from '@/types/api';

const VALID_SCREENS = new Set([
  'order-detail',
  'order-offer',
  'orders',
  'route',
  'profile',
  'notifications',
  'login',
]);

/**
 * Validates an untrusted push `data` payload before the app navigates. Never
 * navigate on raw payload — a malformed/spoofed payload must be ignored.
 */
export function parseNotificationRoute(
  data: unknown,
): NotificationRoute | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type : null;
  if (!type) {
    return null;
  }

  const screen =
    typeof record.screen === 'string' && VALID_SCREENS.has(record.screen)
      ? record.screen
      : undefined;
  const orderId =
    typeof record.orderId === 'string' && record.orderId.length > 0
      ? record.orderId
      : undefined;

  return { type, screen, orderId };
}
