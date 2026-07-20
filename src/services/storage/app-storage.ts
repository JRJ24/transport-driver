import AsyncStorage from '@react-native-async-storage/async-storage';

/** Non-sensitive JSON cache (active order, route, installation id, queues). */
export const appStorage = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

export const STORAGE_KEYS = {
  installationId: 'transport-driver.installationId',
  activeOrder: 'transport-driver.activeOrder',
  activeRoute: 'transport-driver.activeRoute',
  activeSession: 'transport-driver.activeSession',
  locationQueue: 'transport-driver.locationQueue',
  statusQueue: 'transport-driver.statusQueue',
} as const;
