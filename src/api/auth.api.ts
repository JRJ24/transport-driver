import { Platform } from 'react-native';
import { http, unwrap } from './client';
import type { ApiResponse, AuthResult, AuthTokens, Me } from '@/types/api';

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

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const res = await http.post<ApiResponse<AuthTokens>>('/auth/refresh', {
      refreshToken,
    });
    return unwrap(res.data);
  },

  async me(): Promise<Me> {
    const res = await http.get<ApiResponse<Me>>('/auth/me');
    return unwrap(res.data);
  },

  async logout(): Promise<void> {
    await http.post('/auth/logout').catch(() => undefined);
  },
};
