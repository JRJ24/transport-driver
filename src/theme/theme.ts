import { Platform, type ViewStyle } from 'react-native';

/**
 * RUTA RD Driver design tokens: light, warm theme.
 *
 * Warm off-white background, white cards with soft shadows, RUTA RD blue as
 * the single accent, and statuses in readable tints: the text on each
 * `*Soft` background passes WCAG AA (>= 4.5:1).
 */
export const colors = {
  bg: '#F7F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EEE9',
  surfaceMuted: '#E9E5DF',
  border: '#E6E1DA',
  borderStrong: '#D3CCC2',

  primary: '#2563EB',
  primaryPressed: '#1D4ED8',
  primarySoft: '#E6EEFE',
  primaryText: '#1D4ED8',
  onPrimary: '#FFFFFF',

  success: '#15803D',
  successSoft: '#E3F5E9',
  successText: '#166534',
  danger: '#DC2626',
  dangerSoft: '#FDE8E8',
  dangerText: '#B91C1C',
  warning: '#D97706',
  warningSoft: '#FEF1DC',
  warningText: '#92400E',
  info: '#0E7490',
  infoSoft: '#E0F4F8',
  infoText: '#155E75',
  neutralSoft: '#EEEAE4',
  neutralText: '#57534E',

  /** Recogida: ambar. Entrega: verde. Igual en mapa, timeline y badges. */
  pickup: '#D97706',
  delivery: '#15803D',

  text: '#1C1917',
  textMuted: '#57534E',
  textDim: '#78716C',
  placeholder: '#A8A29E',

  online: '#16A34A',
  offline: '#A8A29E',
  overlay: 'rgba(28, 25, 23, 0.45)',
  white: '#FFFFFF',
  ink: '#0F172A',

  // Compatibilidad con estilos antiguos.
  primaryBright: '#2563EB',
  successBright: '#16A34A',
  dangerBright: '#DC2626',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** Android no tiene 800/900 en Roboto: el tope legible es 700. */
export const typography = {
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400', color: colors.textMuted, lineHeight: 18 },
  small: { fontSize: 12, fontWeight: '500', color: colors.textDim },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
} as const;

function shadow(level: 1 | 2 | 3): ViewStyle {
  const ios = {
    1: { shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    2: { shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    3: { shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  }[level];
  return Platform.select<ViewStyle>({
    ios: { shadowColor: '#3D2F1F', ...ios },
    default: { elevation: level * 2, shadowColor: '#3D2F1F' },
  });
}

export const elevation = {
  card: shadow(1),
  raised: shadow(2),
  floating: shadow(3),
} as const;

export const motion = {
  fast: 160,
  base: 240,
  slow: 380,
} as const;

export const theme = { colors, spacing, radius, typography, elevation, motion };
export type Theme = typeof theme;
