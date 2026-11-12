import { api } from "@/lib/api";
import { saveSession, clearSession } from "@/lib/auth";

export type StartRegistrationRequest = {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  photo?: string;
};

export async function startRegistration(payload: StartRegistrationRequest): Promise<{ token: string }> {
  const res = await api.post<{ token: string }>("/api/register", payload);
  return res.data;
}

export type VerifyRegistrationResult = {
  user_info: {
    id: number;
    full_name: string;
    email: string;
    role: string;
    phone?: string;
    city?: string;
    photo?: string;
  };
  email: string;
  token: string;
  refresh_token?: string;
};

export async function verifyRegistration(token: string, code: string): Promise<VerifyRegistrationResult> {
  const res = await api.post<VerifyRegistrationResult>("/api/register/verify", { token, code });
  if (res.data?.token) {
    const info = res.data.user_info || ({} as any);
    await saveSession({
      token: res.data.token,
      refreshToken: res.data.refresh_token,
      user: {
        ...info,
        id: String(info.id || 0),
        email: res.data.email,
        name: info.full_name || res.data.email.split("@")[0],
      },
    });
  }
  return res.data;
}

export async function resendRegistrationCode(token: string): Promise<void> {
  await api.post("/api/register/resend", { token });
}

export async function loginWithEmail(
  payload: { email: string; password: string } | string,
  passwordArg?: string,
): Promise<any> {
  const loginInput = typeof payload === "string" ? payload.trim().toLowerCase() : payload.email.trim().toLowerCase();
  const password = typeof payload === "string" ? passwordArg! : payload.password;

  const res = await api.post<any>("/api/login", { email: loginInput, password });
  const data = res.data;
  if (data?.token) {
    const user = data.user_info || data.user || {};
    await saveSession({
      token: data.token,
      refreshToken: data.refresh_token,
      user: {
        ...user,
        id: String(user.id || 0),
        email: data.email || user.email || loginInput,
        name: user.full_name || user.name || "Пользователь AlanGo",
        role: user.role || "client",
      },
    });
  }
  return data;
}

export async function registerWithEmail(
  payload: { name: string; email: string; password: string } | string,
  emailArg?: string,
  passwordArg?: string,
): Promise<any> {
  const name = typeof payload === "string" ? payload : payload.name;
  const email = typeof payload === "string" ? emailArg! : payload.email;
  const password = typeof payload === "string" ? passwordArg! : payload.password;
  const res = await api.post<any>("/api/register", { full_name: name, email, password });
  const data = res.data;
  if (data?.token && (data?.user_info || data?.user)) {
    const user = data.user_info || data.user;
    await saveSession({
      token: data.token,
      refreshToken: data.refresh_token,
      user: {
        ...user,
        id: String(user.id || 0),
        email: user.email || email,
        name: user.full_name || user.name || name,
      },
    });
  }
  return data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post("/api/password-reset/request", { email });
}

export async function logoutCurrentSession(): Promise<void> {
  try {
    await api.post("/api/logout").catch(() => {});
  } finally {
    await clearSession();
  }
}

// Shared by Apple / Google sign-in: the backend answers both with
// { token, refresh_token, email, user_info }.
async function persistSocialAuth(data: any, fallbackName: string): Promise<void> {
  if (!data?.token) {
    throw new Error("Сервер не вернул токен авторизации");
  }
  const user = data.user_info || data.user || {};
  await saveSession({
    token: data.token,
    refreshToken: data.refresh_token,
    user: {
      ...user,
      id: String(user.id || 0),
      email: data.email || user.email || "",
      name: user.full_name || user.name || fallbackName,
      role: user.role || "client",
    },
  });
}

export async function loginWithApple(payload: {
  identityToken: string;
  authorizationCode?: string;
  fullName?: string;
}): Promise<any> {
  const res = await api.post<any>("/api/auth/apple", {
    identity_token: payload.identityToken,
    authorization_code: payload.authorizationCode || "",
    full_name: payload.fullName || "",
  });
  await persistSocialAuth(res.data, payload.fullName || "Пользователь Apple");
  return res.data;
}

export async function loginWithGoogle(idToken: string): Promise<any> {
  const res = await api.post<any>("/api/auth/google", { id_token: idToken });
  await persistSocialAuth(res.data, "Пользователь Google");
  return res.data;
}

export async function deleteAccountApi(): Promise<void> {
  try {
    await api.delete("/api/profile");
  } finally {
    await clearSession();
  }
}

export function passwordStrengthError(password: string): string | null {
  if (password.length < 8) return "tooShort";
  const hasLetter = /\p{L}/u.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^\s\p{L}\d]/u.test(password);
  if (!hasLetter || !hasDigit || !hasSpecial) return "tooWeak";
  return null;
}
