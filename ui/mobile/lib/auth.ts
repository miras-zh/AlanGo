import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface SessionUser {
  id: string | number;
  email: string;
  name: string;
  role?: string;
  arenaId?: number;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  city?: string;
  full_name?: string;
  plan?: string;
}

const TOKEN_KEY = "alango_token";
const REFRESH_TOKEN_KEY = "alango_refresh_token";
const USER_KEY = "alango_user";

export const MOCK_USER: SessionUser = {
  id: "1",
  email: "miko@sportrent.kz",
  name: "Мико Аскаров",
  role: "client",
  phone: "+7 (777) 123-45-67",
  city: "Астана",
  bio: "Любитель футбола и баскетбола. Бронирую залы каждую неделю.",
  plan: "pro",
  avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
};

let cachedUser: SessionUser | null = MOCK_USER;
let cachedToken: string | null = "mock_jwt_token_sportrent";
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
  return cachedUser ?? MOCK_USER;
}

export function getAccessToken(): string | null {
  return cachedToken ?? "mock_jwt_token_sportrent";
}

export async function hydrateSession(): Promise<SessionUser | null> {
  try {
    const [token, refreshToken, userJson] = await Promise.all([
      storageGet(TOKEN_KEY),
      storageGet(REFRESH_TOKEN_KEY),
      storageGet(USER_KEY),
    ]);

    cachedToken = token || "mock_jwt_token_sportrent";
    cachedRefreshToken = refreshToken;

    if (userJson) {
      try {
        cachedUser = JSON.parse(userJson) as SessionUser;
      } catch {
        cachedUser = MOCK_USER;
      }
    } else {
      cachedUser = MOCK_USER;
    }
  } catch {
    cachedUser = MOCK_USER;
    cachedToken = "mock_jwt_token_sportrent";
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

export async function switchTestAccount(
  accountKey: "dev.arena1" | "dev.arena2" | "dev.client",
): Promise<SessionUser> {
  const accountMap: Record<string, SessionUser> = {
    "dev.arena1": {
      id: 1,
      email: "dev.arena1@sportrent.kz",
      name: "Astana Arena Sport",
      role: "business",
      arenaId: 1,
      phone: "+7 (701) 111-22-33",
      city: "Астана",
      avatar_url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300",
      bio: "Крупнейший мультиспортивный комплекс столицы. 3 крытых зала европейского уровня.",
      plan: "pro",
    },
    "dev.arena2": {
      id: 2,
      email: "dev.arena2@sportrent.kz",
      name: "Nomad Pro Complex",
      role: "business",
      arenaId: 2,
      phone: "+7 (702) 444-55-66",
      city: "Астана",
      avatar_url: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300",
      bio: "Премиальный спортивный кластер: футбол, баскетбол, падл и сквош.",
      plan: "pro",
    },
    "dev.client": {
      id: 3,
      email: "client@sportrent.kz",
      name: "Мико Аскаров",
      role: "client",
      phone: "+7 (777) 123-45-67",
      city: "Астана",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300",
      bio: "Любитель спорта. Играю в футбол и баскетбол.",
      plan: "pro",
    },
  };

  const target = accountMap[accountKey] || accountMap["dev.client"];
  await saveSession({
    token: `mock_jwt_token_${accountKey}`,
    refreshToken: `mock_refresh_${accountKey}`,
    user: target,
  });
  return target;
}

