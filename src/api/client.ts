import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/config/env';
import type { ApiResponse, AuthTokens } from '@/types/api';
import { secureStorage } from '@/services/storage/secure-storage';
import { useConnectivity } from '@/store/connectivity.store';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Un 401 se devuelve tal cual: sin refresh ni handler de logout. */
    skipAuthRefresh?: boolean;
  }
}

// Un 401 de estas rutas es la respuesta en si (credenciales, refresh o
// logout invalidos), no un access token vencido.
const AUTH_ENDPOINT = /\/auth\/(login|register|refresh|logout)(\?|$)/;

type RefreshResult =
  | { kind: 'ok'; token: string }
  | { kind: 'rejected' }
  | { kind: 'network'; error: unknown }
  | { kind: 'stale' };

/**
 * Central HTTP client. Attaches the bearer token, unwraps the `{success,data}`
 * envelope, and transparently refreshes the access token once on 401 (queuing
 * concurrent requests during the refresh). Only a refresh rejected by the
 * server triggers the registered logout handler.
 */
class ApiClient {
  readonly instance: AxiosInstance;
  private accessToken: string | null = null;
  // Sube en cada login y logout: un refresh que empezo antes es de la sesion
  // anterior, y guardar sus tokens resucitaria la sesion cerrada.
  private generation = 0;
  private refreshing: Promise<RefreshResult> | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: env.apiUrl,
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.instance.interceptors.request.use(async (config) => {
      // Un Authorization explicito (logout con el token de la sesion que se
      // cierra) no se pisa con el global.
      if (config.headers.has('Authorization')) {
        return config;
      }
      // El task de background puede correr en un contexto JS donde no corrio
      // bootstrap: sin leer el token guardado la peticion saldria sin
      // Authorization y su 401 ya no se refrescaria. Tras un logout no: el
      // storage puede tener aun el token que se esta borrando.
      const token =
        this.accessToken ??
        (this.generation === 0
          ? await secureStorage.getAccessToken().catch(() => null)
          : null);
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
      return config;
    });

    // Toda respuesta del servidor prueba que hay red; un error sin `response`
    // es un fallo de transporte. Antes el indicador dependia de `flush()`, que
    // no llama a nadie cuando la cola esta vacia: tras un unico fallo se
    // quedaba en «Sin conexion» para siempre.
    this.instance.interceptors.response.use(
      (response) => {
        useConnectivity.getState().markSynced();
        return response;
      },
      (error: AxiosError) => {
        if (!error.response) {
          useConnectivity.getState().setOnline(false);
        } else {
          useConnectivity.getState().markSynced();
        }
        return this.handleError(error);
      },
    );
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /** Login (token nuevo) o logout (null): descarta el refresh en curso. */
  resetSession(token: string | null): void {
    this.accessToken = token;
    this.generation++;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setUnauthorizedHandler(handler: () => void): void {
    this.onUnauthorized = handler;
  }

  /**
   * Rota la sesion y devuelve el access token nuevo, o null si no se pudo.
   * Comparte el refresh en curso y nunca lanza.
   */
  async refreshAccessToken(): Promise<string | null> {
    const result = await this.refresh();
    return result.kind === 'ok' ? result.token : null;
  }

  private async handleError(error: AxiosError): Promise<unknown> {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const status = error.response?.status;

    if (
      status !== 401 ||
      !original ||
      original._retried ||
      original.skipAuthRefresh ||
      AUTH_ENDPOINT.test(original.url ?? '') ||
      !original.headers.has('Authorization')
    ) {
      return Promise.reject(error);
    }

    // Salio con un token que otro 401 ya roto: basta reenviarla, y asi no se
    // gasta un refresh (limitado por el servidor) en cada peticion rezagada.
    const current = this.accessToken ? `Bearer ${this.accessToken}` : null;
    if (current && original.headers.get('Authorization') !== current) {
      original.headers.set('Authorization', current);
      return this.instance.request(original);
    }

    original._retried = true;
    const result = await this.refresh();
    if (result.kind === 'ok') {
      original.headers.set('Authorization', `Bearer ${result.token}`);
      return this.instance.request(original);
    }
    // Sin red el error es el del refresh y no el 401: quien llama debe ver un
    // fallo transitorio y no una sesion invalida.
    return Promise.reject(result.kind === 'network' ? result.error : error);
  }

  private refresh(): Promise<RefreshResult> {
    this.refreshing ??= this.doRefresh()
      .then((result) => {
        if (result.kind === 'rejected') {
          this.onUnauthorized?.();
        }
        return result;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  private async doRefresh(): Promise<RefreshResult> {
    const generation = this.generation;
    // Sesion cerrada en este contexto: no hay nada que refrescar.
    if (generation > 0 && !this.accessToken) {
      return { kind: 'stale' };
    }
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      // Leido durante un login: rotarlo invalidaria el token recien guardado.
      if (generation !== this.generation) {
        return { kind: 'stale' };
      }
      if (!refreshToken) {
        return { kind: 'rejected' };
      }
      // Bare axios call to avoid the interceptor recursion.
      const res = await axios.post<ApiResponse<AuthTokens>>(
        `${env.apiUrl}/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' }, timeout: 20000 },
      );
      if (generation !== this.generation) {
        return { kind: 'stale' };
      }
      if (!res.data.success) {
        return { kind: 'rejected' };
      }
      const tokens = res.data.data;
      this.accessToken = tokens.accessToken;
      await secureStorage.setTokens(tokens.accessToken, tokens.refreshToken);
      return { kind: 'ok', token: tokens.accessToken };
    } catch (error) {
      // El 401 de la sesion anterior no debe cerrar la que vino despues.
      if (generation !== this.generation) {
        return { kind: 'stale' };
      }
      // Solo el servidor puede invalidar la sesion. Sin red, timeout, 5xx o
      // 429 se conservan los tokens: cerrar sesion en una zona sin senal
      // dejaria al conductor fuera en plena ruta. /auth/refresh es publica y
      // la API nunca responde 403 ahi: uno de un proxy no cierra la sesion.
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 400 || status === 401) {
          return { kind: 'rejected' };
        }
        if (!error.response) {
          useConnectivity.getState().setOnline(false);
        }
      }
      return { kind: 'network', error };
    }
  }
}

export const apiClient = new ApiClient();
export const http = apiClient.instance;

/** Unwraps a `{success,data}` envelope, throwing the API error message. */
export function unwrap<T>(payload: ApiResponse<T>): T {
  if (payload.success) {
    return payload.data;
  }
  throw new ApiRequestError(payload.error.message, payload.error.code);
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Extracts a human message from any thrown API error. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | ApiResponse<unknown>
      | { message?: string }
      | undefined;
    if (data && 'success' in data && !data.success) {
      return data.error.message;
    }
    if (data && 'message' in data && data.message) return data.message;
    return error.message;
  }
  return error instanceof Error ? error.message : 'Error inesperado';
}
