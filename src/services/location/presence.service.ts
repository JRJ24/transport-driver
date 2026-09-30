import * as Location from 'expo-location';
import { offersApi, type PresencePing } from '@/api/offers.api';
import { socketService } from '@/services/socket/socket.service';

/** The backend treats a position older than 60 s as stale. */
const PING_INTERVAL_MS = 10_000;

/**
 * Reports where an AVAILABLE driver is, so automatic dispatch can find them
 * by H3 cell. Foreground only and at balanced accuracy: while idle there is
 * no delivery to protect, so battery wins. During a trip the tracking session
 * takes over and presence is not needed (the driver is BUSY).
 */
class PresenceService {
  private watch: Location.LocationSubscription | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFix: Location.LocationObject | null = null;
  private vehicleId: string | undefined;

  get isRunning(): boolean {
    return this.watch !== null;
  }

  async start(vehicleId?: string): Promise<void> {
    this.vehicleId = vehicleId;
    if (this.watch) {
      return;
    }
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return;
    }

    this.watch = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: PING_INTERVAL_MS,
        distanceInterval: 30,
      },
      (loc) => {
        const first = this.lastFix === null;
        this.lastFix = loc;
        if (first) {
          void this.send();
        }
      },
    );
    this.timer = setInterval(() => void this.send(), PING_INTERVAL_MS);
  }

  /** Stops reporting; `leave` also removes the driver from the search now. */
  async stop(options: { leave?: boolean } = {}): Promise<void> {
    this.watch?.remove();
    this.watch = null;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.lastFix = null;
    if (options.leave) {
      await offersApi.leave().catch(() => undefined);
    }
  }

  private async send(): Promise<void> {
    const fix = this.lastFix;
    if (!fix) {
      return;
    }
    const { coords } = fix;
    const ping: PresencePing = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyM: Math.round(coords.accuracy ?? 999),
      ...(coords.heading != null && coords.heading >= 0 && { heading: coords.heading }),
      ...(coords.speed != null && coords.speed >= 0 && { speed: coords.speed }),
      ...(this.vehicleId && { vehicleId: this.vehicleId }),
      ...(fix.mocked !== undefined && { isMocked: fix.mocked }),
      observedAt: new Date(fix.timestamp).toISOString(),
    };

    if (socketService.connected) {
      socketService.emit('driver:presence', ping);
      return;
    }
    await offersApi.ping(ping).catch(() => undefined);
  }
}

export const presenceService = new PresenceService();
