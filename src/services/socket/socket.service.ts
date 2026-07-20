import { io, type Socket } from 'socket.io-client';
import { env } from '@/config/env';

type Handler = (payload: unknown) => void;

/**
 * Thin wrapper over socket.io-client. The websocket delivers live updates
 * (location, order status, notifications); it is NOT the source of truth for
 * the GPS history — that is persisted over HTTP. Reconnection is automatic.
 */
class SocketService {
  private socket: Socket | null = null;

  connect(accessToken: string): void {
    if (this.socket?.connected) {
      return;
    }
    this.socket?.disconnect();
    this.socket = io(env.socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
  }

  joinOrder(orderId: string): void {
    this.socket?.emit('tracking:join-order', { orderId });
  }

  leaveOrder(orderId: string): void {
    this.socket?.emit('tracking:leave-order', { orderId });
  }

  on(event: string, handler: Handler): void {
    this.socket?.on(event, handler);
  }

  off(event: string, handler?: Handler): void {
    this.socket?.off(event, handler);
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
