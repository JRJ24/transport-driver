import type {
  AssignmentStatus,
  DriverStatus,
  IncidentStatus,
  OrderStatus,
  StopType,
  ValidationStatus,
} from '@/types/api';

/**
 * Etiquetas en espanol de los enums de la API.
 *
 * Portadas de `app-drivers/src/constants/status.constants.ts` para que la web
 * y el movil digan lo mismo: antes el movil pintaba `ACCEPTED` o `PENDING` en
 * crudo dentro de los `Pill`.
 */

export const driverStatusLabels: Record<DriverStatus, string> = {
  AVAILABLE: 'Disponible',
  BUSY: 'En servicio',
  OFFLINE: 'Fuera de linea',
  SUSPENDED: 'Suspendido',
  VACATION: 'Vacaciones',
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_QUOTE: 'Cotizando',
  PENDING_CUSTOMER_CONFIRMATION: 'Pendiente del cliente',
  PENDING_PAYMENT: 'Pago pendiente',
  CONFIRMED: 'Confirmada',
  ASSIGNING_DRIVER: 'Asignando conductor',
  REQUESTED: 'Solicitada',
  ASSIGNED: 'Asignada',
  ACCEPTED: 'Aceptada',
  IN_PROGRESS: 'En ruta',
  DELIVERED: 'Entregada',
  CANCELLED: 'Cancelada',
  FAILED: 'Fallida',
};

export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  PENDING: 'Por aceptar',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
};

export const stopTypeLabels: Record<StopType, string> = {
  PICKUP: 'Recogida',
  DROPOFF: 'Entrega',
  INTERMEDIATE: 'Parada',
};

export const validationStatusLabels: Record<ValidationStatus, string> = {
  PENDING: 'Pendiente',
  VALIDATED: 'Validada',
  REJECTED: 'Rechazada',
};

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  OPEN: 'Abierta',
  IN_REVIEW: 'En revision',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
};
