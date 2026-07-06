import * as SecureStore from "expo-secure-store";

const accessKey = "attendance.accessToken";
const refreshKey = "attendance.refreshToken";

export const tokenStorage = {
  save: async (accessToken: string, refreshToken: string) => {
    await SecureStore.setItemAsync(accessKey, accessToken);
    await SecureStore.setItemAsync(refreshKey, refreshToken);
  },
  getAccessToken: () => SecureStore.getItemAsync(accessKey),
  getRefreshToken: () => SecureStore.getItemAsync(refreshKey),
  clear: async () => {
    await SecureStore.deleteItemAsync(accessKey);
    await SecureStore.deleteItemAsync(refreshKey);
  }
};
