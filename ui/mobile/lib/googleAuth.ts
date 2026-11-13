import { useState } from "react";
import { Platform, TurboModuleRegistry } from "react-native";
import { loginWithGoogle } from "@/lib/registration";
import { getErrorMessage } from "@/lib/errorMessage";
import { tr } from "@/lib/i18n";

// Client IDs from Google Cloud Console (OAuth 2.0 Client IDs):
//   iOS client  — bundle id kz.alango.app; its reversed form is the
//                 iosUrlScheme of the google-signin plugin in app.json.
//   Web client  — makes the returned idToken's `aud` the web client id.
// The backend's GOOGLE_CLIENT_IDS must contain every one of them.
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined;

type NativeGoogleModule = typeof import("@react-native-google-signin/google-signin");

let cachedModule: NativeGoogleModule | null | undefined;

// Loaded lazily: requiring the package in a binary without the native
// module (Expo Go, stale build) throws at import time.
function getNativeGoogle(): NativeGoogleModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    if (!TurboModuleRegistry.get("RNGoogleSignin")) {
      cachedModule = null;
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: NativeGoogleModule = require("@react-native-google-signin/google-signin");
    mod.GoogleSignin.configure({
      iosClientId: IOS_CLIENT_ID,
      webClientId: WEB_CLIENT_ID,
    });
    cachedModule = mod;
    return mod;
  } catch (err) {
    console.warn("[GoogleAuth] native module unavailable:", err);
    cachedModule = null;
    return null;
  }
}

export function googleSignInAvailable(): boolean {
  if (Platform.OS === "ios" && !IOS_CLIENT_ID) return false;
  if (Platform.OS === "android" && !WEB_CLIENT_ID) return false;
  return getNativeGoogle() !== null;
}

export type GoogleSignInOutcome = { type: "success"; role?: string } | { type: "cancelled" };

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(): Promise<GoogleSignInOutcome> {
    const native = getNativeGoogle();
    if (!native) {
      setError(tr("errors.googleUnavailable"));
      return { type: "cancelled" };
    }
    setError(null);
    setLoading(true);
    try {
      if (Platform.OS === "android") {
        await native.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const res = await native.GoogleSignin.signIn();
      if (res.type === "cancelled") return { type: "cancelled" };

      const idToken = res.data?.idToken;
      if (!idToken) {
        setError(tr("errors.googleNoToken"));
        return { type: "cancelled" };
      }
      const data = await loginWithGoogle(idToken);
      return { type: "success", role: data?.user_info?.role };
    } catch (err: any) {
      if (native.isErrorWithCode(err)) {
        if (
          err.code === native.statusCodes.SIGN_IN_CANCELLED ||
          err.code === native.statusCodes.IN_PROGRESS
        ) {
          return { type: "cancelled" };
        }
        if (err.code === native.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setError(tr("errors.playServices"));
          return { type: "cancelled" };
        }
      }
      setError(getErrorMessage(err, tr("errors.googleFailed")));
      return { type: "cancelled" };
    } finally {
      setLoading(false);
    }
  }

  return { available: googleSignInAvailable(), signIn, loading, error };
}
