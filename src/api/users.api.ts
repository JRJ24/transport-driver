import { http, unwrap } from './client';
import type { ApiResponse, UserProfile, Vehicle } from '@/types/api';
import type { UploadableFile } from './attachments.api';

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
}

export type EmailChangeResult = { status: 'CODE_SENT' | 'CHANGED' } & Record<string, unknown>;

/** Perfil propio del conductor (mismos endpoints que usa app-customers). */
export const usersApi = {
  async me(): Promise<UserProfile> {
    const res = await http.get<ApiResponse<UserProfile>>('/users/me');
    return unwrap(res.data);
  },

  async update(input: UpdateProfileInput): Promise<UserProfile> {
    const res = await http.patch<ApiResponse<UserProfile>>('/users/me', input);
    return unwrap(res.data);
  },

  /** El servidor solo acepta el campo `file` (JPG, PNG o WebP, 2 MB). */
  async uploadAvatar(file: UploadableFile): Promise<{ avatarUrl: string }> {
    const form = new FormData();
    form.append('file', file as unknown as Blob);
    const res = await http.post<ApiResponse<{ avatarUrl: string }>>(
      '/users/me/avatar',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 45000 },
    );
    return unwrap(res.data);
  },

  async deleteAvatar(): Promise<void> {
    await http.delete('/users/me/avatar');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ revokedSessions?: number }> {
    const res = await http.post<ApiResponse<{ revokedSessions?: number }>>(
      '/auth/change-password',
      { currentPassword, newPassword },
    );
    return unwrap(res.data);
  },

  async requestEmailChange(newEmail: string, password: string): Promise<EmailChangeResult> {
    const res = await http.post<ApiResponse<EmailChangeResult>>('/users/me/email', {
      newEmail,
      password,
    });
    return unwrap(res.data);
  },

  async confirmEmailChange(code: string): Promise<unknown> {
    const res = await http.post<ApiResponse<unknown>>('/users/me/email/confirm', { code });
    return unwrap(res.data);
  },

  async myVehicles(): Promise<Vehicle[]> {
    const res = await http.get<ApiResponse<Vehicle[]>>('/drivers/me/vehicles');
    return unwrap(res.data);
  },
};
