import { create } from 'zustand';
import { authApi } from '@/api/auth.api';
import { driversApi } from '@/api/drivers.api';
import { apiClient, toErrorMessage } from '@/api/client';
import type { AuthUser, DriverProfile } from '@/types/api';
import { secureStorage } from '@/services/storage/secure-storage';
import { pushNotifications } from '@/services/notifications/push-notifications.service';

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
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  driver: null,
  error: null,

  async bootstrap() {
    // Route 401s from anywhere back to the login screen.
    apiClient.setUnauthorizedHandler(() => {
      void get().logout();
    });

    const token = await secureStorage.getAccessToken();
    if (!token) {
      set({ status: 'unauthenticated' });
      return;
    }
    apiClient.setAccessToken(token);
    try {
      const me = await authApi.me();
      const driver = await driversApi.me().catch(() => null);
      set({
        status: 'authenticated',
        user: {
          id: me.id,
          email: me.email,
          fullName: me.fullName,
          phone: '',
          status: me.status,
          roles: me.roles,
        },
        driver,
      });
      void pushNotifications.register().catch(() => undefined);
    } catch {
      await secureStorage.clear();
      apiClient.setAccessToken(null);
      set({ status: 'unauthenticated' });
    }
  },

  async login(email, password) {
    set({ status: 'authenticating', error: null });
    try {
      const result = await authApi.login(email.trim(), password);
      await secureStorage.setTokens(result.accessToken, result.refreshToken);
      apiClient.setAccessToken(result.accessToken);
      const driver = await driversApi.me().catch(() => null);
      set({ status: 'authenticated', user: result.user, driver });
      void pushNotifications.register().catch(() => undefined);
      return true;
    } catch (error) {
      set({ status: 'unauthenticated', error: toErrorMessage(error) });
      return false;
    }
  },

  async logout() {
    await pushNotifications.unregister().catch(() => undefined);
    await authApi.logout().catch(() => undefined);
    await secureStorage.clear();
    apiClient.setAccessToken(null);
    set({ status: 'unauthenticated', user: null, driver: null, error: null });
  },

  setDriver(driver) {
    set({ driver });
  },
}));
