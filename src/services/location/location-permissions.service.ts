import * as Location from 'expo-location';

export interface LocationPermissionState {
  foreground: boolean;
  background: boolean;
  servicesEnabled: boolean;
}

/**
 * Requests foreground first, then background (required for tracking while the
 * app is not in the foreground). Background must never be requested before
 * foreground is granted.
 */
export const locationPermissions = {
  async request(): Promise<LocationPermissionState> {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    const fg = await Location.requestForegroundPermissionsAsync();

    let background = false;
    if (fg.status === 'granted') {
      const bg = await Location.requestBackgroundPermissionsAsync();
      background = bg.status === 'granted';
    }

    return {
      foreground: fg.status === 'granted',
      background,
      servicesEnabled,
    };
  },

  async check(): Promise<LocationPermissionState> {
    const [fg, bg, servicesEnabled] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Location.hasServicesEnabledAsync(),
    ]);
    return {
      foreground: fg.status === 'granted',
      background: bg.status === 'granted',
      servicesEnabled,
    };
  },
};
