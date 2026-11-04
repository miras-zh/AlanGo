import { apiFetch } from "./api";
import { clearSession, saveSession, SessionUser, updateSessionUser } from "./auth";

export interface AuthResponse {
  token: string;
  refresh_token?: string;
  user: SessionUser;
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>("/login", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });
  saveSession({ token: res.token, refreshToken: res.refresh_token, user: res.user });
  return res;
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>("/register", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ name, email, password }),
  });
  saveSession({ token: res.token, refreshToken: res.refresh_token, user: res.user });
  return res;
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
  const user = await apiFetch<SessionUser>("/auth/me");
  updateSessionUser(user);
  return user;
}

export async function updateMe(patch: {
  name?: string;
  phone?: string;
  bio?: string;
  city?: string;
}): Promise<SessionUser> {
  const user = await apiFetch<SessionUser>("/profile", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  updateSessionUser(user);
  return user;
}

export async function deleteMyAccount(): Promise<void> {
  await apiFetch("/profile", { method: "DELETE" });
  clearSession();
}
