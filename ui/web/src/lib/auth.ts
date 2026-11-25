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

const LEGACY_ACCESS_KEY = "alango_access_token";
const LEGACY_REFRESH_KEY = "alango_refresh_token";
const USER_KEY = "alango_user";

// Keep short-lived access JWT in memory only; refresh token lives in HttpOnly cookie.
let memoryAccessToken: string | null = null;

function purgeLegacyTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_ACCESS_KEY);
  window.localStorage.removeItem(LEGACY_REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return memoryAccessToken;
}

export function getRefreshToken(): string | null {
  return null;
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  purgeLegacyTokens();
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
  memoryAccessToken = data.token;
  if (typeof window === "undefined") return;
  purgeLegacyTokens();
  window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function updateSessionUser(patch: Partial<SessionUser>) {
  const current = getSessionUser();
  if (!current || typeof window === "undefined") return;
  const updated = { ...current, ...patch };
  window.localStorage.setItem(USER_KEY, JSON.stringify(updated));
}

export function clearSession() {
  memoryAccessToken = null;
  if (typeof window === "undefined") return;
  purgeLegacyTokens();
  window.localStorage.removeItem(USER_KEY);
}
