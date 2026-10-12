import type { Assignment, OrderStop, TransportOrder } from '@/types/api';

export type OrderBucket = 'assigned' | 'inRoute' | 'delivered';

export const bucketLabels: Record<OrderBucket, string> = {
  assigned: 'Asignadas',
  inRoute: 'En ruta',
  delivered: 'Entregadas',
};

export function sortedStops(order?: TransportOrder | null): OrderStop[] {
  return [...(order?.orderStops ?? [])].sort((a, b) => a.sequence - b.sequence);
}

export function pickupStop(order?: TransportOrder | null): OrderStop | undefined {
  const stops = sortedStops(order);
  return stops.find((s) => s.stopType === 'PICKUP') ?? stops[0];
}

export function dropoffStop(order?: TransportOrder | null): OrderStop | undefined {
  const stops = sortedStops(order);
  return [...stops].reverse().find((s) => s.stopType === 'DROPOFF') ?? stops[stops.length - 1];
}

/**
 * En que pestaña va una asignacion. El estado de la ORDEN manda: el staff
 * puede marcar una asignacion COMPLETED sin que la orden este entregada.
 * Rechazadas, canceladas y fallidas no aparecen.
 */
export function bucketOf(a: Assignment): OrderBucket | null {
  const status = a.order?.status;
  if (status === 'DELIVERED') return 'delivered';
  if (a.assignmentStatus === 'REJECTED' || a.assignmentStatus === 'CANCELLED') return null;
  if (status === 'CANCELLED' || status === 'FAILED') return null;
  if (status === 'IN_PROGRESS' && a.assignmentStatus === 'ACCEPTED') return 'inRoute';
  if (a.assignmentStatus === 'PENDING') return 'assigned';
  if (a.assignmentStatus === 'ACCEPTED' && (status === 'ASSIGNED' || status === 'ACCEPTED')) {
    return 'assigned';
  }
  return null;
}

/** Una fila por orden: la asignacion mas reciente gana (la API las repite). */
export function latestPerOrder(assignments: Assignment[]): Assignment[] {
  const byOrder = new Map<string, Assignment>();
  for (const a of assignments) {
    const prev = byOrder.get(a.orderId);
    if (!prev || new Date(a.assignedAt).getTime() > new Date(prev.assignedAt).getTime()) {
      byOrder.set(a.orderId, a);
    }
  }
  return [...byOrder.values()];
}

export function groupAssignments(assignments: Assignment[]): Record<OrderBucket, Assignment[]> {
  const groups: Record<OrderBucket, Assignment[]> = { assigned: [], inRoute: [], delivered: [] };
  for (const a of latestPerOrder(assignments)) {
    const bucket = bucketOf(a);
    if (bucket) groups[bucket].push(a);
  }
  const time = (v?: string | null) => (v ? new Date(v).getTime() : 0);
  groups.assigned.sort(
    (x, y) =>
      // Primero las que hay que aceptar, luego por fecha programada.
      Number(y.assignmentStatus === 'PENDING') - Number(x.assignmentStatus === 'PENDING') ||
      time(x.order?.scheduleAt ?? x.assignedAt) - time(y.order?.scheduleAt ?? y.assignedAt),
  );
  groups.delivered.sort((x, y) => time(y.order?.deliveredAt) - time(x.order?.deliveredAt));
  return groups;
}

// ── Fases del servicio activo ───────────────────────────────────────────────

export type TripPhase = 'TO_PICKUP' | 'AT_PICKUP' | 'TO_DROPOFF' | 'AT_DROPOFF';

/** Marcas que la app guarda por si la API aun no registra las paradas. */
export interface TripMarks {
  arrivedPickupAt?: string | null;
  pickedUpAt?: string | null;
  arrivedDropoffAt?: string | null;
}

export function tripPhase(order: TransportOrder | null, marks: TripMarks): TripPhase {
  const pickup = pickupStop(order);
  const dropoff = dropoffStop(order);
  const pickedUp = Boolean(pickup?.completedAt || marks.pickedUpAt);
  if (!pickedUp) {
    return pickup?.arrivedAt || marks.arrivedPickupAt ? 'AT_PICKUP' : 'TO_PICKUP';
  }
  return dropoff?.arrivedAt || marks.arrivedDropoffAt ? 'AT_DROPOFF' : 'TO_DROPOFF';
}

export function targetStopFor(order: TransportOrder | null, phase: TripPhase): OrderStop | undefined {
  return phase === 'TO_PICKUP' || phase === 'AT_PICKUP' ? pickupStop(order) : dropoffStop(order);
}

export const phaseCopy: Record<TripPhase, { title: string; short: string }> = {
  TO_PICKUP: { title: 'Dirígete a la recogida', short: 'Hacia la recogida' },
  AT_PICKUP: { title: 'Recoge la carga', short: 'En la recogida' },
  TO_DROPOFF: { title: 'Dirígete a la entrega', short: 'Hacia la entrega' },
  AT_DROPOFF: { title: 'Registra la entrega', short: 'En la entrega' },
};

export function stopAddress(stop?: OrderStop | null): string {
  if (!stop) return 'Dirección no disponible';
  return [stop.addressLine, stop.city].filter(Boolean).join(', ');
}
