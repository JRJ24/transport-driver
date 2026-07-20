import * as SecureStore from 'expo-secure-store';

/** Access/refresh tokens are stored ONLY in the OS secure enclave/keystore. */
const ACCESS = 'transport-driver.accessToken';
const REFRESH = 'transport-driver.refreshToken';

export const secureStorage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS);
  },
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH);
  },
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS, accessToken);
    await SecureStore.setItemAsync(REFRESH, refreshToken);
  },
  async setAccessToken(accessToken: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS, accessToken);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
  },
};
