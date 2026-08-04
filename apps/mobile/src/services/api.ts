import Constants from "expo-constants";
import { create } from "axios";
import { Platform } from "react-native";
import { tokenStorage } from "./token-storage";

const baseURL = Platform.OS === "web"
  ? process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api/v1"
  : process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? "http://127.0.0.1:4000/api/v1";
const requestTimeoutMs = 20000;
const retryDelayMs = 600;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (status?: number) => status === undefined || status === 408 || status === 429 || status >= 500;
const backendErrorMessage = (data: any, fallback: string) => {
  const errors = data?.errors && typeof data.errors === "object"
    ? Object.values(data.errors).flat().filter(Boolean).join(" ")
    : "";
  return [data?.message, errors].filter(Boolean).join(": ") || fallback;
};

const refreshAccessToken = async () => {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) return undefined;

  const { data } = await create({
    baseURL,
    timeout: requestTimeoutMs,
    headers: { Accept: "application/json", "Content-Type": "application/json" }
  }).post("/auth/refresh", { refreshToken });

  await tokenStorage.save(data.accessToken, refreshToken);
  return data.accessToken as string;
};

const request = async (method: string, path: string, body?: unknown, attempt = 0, refreshTried = false): Promise<{ data: any }> => {
  const token = await tokenStorage.getAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      if (response.status === 401 && !refreshTried) {
        const newToken = await refreshAccessToken();
        if (newToken) return request(method, path, body, attempt, true);
      }
      if (attempt < 2 && shouldRetry(response.status)) {
        await sleep(retryDelayMs * (attempt + 1));
        return request(method, path, body, attempt + 1, refreshTried);
      }
      throw new Error(backendErrorMessage(data, `API request failed: ${response.status}`));
    }
    return { data };
  } catch (error) {
    if (attempt < 2) {
      await sleep(retryDelayMs * (attempt + 1));
      return request(method, path, body, attempt + 1, refreshTried);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const api = Platform.OS === "web"
  ? {
      get: (path: string) => request("GET", path),
      post: (path: string, body?: unknown) => request("POST", path, body),
      put: (path: string, body?: unknown) => request("PUT", path, body),
      patch: (path: string, body?: unknown) => request("PATCH", path, body),
      delete: (path: string) => request("DELETE", path)
    }
  : create({ baseURL, timeout: requestTimeoutMs, headers: { Accept: "application/json" } });

if ("interceptors" in api) {
  api.interceptors.request.use(async (config) => {
    const token = await tokenStorage.getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(undefined, async (error) => {
    const config = error.config ?? {};
    const status = error.response?.status;
    if ((config.__retryCount ?? 0) < 2 && shouldRetry(status)) {
      config.__retryCount = (config.__retryCount ?? 0) + 1;
      await sleep(retryDelayMs * config.__retryCount);
      return api(config);
    }
    if (status === 401 && !config.__refreshTried) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        config.__refreshTried = true;
        config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${newToken}` };
        return api(config);
      }
    }
    const message = backendErrorMessage(error.response?.data, error.message ?? "API request failed");
    throw new Error(message);
  });
}
