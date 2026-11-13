import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAppleSignIn } from "@/lib/appleAuth";
import { useGoogleSignIn } from "@/lib/googleAuth";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

type Props = {
  mode?: "signin" | "signup";
};

// Apple + Google buttons shared by login.tsx and register.tsx.
// Each button renders only when its native module and config are present,
// so Expo Go / an unconfigured build simply shows fewer options.
export function SocialAuthButtons({ mode = "signin" }: Props) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const apple = useAppleSignIn();
  const google = useGoogleSignIn();

  const goHome = (role?: string) => {
    hapticSuccess();
    router.replace(role === "business" ? "/business" : "/(tabs)");
  };

  const handleApple = async () => {
    hapticSelection();
    const result = await apple.signIn();
    if (result.type === "success") {
      goHome(result.role);
    } else if (result.type === "needs_name") {
      router.push({
        pathname: "/apple-name",
        params: {
          identityToken: result.identityToken,
          authorizationCode: result.authorizationCode ?? "",
        },
      });
    }
  };

  const handleGoogle = async () => {
    hapticSelection();
    const result = await google.signIn();
    if (result.type === "success") goHome(result.role);
  };

  if (!apple.available && !google.available) return null;

  const error = apple.error || google.error;
  const busy = apple.loading || google.loading;

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>или</Text>
        <View style={styles.dividerLine} />
      </View>

      {apple.available ? (
        <View pointerEvents={busy ? "none" : "auto"} style={busy && styles.dimmed}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              mode === "signup"
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radii.button}
            style={styles.button}
            onPress={handleApple}
          />
        </View>
      ) : null}

      {google.available ? (
        <Pressable
          onPress={handleGoogle}
          disabled={busy}
          style={({ pressed }) => [
            styles.button,
            styles.googleButton,
            (pressed || busy) && styles.dimmed,
          ]}
        >
          {google.loading ? (
            <ActivityIndicator color={c.textPrimary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color={c.textPrimary} />
              <Text style={styles.googleText}>
                {mode === "signup" ? "Продолжить с Google" : "Войти через Google"}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
  },
  dividerText: {
    ...typography.caption,
    color: c.textSecondary,
  },
  button: {
    width: "100%",
    height: 50,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  googleText: {
    ...typography.button,
    color: c.textPrimary,
  },
  dimmed: {
    opacity: 0.6,
  },
  error: {
    ...typography.caption,
    color: c.error,
    textAlign: "center",
  },
});
