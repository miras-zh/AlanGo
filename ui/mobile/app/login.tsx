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
import { loginAsGuest, switchTestAccount } from "@/lib/auth";
import { PasswordInput } from "@/components/PasswordInput";
import { getErrorMessage } from "@/lib/errorMessage";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmed = email.trim();
    if (trimmed.toLowerCase() === "guest" || trimmed.toLowerCase() === "гость") {
      await handleGuestLogin();
      return;
    }

    if (!trimmed || !password) {
      Alert.alert("Ошибка", "Введите логин и пароль");
      return;
    }
    setLoading(true);
    try {
      const res = await loginWithEmail({ email: trimmed, password });
      hapticSuccess();
      if (res?.user?.role === "business") {
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

  const handleGuestLogin = async () => {
    hapticSelection();
    setLoading(true);
    try {
      await loginAsGuest();
      hapticSuccess();
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDevLogin = async (key: "dev.arena1" | "dev.arena2" | "dev.client" | "guest") => {
    hapticSelection();
    setLoading(true);
    try {
      const user = await switchTestAccount(key);
      hapticSuccess();
      if (user.role === "business") {
        router.replace("/business");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err) {
      Alert.alert("Ошибка", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0B0F0D" }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Top Bar with Back and Guest Skip button */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={handleGuestLogin}
            disabled={loading}
            style={styles.skipGuestPill}
          >
            <Ionicons name="person-outline" size={15} color="#22C55E" />
            <Text style={styles.skipGuestText}>Войти как гость</Text>
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
            Введите учетные данные или выберите тестовый аккаунт для проверки экранов
          </Text>
        </View>

        {/* --- QUICK DEV TEST ACCOUNTS (1-TAP) --- */}
        <View style={styles.devCard}>
          <View style={styles.devCardHeader}>
            <Ionicons name="flash" size={16} color="#22C55E" />
            <Text style={styles.devCardTitle}>Быстрый вход для тестирования</Text>
          </View>
          <Text style={styles.devCardSub}>Пароль для всех аккаунтов: 12345</Text>

          <View style={styles.devBtnCol}>
            <Pressable
              style={styles.devBtn}
              onPress={() => handleQuickDevLogin("dev.arena1")}
            >
              <View style={styles.devBtnIconWrap}>
                <Ionicons name="business" size={18} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.devBtnName}>dev.arena1 (Бизнес)</Text>
                <Text style={styles.devBtnDesc}>Astana Arena Sport • 3 зала</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#8E9B94" />
            </Pressable>

            <Pressable
              style={styles.devBtn}
              onPress={() => handleQuickDevLogin("dev.arena2")}
            >
              <View style={styles.devBtnIconWrap}>
                <Ionicons name="business" size={18} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.devBtnName}>dev.arena2 (Бизнес)</Text>
                <Text style={styles.devBtnDesc}>Nomad Pro Complex • 3 зала</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#8E9B94" />
            </Pressable>

            <Pressable
              style={styles.devBtn}
              onPress={() => handleQuickDevLogin("dev.client")}
            >
              <View style={[styles.devBtnIconWrap, { backgroundColor: "#182635" }]}>
                <Ionicons name="person" size={18} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.devBtnName}>dev.client (Игрок / Клиент)</Text>
                <Text style={styles.devBtnDesc}>Мико Аскаров • 5 экранов клиента</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#8E9B94" />
            </Pressable>

            <Pressable
              style={[styles.devBtn, styles.devBtnGuest]}
              onPress={() => handleQuickDevLogin("guest")}
            >
              <View style={[styles.devBtnIconWrap, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
                <Ionicons name="sparkles" size={18} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.devBtnName, { color: "#22C55E" }]}>Войти как гость</Text>
                <Text style={styles.devBtnDesc}>Без пароля • 5 экранов клиента</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#22C55E" />
            </Pressable>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ИЛИ ВХОД ВРУЧНУЮ</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Логин или Email</Text>
          <TextInput
            placeholder="dev.arena1 или email"
            placeholderTextColor="#6B7C72"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Пароль</Text>
          <PasswordInput
            placeholder="12345"
            placeholderTextColor="#6B7C72"
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

          <Pressable
            onPress={handleGuestLogin}
            disabled={loading}
            style={styles.guestOutlineBtn}
          >
            <Ionicons name="person-outline" size={18} color="#22C55E" />
            <Text style={styles.guestOutlineBtnText}>Войти как гость</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#161D19",
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
    color: "#22C55E",
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
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#8E9B94",
    marginTop: 6,
    lineHeight: 20,
  },

  // Dev Quick Login Card
  devCard: {
    backgroundColor: "#141A17",
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
    color: "#FFFFFF",
  },
  devCardSub: {
    fontSize: 12,
    color: "#8E9B94",
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
    color: "#FFFFFF",
  },
  devBtnDesc: {
    fontSize: 12,
    color: "#8E9B94",
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
    backgroundColor: "#1F2823",
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7C72",
    letterSpacing: 0.5,
  },

  // Form
  form: {
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E9B94",
    marginTop: 4,
  },
  input: {
    height: 48,
    backgroundColor: "#161D19",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#232F28",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#FFFFFF",
  },
  primaryBtn: {
    height: 50,
    backgroundColor: "#22C55E",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B0F0D",
  },
  guestOutlineBtn: {
    height: 50,
    backgroundColor: "transparent",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#22C55E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  guestOutlineBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#22C55E",
  },
});
