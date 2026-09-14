import type { ExpoConfig, ConfigContext } from 'expo/config';

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
    // `google-services.json` y el .plist estan en .gitignore, asi que EAS
    // Build no los recibe del repo: llegan como variable de tipo archivo.
    googleServicesFile:
      process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
    entitlements: {
      'aps-environment':
        process.env.IOS_APS_ENVIRONMENT === 'production'
          ? 'production'
          : 'development',
    },

    config: {
      usesNonExemptEncryption: false,
      googleMapsApiKey:
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY,
    },

    infoPlist: {
      UIBackgroundModes: ['location', 'remote-notification'],
      NSLocationWhenInUseUsageDescription:
        'Usamos tu ubicación durante un servicio activo para el seguimiento y la seguridad de la entrega.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Usamos tu ubicación durante un servicio activo, incluso en segundo plano, para el seguimiento de la entrega.',
    },
  },

  android: {
    package: 'do.com.flypack.rutardriver',
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
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
        apiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },

  plugins: [
    'expo-secure-store',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
          forceStaticLinking: ['RNFBApp', 'RNFBMessaging'],
        },
      },
    ],

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
    [
      'expo-image-picker',
      {
        cameraPermission:
          'Permite que RUTA RD Driver tome fotos como evidencia de entrega.',
        photosPermission:
          'Permite adjuntar fotos de evidencia desde tu galería cuando sea necesario.',
        microphonePermission: false,
      },
    ],
  ],

extra: {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL,
  EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY:
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
  EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY:
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY,

  eas: {
    projectId: "338328d5-d5d3-4432-ae9d-282ed53a1101",
  },
},
});
