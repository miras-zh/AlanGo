import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface SessionUser {
  id: string | number;
  email: string;
  name: string;
  role?: string;
  arenaId?: number;
  business_role?: string;
  avatar_url?: string;
  photo?: string;
  phone?: string;
  bio?: string;
  city?: string;
  full_name?: string;
  plan?: string;
  staffRole?: string;
  staffMemberId?: string;
}

const TOKEN_KEY = "alango_token";
const REFRESH_TOKEN_KEY = "alango_refresh_token";
const USER_KEY = "alango_user";

let cachedUser: SessionUser | null = null;
let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;

const authListeners = new Set<() => void>();

export function subscribeAuth(listener: () => void): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function notifyAuth() {
  authListeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore
    }
  });
}

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" ? localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function base64UrlDecode(input: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const char of normalized) {
    if (char === "=") break;
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

function decodeExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(base64UrlDecode(payload));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getSessionUser(): SessionUser | null {
  return cachedUser;
}

export function getAccessToken(): string | null {
  return cachedToken;
}

export async function hydrateSession(): Promise<SessionUser | null> {
  try {
    const [token, refreshToken, userJson] = await Promise.all([
      storageGet(TOKEN_KEY),
      storageGet(REFRESH_TOKEN_KEY),
      storageGet(USER_KEY),
    ]);

    if (userJson && token) {
      try {
        const parsed = JSON.parse(userJson) as SessionUser;
        // If it was the old mock user from dev testing, wipe it. Never match
        // by id: real ids start at 1, so the first real user was logged out
        // on every launch.
        if (
          parsed.email?.includes("@sportrent.kz") ||
          (token.startsWith("mock_jwt_token") && parsed.role !== "guest" && !parsed.staffMemberId)
        ) {
          await clearSession();
          return null;
        }
        cachedToken = token;
        cachedRefreshToken = refreshToken;
        cachedUser = parsed;
      } catch {
        await clearSession();
        return null;
      }
    } else {
      cachedUser = null;
      cachedToken = null;
      cachedRefreshToken = null;
    }
  } catch {
    cachedUser = null;
    cachedToken = null;
    cachedRefreshToken = null;
  }

  notifyAuth();
  return cachedUser;
}

export async function saveSession(data: {
  token: string;
  refreshToken?: string | null;
  user: SessionUser;
}): Promise<void> {
  cachedToken = data.token;
  cachedRefreshToken = data.refreshToken || null;
  cachedUser = {
    ...data.user,
    name: data.user.name || (data.user as any).full_name || data.user.email.split("@")[0],
  };

  await Promise.all([
    storageSet(TOKEN_KEY, data.token),
    data.refreshToken ? storageSet(REFRESH_TOKEN_KEY, data.refreshToken) : storageDelete(REFRESH_TOKEN_KEY),
    storageSet(USER_KEY, JSON.stringify(cachedUser)),
  ]);

  notifyAuth();
}

export async function updateSessionUser(patch: Partial<SessionUser>): Promise<void> {
  if (!cachedUser) return;
  cachedUser = { ...cachedUser, ...patch };
  await storageSet(USER_KEY, JSON.stringify(cachedUser));
  notifyAuth();
}

export async function clearSession(): Promise<void> {
  cachedUser = null;
  cachedToken = null;
  cachedRefreshToken = null;

  await Promise.all([
    storageDelete(TOKEN_KEY),
    storageDelete(REFRESH_TOKEN_KEY),
    storageDelete(USER_KEY),
  ]);

  notifyAuth();
}

export async function getToken(): Promise<string | null> {
  if (cachedToken) {
    const expiresAt = decodeExpiry(cachedToken);
    if (expiresAt === null || expiresAt >= Date.now()) {
      return cachedToken;
    }
  }
  const token = await storageGet(TOKEN_KEY);
  if (!token) return null;

  const expiresAt = decodeExpiry(token);
  if (expiresAt !== null && expiresAt < Date.now()) {
    await clearToken();
    return null;
  }

  cachedToken = token;
  return token;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await storageSet(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await storageDelete(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  if (cachedRefreshToken) return cachedRefreshToken;
  cachedRefreshToken = await storageGet(REFRESH_TOKEN_KEY);
  return cachedRefreshToken;
}

export async function setRefreshToken(token: string): Promise<void> {
  cachedRefreshToken = token;
  await storageSet(REFRESH_TOKEN_KEY, token);
}

export async function clearRefreshToken(): Promise<void> {
  cachedRefreshToken = null;
  await storageDelete(REFRESH_TOKEN_KEY);
}

// Guest mode: browse the catalog without an account. Not a server session —
// the mock token is recognised by hydrateSession and kept (role "guest").
export async function loginAsGuest(): Promise<SessionUser> {
  const guest: SessionUser = {
    id: "guest",
    email: "guest@alango.kz",
    name: "Гость",
    role: "guest",
    city: "Астана",
    plan: "standard",
  };
  await saveSession({ token: "mock_jwt_token_guest", refreshToken: null, user: guest });
  return guest;
}

export async function loginAsStaff(member: {
  id: string;
  name: string;
  phone: string;
  role: string;
  arenaId: number;
  avatarUrl?: string;
}): Promise<SessionUser> {
  const staffUser: SessionUser = {
    id: `staff_${member.id}`,
    email: `${member.id}@arena.alango.kz`,
    name: member.name,
    full_name: member.name,
    role: "business",
    arenaId: member.arenaId,
    phone: member.phone,
    city: "Астана",
    avatar_url:
      member.avatarUrl ||
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300",
    bio: `Сотрудник спорткомплекса (${member.role}).`,
    plan: "pro",
    staffRole: member.role,
    staffMemberId: member.id,
  };

  await saveSession({
    token: `mock_jwt_token_staff_${member.id}`,
    refreshToken: `mock_refresh_staff_${member.id}`,
    user: staffUser,
  });

  return staffUser;
}

