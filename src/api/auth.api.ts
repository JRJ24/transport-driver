import { Platform } from 'react-native';
import { http, unwrap } from './client';
import type { ApiResponse, AuthResult, Me } from '@/types/api';

export const authApi = {
  async login(email: string, password: string): Promise<AuthResult> {
    const res = await http.post<ApiResponse<AuthResult>>('/auth/login', {
      email,
      password,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceName: `transport-driver-${Platform.OS}`,
    });
    return unwrap(res.data);
  },

  async me(): Promise<Me> {
    const res = await http.get<ApiResponse<Me>>('/auth/me');
    return unwrap(res.data);
  },

  /**
   * Best-effort. Con `accessToken` revoca esa sesion aunque el cliente ya haya
   * limpiado el token global (o tenga el de un login posterior).
   */
  async logout(accessToken?: string): Promise<void> {
    await http
      .post('/auth/logout', undefined, {
        skipAuthRefresh: true,
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      })
      .catch(() => undefined);
  },
};
