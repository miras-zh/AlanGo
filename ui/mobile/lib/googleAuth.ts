import { apiFetch } from "./api";
import { saveSession, SessionUser } from "./auth";

export async function signInWithGoogle(idToken?: string): Promise<SessionUser | null> {
  if (!idToken) {
    throw new Error("Настройте EXPO_PUBLIC_GOOGLE_CLIENT_ID в .env для входа через Google");
  }

  const res = await apiFetch<{
    token: string;
    refresh_token?: string;
    user: SessionUser;
  }>("/auth/google", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ id_token: idToken }),
  });

  await saveSession({
    token: res.token,
    refreshToken: res.refresh_token || null,
    user: res.user,
  });

  return res.user;
}
