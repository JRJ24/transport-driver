/** Formateadores es-DO compartidos (fechas, dinero, distancia, tiempo). */
const LOCALE = 'es-DO';

const moneyFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'DOP',
  maximumFractionDigits: 2,
});

export function formatMoney(value?: number | string | null): string {
  const amount = Number(value);
  return value != null && Number.isFinite(amount) ? moneyFmt.format(amount) : '—';
}

export function formatKm(value?: number | string | null): string {
  const km = Number(value);
  if (value == null || !Number.isFinite(km) || km <= 0) return '-- km';
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatMeters(meters?: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return '-- km';
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return formatKm(meters / 1000);
}

export function formatMinutes(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return '-- min';
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatTime(value?: string | number | Date | null): string {
  if (value == null) return '--';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '--'
    : d.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(value?: string | number | Date | null): string {
  if (value == null) return '--';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '--'
    : d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** «Hoy, 3:40 p. m.», «Ayer, …» o la fecha corta. */
export function formatRelativeDay(value?: string | null): string {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return `Hoy, ${formatTime(d)}`;
  if (same(d, yesterday)) return `Ayer, ${formatTime(d)}`;
  return `${d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })}, ${formatTime(d)}`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function firstName(fullName?: string | null): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

export function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join('') || 'RD').toUpperCase();
}
