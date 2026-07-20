import { http, unwrap } from './client';
import type { ApiResponse, DeviceToken, RegisterDevicePayload } from '@/types/api';

export const devicesApi = {
  async register(payload: RegisterDevicePayload): Promise<DeviceToken> {
    const res = await http.post<ApiResponse<DeviceToken>>('/devices', payload);
    return unwrap(res.data);
  },

  async remove(token: string): Promise<void> {
    await http
      .delete(`/devices/${encodeURIComponent(token)}`)
      .catch(() => undefined);
  },
};
