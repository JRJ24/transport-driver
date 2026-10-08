import * as Location from 'expo-location';
import { offersApi, type PresencePing } from '@/api/offers.api';
import { socketService } from '@/services/socket/socket.service';

/** The backend treats a position older than 60 s as stale. */
const PING_INTERVAL_MS = 10_000;
// Quieto, el watch no entrega fixes nuevos (distanceInterval) y reenviar el
// mismo observedAt lo rechaza el servidor (OUT_OF_ORDER y luego STALE_TIMESTAMP).
const MAX_FIX_AGE_MS = 20_000;
// getCurrentPositionAsync no tiene timeout y puede tardar mucho bajo techo.
const FIX_TIMEOUT_MS = 8_000;

function logRejection(res: unknown): void {
  if (res && typeof res === 'object' && 'accepted' in res && res.accepted === false) {
    console.warn('[presence] rechazada', 'reason' in res ? res.reason : res);
  }
}

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
  private lastSentAt = 0;
  private sending = false;
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
    if (this.sending) {
      return;
    }
    this.sending = true;
    try {
      await this.sendFix();
    } finally {
      this.sending = false;
    }
  }

  private async sendFix(): Promise<void> {
    const fix = await this.freshFix();
    // Un fix ya enviado volveria como OUT_OF_ORDER.
    if (!fix || fix.timestamp <= this.lastSentAt) {
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

    this.lastSentAt = fix.timestamp;
    if (socketService.connected) {
      socketService.emitWithAck('driver:presence', ping, logRejection);
      return;
    }
    logRejection(await offersApi.ping(ping).catch(() => null));
  }

  private async freshFix(): Promise<Location.LocationObject | null> {
    const fix = this.lastFix;
    if (fix && Date.now() - fix.timestamp <= MAX_FIX_AGE_MS) {
      return fix;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const current = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          // Cada 20 s: no hay que abrir el dialogo de ajustes en bucle.
          mayShowUserSettingsDialog: false,
        }),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), FIX_TIMEOUT_MS);
        }),
      ]);
      // stop() pudo llegar mientras se esperaba el fix.
      if (!current || !this.watch) {
        return null;
      }
      if (!this.lastFix || current.timestamp > this.lastFix.timestamp) {
        this.lastFix = current;
      }
      return this.lastFix;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const presenceService = new PresenceService();
