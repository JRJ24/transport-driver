import axios from 'axios';
import { ApiRequestError, toErrorMessage } from '@/api/client';
import type { ApiResponse } from '@/types/api';

/** Codigo de la API cuando el conductor ya tiene otro servicio en curso. */
export const ACTIVE_TRIP_CODE = 'ACTIVE_TRIP_EXISTS';

export interface ApiFailure {
  status?: number;
  code?: string;
  message: string;
  details?: unknown;
}

export function readApiFailure(error: unknown): ApiFailure {
  if (error instanceof ApiRequestError) {
    return { code: error.code, message: error.message };
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    const body = data && 'success' in data && !data.success ? data.error : undefined;
    return {
      status: error.response?.status,
      code: body?.code,
      message: body?.message ?? error.message,
      details: body?.details,
    };
  }
  return { message: toErrorMessage(error) };
}

export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

/** Mensajes de la API (en ingles) que el conductor puede encontrarse. */
const MESSAGE_MAP: Array<[RegExp, string]> = [
  [/already has an active trip/i, 'Ya tienes un servicio en curso. Termínalo antes de iniciar otro.'],
  [/not assigned to this order/i, 'Esta orden ya no está asignada a ti.'],
  [/delivery evidence is required/i, 'Falta registrar la evidencia de entrega.'],
  [/photo and recipient signature/i, 'Faltan la foto de entrega y la firma del receptor.'],
  [/invalid status transition|cannot transition/i, 'La orden cambió de estado. Actualiza e intenta de nuevo.'],
  [/current password/i, 'La contraseña actual no es correcta.'],
  [/phone/i, 'Ese teléfono ya está en uso o no es válido.'],
  [/email/i, 'Ese correo ya está en uso o no es válido.'],
];

const CODE_MAP: Record<string, string> = {
  [ACTIVE_TRIP_CODE]: 'Ya tienes un servicio en curso. Termínalo antes de iniciar otro.',
  AUTH_INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  AUTH_ACCOUNT_BLOCKED: 'Tu cuenta está bloqueada. Contacta a operaciones.',
  AUTH_ACCOUNT_INACTIVE: 'Tu cuenta está inactiva. Contacta a operaciones.',
  RATE_LIMITED: 'Demasiados intentos. Espera un momento y vuelve a intentar.',
  RESOURCE_NOT_FOUND: 'No encontramos lo que buscabas. Actualiza la lista.',
  FORBIDDEN: 'No tienes permiso para esta acción.',
  UPSTREAM_TIMEOUT: 'El servicio de mapas tardó demasiado. Intenta de nuevo.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible ahora mismo.',
};

/** Mensaje claro en espanol para cualquier error de la API o de red. */
export function friendlyError(error: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  if (isNetworkError(error)) {
    return 'Sin conexión. Revisa tu señal e intenta de nuevo.';
  }
  const failure = readApiFailure(error);
  if (failure.code && CODE_MAP[failure.code]) {
    return CODE_MAP[failure.code];
  }
  for (const [pattern, text] of MESSAGE_MAP) {
    if (pattern.test(failure.message)) return text;
  }
  if (failure.status === 409) return 'Hubo un conflicto con el estado actual. Actualiza e intenta de nuevo.';
  if (failure.status && failure.status >= 500) return 'El servidor tuvo un problema. Intenta en unos segundos.';
  if (failure.status === 403) return 'No tienes permiso para esta acción.';
  // Mensajes ya en espanol (validaciones locales) pasan tal cual.
  if (/[áéíóúñ¿¡]/i.test(failure.message)) return failure.message;
  return fallback;
}

export function isActiveTripConflict(error: unknown): boolean {
  const f = readApiFailure(error);
  return f.code === ACTIVE_TRIP_CODE || /already has an active trip/i.test(f.message);
}
