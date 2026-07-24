import { http, unwrap } from './client';
import type {
  ApiResponse,
  Incident,
  IncidentSeverity,
  IncidentType,
} from '@/types/api';

export interface CreateIncidentInput {
  orderId: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
}

export const incidentsApi = {
  async create(input: CreateIncidentInput): Promise<Incident> {
    const res = await http.post<ApiResponse<Incident>>('/incidents', input);
    return unwrap(res.data);
  },
};
