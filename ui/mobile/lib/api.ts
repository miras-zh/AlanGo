import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import {
  clearSession,
  getRefreshToken,
  getToken,
  setRefreshToken,
  setToken,
} from "@/lib/auth";

const defaultHost = Platform.OS === "android" ? "http://10.0.2.2:8092" : "http://localhost:8092";

export const baseURL = process.env.EXPO_PUBLIC_API_URL || defaultHost;
export const UPLOAD_TIMEOUT_MS = 60000;

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { "X-Client-Type": "mobile" },
});

export async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | FormData;
    skipAuth?: boolean;
  } = {}
): Promise<T> {
  const url = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  let data: unknown;
  if (options.body) {
    if (typeof options.body === "string") {
      try {
        data = JSON.parse(options.body);
      } catch {
        data = options.body;
      }
    } else {
      data = options.body;
    }
  }

  const res = await api.request<T>({
    url,
    method: options.method || "GET",
    data,
    headers: options.headers,
  });
  return res.data;
}

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        throw new Error("no refresh token");
      }
      const res = await axios.post<{ token: string; refresh_token?: string }>(
        "/api/auth/refresh",
        { refresh_token: refreshToken },
        { baseURL, timeout: 15000, headers: { "X-Client-Type": "mobile" } },
      );
      await setToken(res.data.token);
      if (res.data.refresh_token) {
        await setRefreshToken(res.data.refresh_token);
      }
      return res.data.token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isAuthEndpoint =
      config?.url === "/api/login" ||
      config?.url === "/api/auth/refresh" ||
      config?.url === "/api/auth/apple" ||
      config?.url === "/api/auth/google";

    if (status === 401 && config && !config._retried && !isAuthEndpoint) {
      config._retried = true;
      try {
        const token = await refreshAccessToken();
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch {
        await clearSession();
        return Promise.reject(error);
      }
    }

    if (status === 401 && (!isAuthEndpoint || config?.url === "/api/auth/refresh")) {
      await clearSession();
    }
    return Promise.reject(error);
  },
);
