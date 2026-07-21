import { PermissionsAndroid, Platform } from 'react-native';
import { devicesApi } from '@/api/devices.api';
import { env } from '@/config/env';
import type { DevicePlatform, NotificationRoute } from '@/types/api';
import { appStorage, STORAGE_KEYS } from '@/services/storage/app-storage';
import { parseNotificationRoute } from '@/services/notifications/notification-routing.service';
import { uuid } from '@/utils/id';

type MessagingModule = typeof import('@react-native-firebase/messaging');
type MessagingInstance = ReturnType<MessagingModule['getMessaging']>;

let messagingModulePromise: Promise<MessagingModule | null> | null = null;

async function loadMessaging(): Promise<MessagingModule | null> {
  messagingModulePromise ??= import('@react-native-firebase/messaging').catch(
    () => null,
  );
  return messagingModulePromise;
}

/**
 * Push notifications are delivered via Firebase Cloud Messaging.
 *
 * RNFirebase is loaded lazily so Expo Go degrades to a no-op, while development
 * and production builds get native FCM tokens and notification tap routing.
 */
class PushNotificationsService {
  private registeredToken: string | null = null;

  configure(): void {
    // Background FCM is registered at module scope from the app entrypoint.
  }

  async register(): Promise<string | null> {
    try {
      const messagingModule = await loadMessaging();
      if (!messagingModule) {
        return null;
      }

      const messaging = messagingModule.getMessaging();
      const hasPermission = await this.requestPermission(
        messagingModule,
        messaging,
      );
      if (!hasPermission) {
        return null;
      }

      await this.registerForRemoteMessages(messagingModule, messaging);
      const token = await messagingModule.getToken(messaging);
      return token ? this.registerToken(token) : null;
    } catch {
      return null;
    }
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

  /** Subscribes to foreground messages, notification taps and token refreshes. */
  addListeners(
    onRoute: (route: NotificationRoute) => void,
    onForegroundMessage?: () => void,
  ): () => void {
    let disposed = false;
    const unsubscribers: Array<() => void> = [];

    void loadMessaging().then((messagingModule) => {
      if (!messagingModule || disposed) {
        return;
      }

      const messaging = messagingModule.getMessaging();
      unsubscribers.push(
        messagingModule.onMessage(messaging, () => {
          onForegroundMessage?.();
        }),
        messagingModule.onNotificationOpenedApp(messaging, (message) => {
          const route = parseNotificationRoute(message.data);
          if (route) {
            onRoute(route);
          }
        }),
        messagingModule.onTokenRefresh(messaging, (token) => {
          void this.registerToken(token);
        }),
      );
    });

    return () => {
      disposed = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }

  /** Route from the notification that cold-started the app. */
  async getInitialRoute(): Promise<NotificationRoute | null> {
    try {
      const messagingModule = await loadMessaging();
      if (!messagingModule) {
        return null;
      }
      const message = await messagingModule.getInitialNotification(
        messagingModule.getMessaging(),
      );
      return parseNotificationRoute(message?.data);
    } catch {
      return null;
    }
  }

  private async requestPermission(
    messagingModule: MessagingModule,
    messaging: MessagingInstance,
  ): Promise<boolean> {
    if (Platform.OS === 'android') {
      return this.requestAndroidPermission();
    }

    const status = await messagingModule.requestPermission(messaging);
    return (
      status === messagingModule.AuthorizationStatus.AUTHORIZED ||
      status === messagingModule.AuthorizationStatus.PROVISIONAL
    );
  }

  private async requestAndroidPermission(): Promise<boolean> {
    const version = Number(Platform.Version);
    if (!Number.isFinite(version) || version < 33) {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  private async registerForRemoteMessages(
    messagingModule: MessagingModule,
    messaging: MessagingInstance,
  ): Promise<void> {
    if (Platform.OS === 'ios') {
      await messagingModule.registerDeviceForRemoteMessages(messaging);
    }
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
