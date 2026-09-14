import { http, unwrap } from './client';
import type { ApiResponse, Attachment, UploadedAttachment } from '@/types/api';

export interface UploadableFile {
  uri: string;
  name: string;
  type: string;
}

export interface UploadAttachmentsInput {
  entityType?: string;
  entityId?: string;
  files: UploadableFile[];
}

export const attachmentsApi = {
  async list(entityType?: string, entityId?: string): Promise<Attachment[]> {
    const res = await http.get<ApiResponse<Attachment[]>>('/attachments', {
      params: { entityType, entityId },
    });
    return unwrap(res.data);
  },

  async upload(input: UploadAttachmentsInput): Promise<UploadedAttachment[]> {
    const form = new FormData();
    if (input.entityType) form.append('entityType', input.entityType);
    if (input.entityId) form.append('entityId', input.entityId);

    for (const file of input.files) {
      form.append('files', file as unknown as Blob);
    }

    const res = await http.post<ApiResponse<UploadedAttachment[]>>(
      '/attachments/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return unwrap(res.data);
  },
};
