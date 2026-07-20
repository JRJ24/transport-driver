import Constants from 'expo-constants';

/**
 * Runtime configuration. Public values come from EXPO_PUBLIC_* env vars (bundled
 * at build time) with an `extra` fallback from app.config. No secrets here — the
 * Google Routes key and Firebase Admin credentials live ONLY on the backend.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

function value(key: string, fallback: string): string {
  return process.env[key] ?? extra[key] ?? fallback;
}

export const env = {
  apiUrl: value('EXPO_PUBLIC_API_URL', 'http://localhost:3000/api/v1'),
  socketUrl: value('EXPO_PUBLIC_SOCKET_URL', 'http://localhost:3000'),
  googleMapsAndroidKey: value('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY', ''),
  googleMapsIosKey: value('EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY', ''),
  appVersion: Constants.expoConfig?.version ?? '1.0.0',
};
