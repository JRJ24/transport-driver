import { io, type Socket } from 'socket.io-client';
import { apiClient } from '@/api/client';
import { env } from '@/config/env';
import { secureStorage } from '@/services/storage/secure-storage';

type Handler = (payload: unknown) => void;

// Rechazos seguidos del middleware antes de rendirse: si el token recien
// refrescado tambien se rechaza, la sesion no se va a arreglar reintentando.
const MAX_AUTH_RETRIES = 5;

/**
 * Thin wrapper over socket.io-client. The websocket delivers live updates
 * (location, order status, notifications); it is NOT the source of truth for
 * the GPS history — that is persisted over HTTP. Reconnection is automatic.
 */
class SocketService {
  private socket: Socket | null = null;
  private token = '';
  /** Rooms order:{id} pedidas; el servidor las pierde en cada reconexion. */
  private readonly joined = new Set<string>();
  private authRetries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  connect(accessToken: string): void {
    this.token = accessToken;
    // Siempre la MISMA instancia: los listeners de App.tsx viven en ella.
    if (this.socket) {
      if (!this.socket.active) {
        this.clearRetry();
        this.socket.connect();
      }
      return;
    }
    const socket = io(env.socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Funcion y no objeto: se evalua en cada reconexion y manda el token
      // vigente. Con el objeto fijo, pasados 15 min el middleware lo rechaza.
      auth: (cb) => {
        void secureStorage
          .getAccessToken()
          .catch(() => null)
          .then((token) => cb({ token: token ?? this.token }));
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    this.socket = socket;

    // 'connect' salta tambien en cada reconexion.
    socket.on('connect', () => {
      this.authRetries = 0;
      this.joined.forEach((orderId) =>
        socket.emit('tracking:join-order', { orderId }),
      );
    });
    socket.on('connect_error', (error) => {
      console.warn('[socket] connect_error', error.message);
      // Con `active` el Manager ya reintenta solo (corte de red). Sin el, el
      // middleware rechazo el handshake y socket.io no vuelve a intentarlo.
      if (socket.active || this.socket !== socket) {
        return;
      }
      if (this.authRetries >= MAX_AUTH_RETRIES) {
        console.warn('[socket] handshake rechazado, sin mas reintentos');
        return;
      }
      const attempt = this.authRetries++;
      void apiClient
        .refreshAccessToken()
        .catch(() => null)
        .then((token) => {
          if (this.socket !== socket) {
            return;
          }
          // Sin token (sin red, 5xx o 429) se reintenta igual: rendirse dejaba
          // el socket muerto hasta el proximo login. Un refresh rechazado ya
          // cierra la sesion, y disconnect() cancela este reintento.
          if (token) {
            this.token = token;
          }
          this.clearRetry();
          const delay = (1000 + Math.random() * 2000) * 2 ** attempt;
          this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (this.socket === socket && !socket.active) {
              socket.connect();
            }
          }, delay);
        });
    });
    socket.on('tracking:error', (payload: unknown) => {
      console.warn('[socket] tracking:error', payload);
    });
  }

  joinOrder(orderId: string): void {
    this.joined.add(orderId);
    // Desconectado no se emite: lo hace el handler de 'connect', y asi no
    // sale duplicado desde el buffer de socket.io.
    if (this.socket?.connected) {
      this.socket.emit('tracking:join-order', { orderId });
    }
  }

  leaveOrder(orderId: string): void {
    this.joined.delete(orderId);
    if (this.socket?.connected) {
      this.socket.emit('tracking:leave-order', { orderId });
    }
  }

  emit(event: string, payload: unknown): void {
    this.socket?.emit(event, payload);
  }

  emitWithAck(event: string, payload: unknown, ack: (res: unknown) => void): void {
    this.socket?.emit(event, payload, ack);
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
    this.clearRetry();
    this.authRetries = 0;
    this.joined.clear();
    this.socket?.disconnect();
    this.socket = null;
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}

export const socketService = new SocketService();
