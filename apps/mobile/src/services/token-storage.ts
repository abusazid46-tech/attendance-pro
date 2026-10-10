import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type SavedUserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl?: string;
  mobileNumber?: string;
};

export type SavedCredentials = {
  identifier: string;
  password: string;
};

const accessKey = "attendance.accessToken";
const refreshKey = "attendance.refreshToken";
const userKey = "attendance.savedUser";
const biometricKey = "attendance.biometricEnabled";
const credentialsKey = "attendance.savedCredentials";

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
  saveUser: async (user: SavedUserProfile) => {
    await storage.setItem(userKey, JSON.stringify(user));
  },
  getSavedUser: async (): Promise<SavedUserProfile | null> => {
    const raw = await storage.getItem(userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  saveCredentials: async (credentials: SavedCredentials) => {
    await storage.setItem(credentialsKey, JSON.stringify(credentials));
    await storage.setItem(biometricKey, "true");
  },
  getSavedCredentials: async (): Promise<SavedCredentials | null> => {
    const raw = await storage.getItem(credentialsKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setBiometricEnabled: async (enabled: boolean) => {
    await storage.setItem(biometricKey, enabled ? "true" : "false");
  },
  isBiometricEnabled: async (): Promise<boolean> => {
    const val = await storage.getItem(biometricKey);
    return val === "true";
  },
  clearActiveSession: async () => {
    await storage.deleteItem(accessKey);
    await storage.deleteItem(refreshKey);
  },
  clear: async () => {
    await storage.deleteItem(accessKey);
    await storage.deleteItem(refreshKey);
  },
  clearAll: async () => {
    await storage.deleteItem(accessKey);
    await storage.deleteItem(refreshKey);
    await storage.deleteItem(userKey);
    await storage.deleteItem(biometricKey);
    await storage.deleteItem(credentialsKey);
  }
};

