import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/config/env';
import type { ApiResponse, AuthTokens } from '@/types/api';
import { secureStorage } from '@/services/storage/secure-storage';
import { useConnectivity } from '@/store/connectivity.store';

/**
 * Central HTTP client. Attaches the bearer token, unwraps the `{success,data}`
 * envelope, and transparently refreshes the access token once on 401 (queuing
 * concurrent requests during the refresh). On refresh failure it triggers the
 * registered logout handler.
 */
class ApiClient {
  readonly instance: AxiosInstance;
  private accessToken: string | null = null;
  private refreshing: Promise<string | null> | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: env.apiUrl,
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.instance.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.set('Authorization', `Bearer ${this.accessToken}`);
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

  setUnauthorizedHandler(handler: () => void): void {
    this.onUnauthorized = handler;
  }

  private async handleError(error: AxiosError): Promise<unknown> {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retried) {
      original._retried = true;
      const token = await this.refreshAccessToken();
      if (token) {
        original.headers.set('Authorization', `Bearer ${token}`);
        return this.instance.request(original);
      }
      this.onUnauthorized?.();
    }

    return Promise.reject(error);
  }

  private refreshAccessToken(): Promise<string | null> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<string | null> {
    const refreshToken = await secureStorage.getRefreshToken();
    if (!refreshToken) {
      return null;
    }
    try {
      // Bare axios call to avoid the interceptor recursion.
      const res = await axios.post<ApiResponse<AuthTokens>>(
        `${env.apiUrl}/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' }, timeout: 20000 },
      );
      if (!res.data.success) {
        return null;
      }
      const tokens = res.data.data;
      this.accessToken = tokens.accessToken;
      await secureStorage.setTokens(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      return null;
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
