import Constants from "expo-constants";
import { create } from "axios";
import { tokenStorage } from "./token-storage";

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:4000/api/v1";

export const api = create({ baseURL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
