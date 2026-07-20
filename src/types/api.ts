/**
 * Shared API contract types (Phase 2). These mirror the transport-api DTOs and
 * the `{ success, data, meta }` response envelope. No Prisma models are used
 * directly — only the fields the driver app is allowed to see.
 */

// ── Response envelope ────────────────────────────────────────────────────────
export interface ApiMeta {
  requestId?: string;
  timestamp: string;
  path?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Enums (string unions matching the backend) ──────────────────────────────
export type Role = 'ADMIN' | 'OPERATOR' | 'DRIVER' | 'CUSTOMER';
export type DriverStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'SUSPENDED' | 'VACATION';
export type OrderStatus =
  | 'DRAFT'
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';
export type AssignmentStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';
export type StopType = 'PICKUP' | 'DROPOFF' | 'INTERMEDIATE';
export type TrackingSessionStatus = 'ACTIVE' | 'ENDED' | 'INTERRUPTED';
export type DevicePlatform = 'ANDROID' | 'IOS' | 'WEB';

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  roles: Role[];
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
  sessionId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

/** GET /auth/me principal. */
export interface Me {
  id: string;
  email: string;
  fullName: string;
  status: string;
  roles: Role[];
  permissions: string[];
  sessionId: string;
}

// ── Driver / vehicle ─────────────────────────────────────────────────────────
export interface DriverProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  licenseExpiration: string;
  availabilityStatus: DriverStatus;
  verificationStatus: string;
  ratingAVG: number | string;
  user?: AuthUser;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  urlImage?: string | null;
}

// ── Orders ───────────────────────────────────────────────────────────────────
export interface OrderStop {
  id: string;
  orderId: string;
  stopType: StopType;
  sequence: number;
  contactName: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  province: string;
  latitude: number | string;
  longitude: number | string;
  instructions?: string | null;
  arrivedAt?: string | null;
  completedAt?: string | null;
}

export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  weightKg: number | string;
  volumeM3?: number | string | null;
  fragile: boolean;
  requireHelper: boolean;
}

export interface TransportOrder {
  id: string;
  orderCode: string;
  status: OrderStatus;
  serviceType: string;
  scheduleAt?: string | null;
  pickupAt?: string | null;
  deliveredAt?: string | null;
  distanceKm: number | string;
  estimatedDurationMin: number;
  notes?: string;
  orderStops?: OrderStop[];
  orderItems?: OrderItem[];
}

export interface Assignment {
  id: string;
  orderId: string;
  driverId: string;
  vehicleId: string;
  assignmentStatus: AssignmentStatus;
  assignedAt: string;
  acceptedAt?: string | null;
  order?: TransportOrder;
  vehicle?: Vehicle;
}

// ── Route ────────────────────────────────────────────────────────────────────
export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface ComputedRoute {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMin: number;
  /** Encoded polyline (Google algorithm) to decode + draw. */
  polyline: string;
  legs: RouteLeg[];
  bounds: { northeast: LatLng; southwest: LatLng } | null;
  provider: 'google-routes' | 'internal-mock';
  computedAt: string;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

// ── Tracking ─────────────────────────────────────────────────────────────────
export interface TrackingSession {
  id: string;
  orderId: string;
  driverId: string;
  status: TrackingSessionStatus;
  startedAt: string;
  endedAt?: string | null;
  lastLocationAt?: string | null;
}

/** POST /tracking/sessions/:id/locations payload. */
export interface TrackingLocationPayload {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  altitudeMeters?: number;
  speedMps?: number;
  heading?: number;
  batteryLevel?: number;
  recordedAt: string;
  sequence: number;
  isMocked?: boolean;
  clientId?: string;
}

export interface BatchResult {
  sessionId: string;
  received: number;
  accepted: number;
  duplicates: number;
  lastSequence: number | null;
}

// ── Devices / notifications ──────────────────────────────────────────────────
export interface RegisterDevicePayload {
  token: string;
  platform: DevicePlatform;
  installationId: string;
  deviceName?: string;
  appVersion?: string;
  locale?: string;
}

export interface DeviceToken {
  id: string;
  token: string;
  platform: DevicePlatform;
  isActive: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  notificationType: string;
  data: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
}

/** Safe navigation payload carried inside a push notification's `data`. */
export interface NotificationRoute {
  type: string;
  screen?: string;
  orderId?: string;
}
