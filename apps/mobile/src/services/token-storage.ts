import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const accessKey = "attendance.accessToken";
const refreshKey = "attendance.refreshToken";

const webStorage = {
  setItem: async (key: string, value: string) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  },
  getItem: async (key: string) => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  },
  deleteItem: async (key: string) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  }
};

const storage = Platform.OS === "web"
  ? webStorage
  : {
      setItem: SecureStore.setItemAsync,
      getItem: SecureStore.getItemAsync,
      deleteItem: SecureStore.deleteItemAsync
    };

export const tokenStorage = {
  save: async (accessToken: string, refreshToken: string) => {
    await storage.setItem(accessKey, accessToken);
    await storage.setItem(refreshKey, refreshToken);
  },
  getAccessToken: () => storage.getItem(accessKey),
  getRefreshToken: () => storage.getItem(refreshKey),
  clear: async () => {
    await storage.deleteItem(accessKey);
    await storage.deleteItem(refreshKey);
  }
};
