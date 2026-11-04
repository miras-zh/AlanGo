import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/lib/i18n";
import { loginWithEmail } from "@/lib/registration";
import { signInWithApple } from "@/lib/appleAuth";
import { signInWithGoogle } from "@/lib/googleAuth";
import { AppleSignInButton } from "@/components/AppleSignInButton";
import { PasswordInput } from "@/components/PasswordInput";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticSuccess } from "@/lib/haptics";

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Ошибка", "Введите email и пароль");
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail({ email: email.trim(), password });
      hapticSuccess();
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Ошибка входа", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    try {
      const res = await signInWithApple();
      if (!res) return;
      hapticSuccess();
      if (res.needsName) {
        router.replace("/apple-name");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err) {
      Alert.alert("Apple Sign-In", getErrorMessage(err));
    }
  };

  const handleGoogle = async () => {
    try {
      const res = await signInWithGoogle();
      if (!res) return;
      hapticSuccess();
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Google Sign-In", getErrorMessage(err));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>

        <Text style={[styles.title, { color: colors.text }]}>{t("auth.signIn")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Войдите по Email, через Apple или Google
        </Text>

        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.email")}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />

          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.password")}
          />

          <Pressable onPress={() => router.push("/forgot-password")}>
            <Text style={[styles.forgotText, { color: colors.accent }]}>{t("auth.forgotPassword")}</Text>
          </Pressable>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? t("common.loading") : t("auth.signIn")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.socialSection}>
          <AppleSignInButton onPress={handleApple} />
          <Pressable
            onPress={handleGoogle}
            style={[styles.googleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="logo-google" size={18} color={colors.text} />
            <Text style={[styles.googleBtnText, { color: colors.text }]}>
              Продолжить через Google
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.replace("/register")} style={styles.switchBtn}>
          <Text style={{ color: colors.textSecondary }}>
            Нет аккаунта? <Text style={{ color: colors.accent, fontWeight: "700" }}>{t("auth.signUp")}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24 },
  closeBtn: { alignSelf: "flex-end", padding: 4 },
  title: { fontSize: 28, fontWeight: "800", marginTop: 8 },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 24 },
  form: { gap: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  forgotText: { fontSize: 13, fontWeight: "600", alignSelf: "flex-end" },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  socialSection: { marginTop: 24, gap: 12 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  googleBtnText: { fontSize: 15, fontWeight: "600" },
  switchBtn: { marginTop: 28, alignItems: "center" },
});
