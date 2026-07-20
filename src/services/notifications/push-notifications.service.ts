import { Platform } from 'react-native';
import { devicesApi } from '@/api/devices.api';
import { env } from '@/config/env';
import type { DevicePlatform, NotificationRoute } from '@/types/api';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { uuid } from '@/utils/id';

/**
 * Push notifications are delivered via Firebase Cloud Messaging.
 *
 * `expo-notifications` was removed because its remote-push APIs crash in Expo Go
 * (SDK 53+). This service is now an FCM-ready seam with no runtime dependency,
 * so the app runs in Expo Go and in dev/production builds without errors.
 *
 * To wire FCM (in a development/production build), install
 * `@react-native-firebase/app` + `@react-native-firebase/messaging` and fill in
 * the marked spots below:
 *   - register(): `messaging().requestPermission()` + `messaging().getToken()`,
 *     then call `this.registerToken(token)`.
 *   - addListeners(): `messaging().onNotificationOpenedApp(...)` and
 *     `messaging().getInitialNotification()` → parseNotificationRoute → onRoute;
 *     `messaging().onTokenRefresh(token => this.registerToken(token))`.
 *
 * `registerToken()` and the backend contract (`POST /devices`) are already in
 * place, so only the native token acquisition is left to plug in.
 */
class PushNotificationsService {
  private registeredToken: string | null = null;

  configure(): void {
    // No-op until FCM is wired. (FCM background handler is registered natively.)
  }

  /**
   * Acquires the FCM token and registers it with the backend. Returns null for
   * now (no native token source); wire FCM to make it functional.
   */
  async register(): Promise<string | null> {
    // TODO(FCM): const token = await messaging().getToken();
    //            return this.registerToken(token);
    return null;
  }

  /** Sends an FCM device token to the backend. Call this once FCM is wired. */
  async registerToken(token: string): Promise<string | null> {
    try {
      const installationId = await this.installationId();
      await devicesApi.register({
        token,
        platform: (Platform.OS === 'ios' ? 'IOS' : 'ANDROID') as DevicePlatform,
        installationId,
        deviceName: `transport-driver-${Platform.OS}`,
        appVersion: env.appVersion,
      });
      this.registeredToken = token;
      return token;
    } catch {
      return null;
    }
  }

  async unregister(): Promise<void> {
    if (this.registeredToken) {
      await devicesApi.remove(this.registeredToken);
      this.registeredToken = null;
    }
  }

  /** Subscribes to notification taps + token refresh. Returns an unsubscribe. */
  addListeners(_onRoute: (route: NotificationRoute) => void): () => void {
    // TODO(FCM): wire onNotificationOpenedApp / onTokenRefresh here.
    return () => undefined;
  }

  /** Route from the notification that cold-started the app. */
  async getInitialRoute(): Promise<NotificationRoute | null> {
    // TODO(FCM): return parseNotificationRoute(
    //   (await messaging().getInitialNotification())?.data);
    return null;
  }

  private async installationId(): Promise<string> {
    let id = await appStorage.get<string>(STORAGE_KEYS.installationId);
    if (!id) {
      id = uuid();
      await appStorage.set(STORAGE_KEYS.installationId, id);
    }
    return id;
  }
}

export const pushNotifications = new PushNotificationsService();
