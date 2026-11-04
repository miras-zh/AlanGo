import { API_BASE_URL } from "./site";
import { clearSession, getAccessToken, getRefreshToken, getSessionUser, saveSession } from "./auth";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (!options.skipAuth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && !options.skipAuth && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${refreshed}`);
      res = await fetch(url, { ...options, headers });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const msg =
      (json && (typeof json.error === "string" ? json.error : typeof json.message === "string" ? json.message : null)) ||
      `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }

  return json as T;
}

async function tryRefresh(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const data = await res.json();
    const user = data.user || getSessionUser();
    if (data.token && user) {
      saveSession({
        token: data.token,
        refreshToken: data.refresh_token || refresh,
        user,
      });
      return data.token as string;
    }
    return null;
  } catch {
    return null;
  }
}
