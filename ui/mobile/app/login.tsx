import { useState } from "react";
import {
  Alert,
  Image,
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
import { loginWithEmail } from "@/lib/registration";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { PasswordInput } from "@/components/PasswordInput";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export default function LoginScreen() {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      Alert.alert("Ошибка", "Введите email и пароль");
      return;
    }
    setLoading(true);
    try {
      const res = await loginWithEmail({ email: trimmed, password });
      hapticSuccess();
      if (res?.user?.role === "business" || res?.user_info?.role === "business") {
        router.replace("/business");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err) {
      Alert.alert("Ошибка входа", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    hapticSelection();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Top Bar with Back button */}
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          </Pressable>
        </View>

        {/* Title */}
        <View style={styles.header}>
          <Image
            source={require("@/assets/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Вход в Alan Go</Text>
          <Text style={styles.subtitle}>
            Войдите в свой аккаунт, чтобы бронировать площадки и участвовать в событиях
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="name@example.com"
            placeholderTextColor={c.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.label}>Пароль</Text>
          <PasswordInput
            placeholder="Введите пароль"
            placeholderTextColor={c.textMuted}
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? "Авторизация..." : "Войти"}
            </Text>
          </Pressable>

          <SocialAuthButtons mode="signin" />

          <Pressable
            onPress={() => router.push("/register")}
            style={styles.registerLinkWrap}
          >
            <Text style={styles.registerLinkText}>
              Впервые в AlanGo?{" "}
              <Text style={styles.registerLinkAccent}>Создать аккаунт</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  skipGuestPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  skipGuestText: {
    fontSize: 13,
    fontWeight: "700",
    color: c.primary,
  },
  header: {
    marginBottom: 24,
  },
  headerLogo: {
    width: 48,
    height: 46,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: c.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: c.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },

  // Dev Quick Login Card
  devCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E2A22",
    padding: 16,
    marginBottom: 24,
  },
  devCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  devCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: c.textPrimary,
  },
  devCardSub: {
    fontSize: 12,
    color: c.textSecondary,
    marginBottom: 12,
  },
  devBtnCol: {
    gap: 8,
  },
  devBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A231E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#243329",
    padding: 12,
    gap: 12,
  },
  devBtnGuest: {
    backgroundColor: "#122018",
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  devBtnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#142A1D",
    alignItems: "center",
    justifyContent: "center",
  },
  devBtnName: {
    fontSize: 14,
    fontWeight: "700",
    color: c.textPrimary,
  },
  devBtnDesc: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 1,
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: c.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "700",
    color: c.textMuted,
    letterSpacing: 0.5,
  },

  // Form
  form: {
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
    marginTop: 4,
  },
  input: {
    height: 48,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: c.textPrimary,
  },
  primaryBtn: {
    height: 50,
    backgroundColor: c.primary,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: c.background,
  },
  guestOutlineBtn: {
    height: 50,
    backgroundColor: "transparent",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  guestOutlineBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: c.primary,
  },
  registerLinkWrap: {
    marginTop: 18,
    alignItems: "center",
    paddingVertical: 8,
  },
  registerLinkText: {
    fontSize: 14,
    color: c.textSecondary,
  },
  registerLinkAccent: {
    color: c.primary,
    fontWeight: "700",
  },
});
