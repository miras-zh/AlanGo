export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  city?: string;
}

const ACCESS_KEY = "alango_access_token";
const REFRESH_KEY = "alango_refresh_token";
const USER_KEY = "alango_user";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function saveSession(data: {
  token: string;
  refreshToken?: string | null;
  user: SessionUser;
}) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, data.token);
  if (data.refreshToken) {
    window.localStorage.setItem(REFRESH_KEY, data.refreshToken);
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function updateSessionUser(patch: Partial<SessionUser>) {
  const current = getSessionUser();
  if (!current || typeof window === "undefined") return;
  const updated = { ...current, ...patch };
  window.localStorage.setItem(USER_KEY, JSON.stringify(updated));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}
