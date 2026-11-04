import * as AppleAuthentication from "expo-apple-authentication";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";
import { saveSession, SessionUser } from "./auth";

export interface AppleSignInResult {
  user: SessionUser;
  needsName: boolean;
}

export async function signInWithApple(): Promise<AppleSignInResult | null> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Apple не вернул identityToken");
  }

  const fullName = [
    credential.fullName?.givenName,
    credential.fullName?.familyName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const res = await apiFetch<{
    token: string;
    refresh_token?: string;
    user: SessionUser;
  }>("/auth/apple", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({
      identity_token: credential.identityToken,
      authorization_code: credential.authorizationCode || "",
      name: fullName,
    }),
  });

  await saveSession({
    token: res.token,
    refreshToken: res.refresh_token || null,
    user: res.user,
  });

  const needsName = !res.user.name || res.user.name === "Apple User";
  return { user: res.user, needsName };
}

export function useAppleSignIn() {
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  const signIn = useCallback(async () => {
    try {
      setError(null);
      await signInWithApple();
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        setError(e?.message || "Ошибка входа Apple");
      }
    }
  }, []);

  return { available, signIn, error };
}
