import * as AppleAuthentication from "expo-apple-authentication";
import axios from "axios";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { loginWithApple } from "@/lib/registration";
import { getErrorMessage } from "@/lib/errorMessage";
import { tr } from "@/lib/i18n";

// The backend answers 422 when it would create a brand-new account but has
// no name (Apple sends the name only on the very first authorization, and
// the user may hide it). The client then collects it on app/apple-name.tsx
// and retries with the same, still unused, identity token.
const NAME_REQUIRED_STATUS = 422;

export type AppleSignInOutcome =
  | { type: "success"; role?: string }
  | { type: "needs_name"; identityToken: string; authorizationCode?: string }
  | { type: "cancelled" };

export function useAppleSignIn() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) setAvailable(ok);
      })
      .catch(() => {
        // Native module missing (Expo Go / stale binary) — just hide the button.
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn(): Promise<AppleSignInOutcome> {
    setError(null);
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const identityToken = credential.identityToken;
      if (!identityToken) {
        setError(tr("errors.appleNoToken"));
        return { type: "cancelled" };
      }
      const authorizationCode = credential.authorizationCode ?? undefined;
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ")
        .trim();

      try {
        const data = await loginWithApple({ identityToken, authorizationCode, fullName });
        return { type: "success", role: data?.user_info?.role };
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === NAME_REQUIRED_STATUS) {
          return { type: "needs_name", identityToken, authorizationCode };
        }
        setError(getErrorMessage(err, tr("errors.appleFailed")));
        return { type: "cancelled" };
      }
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED") {
        return { type: "cancelled" };
      }
      setError(getErrorMessage(err, tr("errors.appleFailed")));
      return { type: "cancelled" };
    } finally {
      setLoading(false);
    }
  }

  return { available, signIn, loading, error };
}
