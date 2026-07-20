import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamic Expo config. Google Maps keys and API URLs come from EXPO_PUBLIC_*
 * env vars (per-environment secrets), never hardcoded. google-services.json /
 * GoogleService-Info.plist are added by you locally and referenced here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'transport-driver',
  slug: 'transport-driver',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './src/assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: 'rutardriver',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'do.com.flypack.rutardriver',
    config: {
      usesNonExemptEncryption: false,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY,
    },
    infoPlist: {
      UIBackgroundModes: ['location', 'remote-notification'],
      NSLocationWhenInUseUsageDescription:
        'Usamos tu ubicación durante un servicio activo para el seguimiento y la seguridad de la entrega.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Usamos tu ubicación durante un servicio activo, incluso en segundo plano, para el seguimiento de la entrega.',
    },
    // googleServicesFile: './GoogleService-Info.plist',
  },
  android: {
    package: 'do.com.flypack.rutardriver',
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#0B1220',
      foregroundImage: './src/assets/android-icon-foreground.png',
      backgroundImage: './src/assets/android-icon-background.png',
      monochromeImage: './src/assets/android-icon-monochrome.png',
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
    ],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
    // googleServicesFile: './google-services.json',
  },
  web: {
    favicon: './src/assets/favicon.png',
  },
  plugins: [
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Permite que RUTA RD Driver use tu ubicación durante servicios activos.',
        locationAlwaysAndWhenInUsePermission:
          'Permite que RUTA RD Driver comparta ubicación durante servicios activos, incluso en segundo plano.',
        isAndroidForegroundServiceEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    // Push is delivered via Firebase Cloud Messaging
    // (@react-native-firebase/messaging), added on the native build.
  ],
  extra: {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL,
    EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY:
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
    EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY:
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY,
  },
});
