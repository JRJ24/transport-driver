import Constants from 'expo-constants';

/**
 * Runtime configuration. Public values come from EXPO_PUBLIC_* env vars (bundled
 * at build time) with an `extra` fallback from app.config. No secrets here — the
 * Google Routes key and Firebase Admin credentials live ONLY on the backend.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const DEFAULT_API_URL = 'https://api.larutard.com.do/api/v1';

// babel-preset-expo solo incrusta `process.env.EXPO_PUBLIC_*` escrito con punto;
// con `process.env[key]` el bundle recibe undefined. Por eso cada llamada pasa
// el acceso literal y `extra` queda como respaldo.
function value(inlined: string | undefined, key: string, fallback = ''): string {
  return inlined?.trim() || extra[key]?.trim() || fallback;
}

function url(inlined: string | undefined, key: string, fallback = ''): string {
  return value(inlined, key, fallback).replace(/\/+$/, '');
}

const apiUrl = url(process.env.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL', DEFAULT_API_URL);

// Sin valor explicito el socket va al mismo origen que la API (nginx proxya
// /socket.io). Regex y no `new URL().origin`, que React Native no garantiza.
const socketUrl =
  url(process.env.EXPO_PUBLIC_SOCKET_URL, 'EXPO_PUBLIC_SOCKET_URL') ||
  (apiUrl.match(/^https?:\/\/[^/]+/i)?.[0] ?? apiUrl);

export const env = {
  apiUrl,
  socketUrl,
  googleMapsAndroidKey: value(
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
    'EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY',
  ),
  googleMapsIosKey: value(
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY,
    'EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY',
  ),
  appVersion: Constants.expoConfig?.version ?? '1.0.0',
};

if (__DEV__) {
  console.log('[env] api', env.apiUrl, 'socket', env.socketUrl);
} else {
  const cleartext = [env.apiUrl, env.socketUrl].filter((u) => /^http:\/\//i.test(u));
  // Un build release bloquea el trafico cleartext (Android solo lo permite en
  // debug, iOS por ATS), asi que toda llamada HTTP y el socket fallarian.
  if (cleartext.length > 0) {
    console.error(
      `[env] URL http:// en un build release, el sistema bloquea el cleartext: ${cleartext.join(', ')}. Usa https.`,
    );
  }
}
