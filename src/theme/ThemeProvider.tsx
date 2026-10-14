import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { appStorage } from '@/services/storage/app-storage';
import { darkTheme, lightTheme, type Theme } from './theme';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'transport-driver.themeMode';

interface ThemeModeState {
  mode: ThemeMode;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

/** Preferencia del conductor; se guarda en el telefono. */
export const useThemeMode = create<ThemeModeState>((set) => ({
  mode: 'system',
  hydrated: false,
  setMode(mode) {
    set({ mode });
    void appStorage.set(KEY, mode).catch(() => undefined);
  },
  async hydrate() {
    const stored = await appStorage.get<ThemeMode>(KEY).catch(() => null);
    set({
      mode: stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system',
      hydrated: true,
    });
  },
}));

export const themeModeLabels: Record<ThemeMode, string> = {
  system: 'Automático',
  light: 'Claro',
  dark: 'Oscuro',
};

/** El tema activo: la eleccion del conductor o, en «Automatico», la del telefono. */
export function useTheme(): Theme {
  const mode = useThemeMode((s) => s.mode);
  const system = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return isDark ? darkTheme : lightTheme;
}

/**
 * Estilos que dependen del tema. Se calculan una vez por tema (cache), asi
 * cambiar de claro a oscuro solo cuesta un render.
 *
 *   const useStyles = makeStyles(({ colors }) => StyleSheet.create({ ... }));
 *   const styles = useStyles();
 */
export function makeStyles<T>(factory: (theme: Theme) => T): () => T {
  const cache = new Map<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = factory(theme);
      cache.set(theme, styles);
    }
    return styles;
  };
}
