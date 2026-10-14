import axios from 'axios';
import { create } from 'zustand';
import { authApi } from '@/api/auth.api';
import { driversApi } from '@/api/drivers.api';
import { usersApi } from '@/api/users.api';
import { apiClient, toErrorMessage } from '@/api/client';
import type { ApiError, AuthUser, DriverProfile, UserProfile } from '@/types/api';
import { secureStorage } from '@/services/storage/secure-storage';
import { appStorage } from '@/services/storage/app-storage';
import { pushNotifications } from '@/services/notifications/push-notifications.service';
import { useConnectivity } from '@/store/connectivity.store';

type AuthStatus =
  | 'idle'
  | 'authenticating'
  | 'authenticated'
  | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  driver: DriverProfile | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setDriver: (driver: DriverProfile | null) => void;
  /** Datos editables (telefono, foto) desde GET /users/me. */
  refreshProfile: () => Promise<void>;
  applyProfile: (profile: Partial<UserProfile>) => void;
}

interface CachedProfile {
  user: AuthUser;
  driver: DriverProfile | null;
}

const NOT_DRIVER = 'Esta cuenta no es de conductor';
const OFFLINE =
  'Sin conexion con el servidor. Revisa tu red e intenta de nuevo.';
// Perfil de la ultima sesion validada: sin red, bootstrap entra con el.
const PROFILE_KEY = 'transport-driver.authProfile';
const ACCOUNT_CLOSED = ['AUTH_ACCOUNT_BLOCKED', 'AUTH_ACCOUNT_INACTIVE'];

// Un solo cierre de sesion a la vez: el handler de 401, bootstrap y el boton
// pueden coincidir, y un login nuevo espera a que termine la revocacion.
let loggingOut: Promise<void> | null = null;
// Cambia en cada login y logout: una respuesta tardia de bootstrap no debe
// pisar la sesion que vino despues.
let sessionEpoch = 0;
// bootstrap no pudo validar la sesion por falta de red.
let revalidatePending = false;

/** Solo el servidor invalida la sesion: 401 o cuenta bloqueada/inactiva. */
function isSessionInvalid(error: unknown): boolean {
  if (!axios.isAxiosError(error) || !error.response) {
    return false;
  }
  const { status, data } = error.response;
  const code = (data as Partial<ApiError> | undefined)?.error?.code;
  return (
    status === 401 ||
    (status === 403 && code !== undefined && ACCOUNT_CLOSED.includes(code))
  );
}

function cacheProfile(user: AuthUser, driver: DriverProfile | null): void {
  void appStorage
    .set<CachedProfile>(PROFILE_KEY, { user, driver })
    .catch(() => undefined);
}

