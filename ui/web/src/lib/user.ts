import { apiFetch } from "./api";
import { clearSession, saveSession, SessionUser, updateSessionUser } from "./auth";

interface BackendUserInfo {
  id: number | string;
  email: string;
  full_name?: string;
  name?: string;
  role?: string;
  photo?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  city?: string;
}

export interface AuthResponse {
  token: string;
  user_info?: BackendUserInfo;
  user?: BackendUserInfo;
}

export interface RegisterStartResponse {
  status: string;
  token: string;
}

function normalizeUser(raw?: BackendUserInfo | null): SessionUser {
  return {
    id: raw ? String(raw.id) : "",
    email: raw?.email ?? "",
    name: raw?.full_name ?? raw?.name ?? "",
    role: raw?.role ?? "user",
    avatar_url: raw?.photo ?? raw?.avatar_url,
    phone: raw?.phone,
    bio: raw?.bio,
    city: raw?.city,
  };
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>("/login", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });
  saveSession({ token: res.token, user: normalizeUser(res.user_info ?? res.user) });
  return res;
}

export async function startRegistration(
  fullName: string,
  email: string,
  password: string
): Promise<RegisterStartResponse> {
  return apiFetch<RegisterStartResponse>("/register", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ full_name: fullName, email, password }),
  });
}

export async function verifyRegistration(token: string, code: string): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>("/register/verify", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ token, code }),
  });
  saveSession({ token: res.token, user: normalizeUser(res.user_info ?? res.user) });
  return res;
}

export async function resendRegistrationCode(token: string): Promise<void> {
  await apiFetch("/register/resend", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ token }),
  });
}

export async function logoutWebSession(): Promise<void> {
  try {
    await apiFetch("/logout", { method: "POST" });
  } catch {
    // ignore
  }
  clearSession();
}

export async function fetchMe(): Promise<SessionUser> {
  const raw = await apiFetch<BackendUserInfo>("/auth/me");
  const user = normalizeUser(raw);
  updateSessionUser(user);
  return user;
}

export async function updateMe(patch: {
  name?: string;
  phone?: string;
  bio?: string;
  city?: string;
}): Promise<SessionUser> {
  const raw = await apiFetch<BackendUserInfo>("/profile", {
    method: "PATCH",
    body: JSON.stringify({
      full_name: patch.name,
      phone: patch.phone,
      city: patch.city,
    }),
  });
  const user = normalizeUser(raw);
  updateSessionUser(user);
  return user;
}

export async function deleteMyAccount(): Promise<void> {
  await apiFetch("/profile", { method: "DELETE" });
  clearSession();
}
