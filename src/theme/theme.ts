/**
 * RUTA RD Driver design tokens. Dark theme taken from the reference design
 * (rutaMobile.pdf): deep-navy surfaces, blue primary CTAs, green success,
 * red for incidents, amber for pickup/caution.
 */
export const colors = {
  bg: '#0B1220',
  surface: '#111A2E',
  surfaceAlt: '#0E1729',
  surfaceMuted: '#16223A',
  border: '#1E293B',
  borderStrong: '#294066',

  primary: '#2563EB',
  primaryBright: '#3B82F6',
  onPrimary: '#FFFFFF',

  success: '#16A34A',
  successBright: '#22C55E',
  danger: '#DC2626',
  dangerBright: '#EF4444',
  warning: '#F59E0B',

  pickup: '#F59E0B',
  delivery: '#16A34A',

  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textDim: '#64748B',

  // Status accents
  online: '#22C55E',
  offline: '#64748B',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  body: { fontSize: 14, fontWeight: '500' },
  muted: { fontSize: 12, fontWeight: '500' },
} as const;

export const theme = { colors, spacing, radius, typography };
export type Theme = typeof theme;