function endSession(error: string | null): Promise<void> {
  if (loggingOut) {
    return loggingOut;
  }
  sessionEpoch++;
  revalidatePending = false;
  const token = apiClient.getAccessToken();
  // Sincrono: un refresh en curso ya no guarda sus tokens despues del clear.
  apiClient.resetSession(null);
  loggingOut = (async () => {
    // Primero lo local: antes, el logout esperaba a la red con el token aun
    // vigente y cada 401 de por medio volvia a entrar aqui.
    await secureStorage.clear().catch(() => undefined);
    await appStorage.remove(PROFILE_KEY).catch(() => undefined);
    useAuth.setState({
      status: 'unauthenticated',
      user: null,
      driver: null,
      error,
    });
    if (token) {
      // Con el token capturado: un login posterior nunca es el revocado.
      await pushNotifications.unregister(token).catch(() => undefined);
      await authApi.logout(token);
    }
  })().finally(() => {
    loggingOut = null;
  });
  return loggingOut;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  driver: null,
  error: null,

  async bootstrap() {
    // Route 401s from anywhere back to the login screen. Solo una sesion
    // activa puede expirar: un 401 tardio tras el logout no repite el logout.
    apiClient.setUnauthorizedHandler(() => {
      if (get().status === 'authenticated') {
        void get().logout();
      }
    });

    const epoch = sessionEpoch;
    const token = await secureStorage.getAccessToken();
    if (epoch !== sessionEpoch) {
      return;
    }
    if (!token) {
      set({ status: 'unauthenticated' });
      return;
    }
    apiClient.setAccessToken(token);
    try {
      const me = await authApi.me();
      if (epoch !== sessionEpoch) {
        return;
      }
      if (!me.roles.includes('DRIVER')) {
        await endSession(NOT_DRIVER);
        return;
      }
      // Al revalidar, un fallo puntual no borra el perfil ya conocido: con
      // driver null se cacheaba vacio y la presencia hacia `leave`.
      const known = get().user?.id === me.id ? get().driver : null;
      const driver = await driversApi.me().catch(() => known);
      if (epoch !== sessionEpoch) {
        return;
      }
      const user: AuthUser = {
        id: me.id,
        email: me.email,
        fullName: me.fullName,
        phone: '',
        status: me.status,
        roles: me.roles,
      };
      set({ status: 'authenticated', user, driver, error: null });
      cacheProfile(user, driver);
      void pushNotifications.register().catch(() => undefined);
      void get().refreshProfile();
    } catch (error) {
      if (epoch !== sessionEpoch) {
        return;
      }
      if (isSessionInvalid(error)) {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        await endSession(status === 403 ? toErrorMessage(error) : null);
        return;
      }
      // Sin red, timeout, 5xx o 429 el servidor no dijo que la sesion fuera
      // invalida: se conservan los tokens (el refresh dura 30 dias) y se entra
      // con el ultimo perfil validado, para que ruta y tracking sigan offline.
      revalidatePending = true;
      if (get().status === 'authenticated') {
        return;
      }
      const cached = await appStorage
        .get<CachedProfile>(PROFILE_KEY)
        .catch(() => null);
      if (epoch !== sessionEpoch) {
        return;
      }
      set(
        cached
          ? {
              status: 'authenticated',
              user: cached.user,
              driver: cached.driver,
              error: null,
            }
          : { status: 'idle', error: OFFLINE },
      );
    }
  },

  async login(email, password) {
    set({ status: 'authenticating', error: null });
    revalidatePending = false;
    // El logout en curso todavia borra el token push: registrar despues.
    await loggingOut;
    try {
      const result = await authApi.login(email.trim(), password);
      if (!result.user.roles.includes('DRIVER')) {
        // El servidor no exige el rol: se revoca la sesion movil recien
        // emitida en vez de guardarla.
        void authApi.logout(result.accessToken);
        set({ status: 'unauthenticated', error: NOT_DRIVER });
        return false;
      }
      sessionEpoch++;
      // Antes de guardar: un refresh de la sesion anterior no debe rotar ni
      // pisar los tokens nuevos.
      apiClient.resetSession(result.accessToken);
      await secureStorage.setTokens(result.accessToken, result.refreshToken);
      const driver = await driversApi.me().catch(() => null);
      set({ status: 'authenticated', user: result.user, driver });
      cacheProfile(result.user, driver);
      void pushNotifications.register().catch(() => undefined);
      void get().refreshProfile();
      return true;
    } catch (error) {
      set({ status: 'unauthenticated', error: toErrorMessage(error) });
      return false;
    }
  },

  logout() {
    return endSession(null);
  },

  setDriver(driver) {
    set({ driver });
    const { user } = get();
    if (user) {
      cacheProfile(user, driver);
    }
  },

  async refreshProfile() {
    const epoch = sessionEpoch;
    const profile = await usersApi.me().catch(() => null);
    if (profile && epoch === sessionEpoch && get().status === 'authenticated') {
      get().applyProfile(profile);
    }
  },

  applyProfile(profile) {
    const { user, driver } = get();
    if (!user) return;
    const next: AuthUser = {
      ...user,
      ...(profile.fullName !== undefined ? { fullName: profile.fullName } : {}),
      ...(profile.email !== undefined ? { email: profile.email } : {}),
      ...(profile.phone !== undefined ? { phone: profile.phone ?? '' } : {}),
      ...(profile.avatarUrl !== undefined ? { avatarUrl: profile.avatarUrl } : {}),
    };
    set({ user: next });
    cacheProfile(next, driver);
  },
}));

// Sin red, bootstrap dejo la sesion sin validar. La primera respuesta del
// servidor (markSynced) prueba que volvio la red y se revalida.
useConnectivity.subscribe((state, prev) => {
  if (!revalidatePending || !state.online || prev.online) {
    return;
  }
  const { status, bootstrap } = useAuth.getState();
  if (status === 'idle' || status === 'authenticated') {
    revalidatePending = false;
    void bootstrap();
  }
});
