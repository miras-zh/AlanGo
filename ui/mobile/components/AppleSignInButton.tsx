import { useAppleSignIn } from "@/lib/appleAuth";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@alango/design-tokens";
import * as AppleAuthentication from "expo-apple-authentication";
import { StyleSheet, Text, View } from "react-native";

type AppleSignInButtonProps = {
  mode?: "signin" | "signup";
};

export function AppleSignInButton({ mode = "signin" }: AppleSignInButtonProps) {
  const { themeName } = useTheme();
  const { available, signIn, error } = useAppleSignIn();

  if (!available) return null;

  return (
    <View style={styles.wrap}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          mode === "signup"
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
        }
        buttonStyle={
          themeName === "dark"
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={radius.control}
        style={styles.button}
        onPress={signIn}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  button: {
    width: "100%",
    height: 48,
  },
  error: {
    marginTop: 8,
    color: "#e5484d",
    fontSize: 13,
  },
});
