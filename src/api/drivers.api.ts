import { http, unwrap } from './client';
import type {
  ApiResponse,
  Assignment,
  DriverProfile,
  DriverStatus,
} from '@/types/api';

export const driversApi = {
  async me(): Promise<DriverProfile | null> {
    const res = await http.get<ApiResponse<DriverProfile | null>>('/drivers/me');
    return unwrap(res.data);
  },

  /** Driver's assigned orders (backend: GET /assignments/me). */
  async myAssignments(): Promise<Assignment[]> {
    const res = await http.get<ApiResponse<Assignment[]>>('/assignments/me');
    return unwrap(res.data);
  },

  /** Rechaza una asignacion pendiente: la orden vuelve al despacho. */
  async rejectAssignment(assignmentId: string): Promise<Assignment> {
    const res = await http.patch<ApiResponse<Assignment>>(
      `/assignments/${assignmentId}/reject`,
      {},
    );
    return unwrap(res.data);
  },

  async updateStatus(
    driverId: string,
    availabilityStatus: DriverStatus,
  ): Promise<DriverProfile> {
    const res = await http.patch<ApiResponse<DriverProfile>>(
      `/drivers/${driverId}/status`,
      { availabilityStatus },
    );
    return unwrap(res.data);
  },
};
