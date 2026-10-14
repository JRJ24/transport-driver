import { Platform, type ViewStyle } from 'react-native';

/**
 * RUTA RD Driver design tokens.
 *
 * Dos paletas con las MISMAS claves: claro y calido (por defecto) y oscuro
 * calido. Las pantallas nunca importan una paleta directamente: la piden con
 * `useTheme()` / `makeStyles()` (theme/ThemeProvider.tsx), asi el tema se
 * cambia en vivo desde Perfil. El texto sobre cada fondo `*Soft` pasa WCAG AA.
 */
const light = {
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
  shadow: '#3D2F1F',
  white: '#FFFFFF',
  /** Tinta de la firma: siempre oscura sobre el recuadro blanco. */
  ink: '#0F172A',
  /** Texto sobre el banner azul de servicio activo. */
  onPrimaryMuted: '#DBE6FD',
};

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  bg: '#14120F',
  surface: '#1E1B17',
  surfaceAlt: '#26221D',
  surfaceMuted: '#2E2A24',
  border: '#332E28',
  borderStrong: '#4A433A',

  primary: '#3B76F6',
  primaryPressed: '#2F63D6',
  primarySoft: '#1B2944',
  primaryText: '#9CBBFF',
  onPrimary: '#FFFFFF',

  success: '#1F9A52',
  successSoft: '#13301F',
  successText: '#86E0A8',
  danger: '#E5484D',
  dangerSoft: '#3A1A1B',
  dangerText: '#FF9C99',
  warning: '#E59A2E',
  warningSoft: '#3A2911',
  warningText: '#FFCB7A',
  info: '#1FA3C2',
  infoSoft: '#0F2F38',
  infoText: '#85D8EC',
  neutralSoft: '#2E2A24',
  neutralText: '#CBC4BA',

  pickup: '#E59A2E',
  delivery: '#1F9A52',

  text: '#F5F2EE',
  textMuted: '#C4BDB3',
  textDim: '#9C958B',
  placeholder: '#7B746B',

  online: '#22C55E',
  offline: '#7B746B',
  overlay: 'rgba(0, 0, 0, 0.62)',
  shadow: '#000000',
  white: '#FFFFFF',
  ink: '#0F172A',
  onPrimaryMuted: '#DBE6FD',
};

export const palettes = { light: light as Palette, dark };

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

export const motion = {
  fast: 160,
  base: 240,
  slow: 380,
} as const;

/** Android no tiene 800/900 en Roboto: el tope legible es 700. */
function makeTypography(c: Palette) {
  return {
    display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4, color: c.text },
    title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2, color: c.text },
    heading: { fontSize: 18, fontWeight: '700', color: c.text },
    body: { fontSize: 15, fontWeight: '400', color: c.text, lineHeight: 21 },
    bodyStrong: { fontSize: 15, fontWeight: '600', color: c.text, lineHeight: 21 },
    caption: { fontSize: 13, fontWeight: '400', color: c.textMuted, lineHeight: 18 },
    small: { fontSize: 12, fontWeight: '500', color: c.textDim },
    overline: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.textDim,
    },
  } as const;
}

function makeElevation(c: Palette, isDark: boolean) {
  const shadow = (level: 1 | 2 | 3): ViewStyle => {
    const ios = {
      1: { shadowOpacity: isDark ? 0.35 : 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      2: { shadowOpacity: isDark ? 0.45 : 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      3: { shadowOpacity: isDark ? 0.55 : 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
    }[level];
    return Platform.select<ViewStyle>({
      ios: { shadowColor: c.shadow, ...ios },
      default: { elevation: level * 2, shadowColor: c.shadow },
    });
  };
  return { card: shadow(1), raised: shadow(2), floating: shadow(3) } as const;
}

function build(isDark: boolean) {
  const colors = isDark ? palettes.dark : palettes.light;
  return {
    isDark,
    colors,
    typography: makeTypography(colors),
    elevation: makeElevation(colors, isDark),
    spacing,
    radius,
    motion,
  };
}

export type Theme = ReturnType<typeof build>;
export type Typography = Theme['typography'];

export const lightTheme: Theme = build(false);
export const darkTheme: Theme = build(true);
